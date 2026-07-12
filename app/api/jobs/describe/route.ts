import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractJobText } from '@/lib/textExtractor';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function findChrome(): string | null {
  for (const p of CHROME_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function scrapeWithChrome(url: string, executablePath: string): Promise<{
  html: string;
  finalUrl: string;
  blocked: boolean;
} | null> {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--log-level=3',
        '--silent-debugger',
      ],
    });

    const page = await browser.newPage();
    page.on('console', () => {});
    page.on('pageerror', () => {});
    await page.setUserAgent(UA);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const finalUrl = page.url();
    const html = await page.content();
    const bodyText = await page.evaluate(() => document.body.innerText);

    const blocked = bodyText.includes('Cloudflare') ||
      bodyText.includes('Attention Required') ||
      bodyText.includes('you have been blocked') ||
      bodyText.includes('Please enable cookies');

    return { html, finalUrl, blocked };
  } catch (err) {
    console.error('[DESCRIBE] Chrome scrape failed:', (err as Error)?.message?.slice(0, 100));
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, title, company, description } = await req.json();
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

    let pageText = '';
    let source: 'scraped' | 'api' = 'api';
    let finalUrl: string | null = null;
    let blocked = false;

    const chromePath = findChrome();
    if (chromePath) {
      const result = await scrapeWithChrome(url, chromePath);
      if (result) {
        finalUrl = result.finalUrl;
        blocked = result.blocked;

        if (!blocked && result.html) {
          pageText = extractJobText(result.html);
          if (pageText.length >= 200) source = 'scraped';
        }
      }
    } else {
      console.log('[DESCRIBE] Chrome not found, falling back to API description');
    }

    if (pageText.length < 200) {
      pageText = description?.trim() || '';

      if (pageText.length < 50) {
        return NextResponse.json({
          techStack: '—',
          yearsOfExperience: '—',
          summary: blocked
            ? `The job page (${finalUrl}) is behind Cloudflare protection and could not be scraped.`
            : 'Could not access the job page or retrieve enough description text.',
          otherDetails: '—',
          _source: 'blocked',
          _charCount: 0,
          _url: url,
          _finalUrl: finalUrl,
        });
      }

      source = 'api';
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

    let lastError: string | null = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `You are a job description analyzer. Below is the extracted text of a job posting. Extract the requested fields using ONLY the text provided — do NOT guess, estimate, or use outside knowledge.

Return ONLY valid JSON (no markdown, no explanation):

{
  "techStack": "Comma-separated list of ALL technologies, tools, programming languages, frameworks mentioned.",
  "yearsOfExperience": "The EXACT sentence(s) about experience requirement. Copy them word-for-word from the text. If nothing mentions years of experience, return \"Not specified\".",
  "summary": "A concise summary of the role in under 150 words based ONLY on the provided text.",
  "otherDetails": "Any other notable details: education requirements, certifications, remote/onsite/hybrid, benefits, salary range. Quote exact phrases when possible."
}

Job Title: ${title || 'Unknown'}
Company: ${company || 'Unknown'}

EXTRACTED PAGE TEXT:
${pageText}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const clean = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(clean);

        return NextResponse.json({
          ...data,
          _source: source,
          _charCount: pageText.length,
          _url: url,
          _finalUrl: finalUrl,
        });
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    throw new Error(lastError || 'All models failed');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Description fetch failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

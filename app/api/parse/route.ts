import { NextRequest, NextResponse } from 'next/server';
import { parseCSV } from '@/lib/parsers/csvParser';
import { parseXLSX } from '@/lib/parsers/xlsxParser';
import { extractEmailsFromText } from '@/lib/emailDetector';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Contact {
  name: string;
  email: string;
  company?: string;
  [key: string]: any;
}

async function extractContactsWithAI(rawText: string, apiKey: string): Promise<Contact[]> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const textToAnalyze = rawText.slice(0, 30000);

    const prompt = `Extract all contact records (recruiters, candidates, or HR staff) from the text below. For each contact, extract:
    1. Full Name (if present, else empty string "")
    2. Email Address
    3. Company Name (if present, else empty string "")

    Output ONLY a valid JSON array of objects with the exact structure below, no extra text, explanation, or markdown code wraps:
    [
      { "name": "Contact Name", "email": "email@example.com", "company": "Company Name" }
    ]

    Text:
    ${textToAnalyze}`;

    const response = await model.generateContent(prompt);
    const responseText = response.response.text().trim();
    const cleanJson = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) {
      return parsed.map(c => ({
        name: (c.name || '').trim(),
        email: (c.email || '').trim().replace(/['"]/g, ''),
        company: (c.company || '').trim()
      })).filter(c => c.email && c.email.includes('@'));
    }
  } catch (err) {
    console.error('Failed to extract contacts with AI:', err);
  }
  return [];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name.toLowerCase();
    const apiKey = process.env.GEMINI_API_KEY;

    let contacts: Contact[] = [];

    // 1. Structured files: CSV and XLSX
    if (filename.endsWith('.csv')) {
      contacts = await parseCSV(buffer);
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      contacts = await parseXLSX(buffer);
    } 
    // 2. Unstructured files (PDF, DOCX, TXT): extract raw text first
    else {
      let rawText = '';
      if (filename.endsWith('.pdf')) {
        try {
          const parser = new PDFParse({ data: buffer });
          const textResult = await parser.getText();
          await parser.destroy();
          rawText = textResult.text || '';
        } catch (err) {
          console.error('PDF text extraction error:', err);
        }
      } else if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
        try {
          const result = await mammoth.extractRawText({ buffer });
          rawText = result.value || '';
        } catch (err) {
          console.error('DOCX text extraction error:', err);
        }
      } else {
        rawText = buffer.toString('utf-8');
      }

      // If Gemini API Key is configured, use AI to parse the unstructured text
      if (apiKey && rawText.trim()) {
        contacts = await extractContactsWithAI(rawText, apiKey);
      } else {
        // Fallback: simple regex email extraction
        contacts = extractEmailsFromText(rawText);
      }
    }

    // Deduplicate by email
    const seen = new Set<string>();
    const unique = contacts.filter((c) => {
      if (seen.has(c.email.toLowerCase())) return false;
      seen.add(c.email.toLowerCase());
      return true;
    });

    return NextResponse.json({ contacts: unique, total: unique.length });
  } catch (err) {
    console.error('Parse error:', err);
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { guessRecruiterEmails } from '@/lib/emailGuesser';
import { suggestDomainsWithAI, AIDomainSuggestion } from '@/lib/emailGuesserAI';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { jobs }: { jobs: Job[] } = await req.json();

    if (!jobs || !jobs.length) {
      return NextResponse.json({ error: 'No jobs selected' }, { status: 400 });
    }

    // AI-powered domain search using Gemini (finds real domains, not fake emails)
    let domainSuggestions: Map<string, AIDomainSuggestion> | null = null;
    const apiKey = process.env.GEMINI_API_KEY || '';

    if (apiKey) {
      try {
        const companies = jobs.map((j) => j.company).filter(Boolean);
        domainSuggestions = await suggestDomainsWithAI(companies, apiKey);
        console.log(`AI found real domains for ${domainSuggestions.size} companies`);
      } catch (err) {
        console.error('AI domain search failed, falling back to pattern-only:', err);
      }
    }

    const contacts = jobs.map((job) => {
      const trimmedCompany = job.company?.trim() || '';
      const ai = domainSuggestions?.get(trimmedCompany);

      // Use AI-verified real domain (e.g. "abb.com" not "in.abb.com")
      const realDomain = ai?.realDomain || '';
      const knownPrefixes = ai?.knownPrefixes || [];

      // Generate pattern-based emails using the real domain if available
      const patternEmails = guessRecruiterEmails(trimmedCompany, realDomain || undefined);

      // Collect all suggestions
      const allSuggestions: string[] = [];

      // AI-known specific email (from published careers pages)
      if (ai?.hasKnownRecruitmentEmail) {
        allSuggestions.push(ai.hasKnownRecruitmentEmail);
      }

      // AI-known prefixes (e.g. "careers", "hr") + real domain
      if (knownPrefixes.length && realDomain) {
        for (const prefix of knownPrefixes) {
          const specificEmail = `${prefix}@${realDomain}`;
          if (!allSuggestions.includes(specificEmail)) allSuggestions.push(specificEmail);
        }
      }

      // Pattern-based fallback
      for (const pe of patternEmails) {
        if (!allSuggestions.includes(pe)) allSuggestions.push(pe);
      }

      // Primary email: use AI-published email first, then AI prefix + domain, then first pattern
      let primaryEmail = '';
      if (ai?.hasKnownRecruitmentEmail) {
        primaryEmail = ai.hasKnownRecruitmentEmail;
      } else if (knownPrefixes.length && realDomain) {
        primaryEmail = `${knownPrefixes[0]}@${realDomain}`;
      } else {
        primaryEmail = patternEmails[0] || '';
      }

      return {
        name: `Hiring Manager at ${trimmedCompany}`,
        email: primaryEmail,
        company: trimmedCompany,
        jobTitle: job.title,
        jobLocation: job.location,
        jobUrl: job.url,
        jobSalary: job.salary || '',
        jobDescription: job.description?.slice(0, 200) || '',
        aiSource: ai?.realDomain ? `AI domain: ${ai.realDomain} (confidence: ${ai.confidence})` : 'pattern',
        suggestedEmails: [...new Set(allSuggestions)].join(', '),
      };
    });

    return NextResponse.json({
      contacts,
      total: contacts.length,
      aiUsed: !!domainSuggestions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to convert jobs';
    console.error('Job convert error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

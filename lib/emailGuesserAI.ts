import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIDomainSuggestion {
  company: string;
  realDomain: string;
  knownPrefixes: string[];
  hasKnownRecruitmentEmail?: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function suggestDomainsWithAI(
  companies: string[],
  apiKey: string
): Promise<Map<string, AIDomainSuggestion>> {
  if (!companies.length || !apiKey) return new Map();

  const result = new Map<string, AIDomainSuggestion>();
  const uniqueCompanies = [...new Set(companies.map(c => c.trim()).filter(Boolean))];

  const batchSize = 5;
  for (let i = 0; i < uniqueCompanies.length; i += batchSize) {
    const batch = uniqueCompanies.slice(i, i + batchSize);
    try {
      const batchResult = await fetchCompanyDomains(batch, apiKey);
      for (const item of batchResult) {
        if (item.realDomain) {
          result.set(item.company, item);
        }
      }
    } catch (err) {
      console.error('AI domain search batch failed:', err);
    }
  }

  return result;
}

async function fetchCompanyDomains(
  companies: string[],
  apiKey: string
): Promise<AIDomainSuggestion[]> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      const companyList = companies.map((c, i) => `${i + 1}. ${c}`).join('\n');

      const prompt = `For each company below, search the web to find their ACTUAL corporate website domain (e.g., "google.com" not "google.co.in" or "googlecareers.com").

Also, if you can find their published recruitment/careers email address format (e.g., "careers@", "jobs@", "hr@", "recruiting@"), list any known prefixes.

CRITICAL RULES:
- Only return a domain if you are VERY confident it is the company's real corporate domain
- Do NOT make up emails or domains
- If unsure about a domain, leave "realDomain" empty
- "knownPrefixes" should be based on actual published emails you've seen on their careers page, not guesses
- Set confidence to "low" if you're guessing

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "company": "Company Name Exactly As Written",
    "realDomain": "actual-company-domain.com",
    "knownPrefixes": ["careers", "hr", "recruiting"],
    "hasKnownRecruitmentEmail": "actual-published-email if you've seen it, or empty string",
    "confidence": "high" | "medium" | "low"
  }
]

Companies:
${companyList}

If you cannot confidently determine a company's domain, return {"company": "Name", "realDomain": "", "knownPrefixes": [], "hasKnownRecruitmentEmail": "", "confidence": "low"}`;

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          company: item.company?.trim() || '',
          realDomain: (item.realDomain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
          knownPrefixes: (item.knownPrefixes || []).map((p: string) => p.trim().toLowerCase()).filter(Boolean),
          hasKnownRecruitmentEmail: (item.hasKnownRecruitmentEmail || '').trim().toLowerCase(),
          confidence: item.confidence || 'low',
        }));
      }
    } catch (err) {
      console.log(`Model ${modelName} failed for domain search:`, (err as Error)?.message?.slice(0, 100));
    }
  }

  return [];
}

export interface Contact {
  name: string;
  email: string;
  company?: string;
  [key: string]: any;
}

const EMAIL_KEYWORDS = [
  'email', 'mail', 'gmail', 'e-mail', 'emailid', 'email id',
  'email address', 'work email', 'contact email', 'business email',
  'electronic mail', 'email_id', 'emailaddress', 'contact'
];

const NAME_KEYWORDS = [
  'name', 'full name', 'fullname', 'first name', 'firstname',
  'candidate', 'person', 'contact name', 'employee', 'applicant'
];

const COMPANY_KEYWORDS = [
  'company', 'company name', 'companyname', 'organization', 'organisation',
  'employer', 'firm', 'business', 'corporation', 'workplace'
];

export function detectEmailColumn(headers: string[]): string | null {
  const normalized = headers.map(h => h.toLowerCase().trim().replace(/[_\-\s]+/g, ' '));

  // Exact match first
  for (const keyword of EMAIL_KEYWORDS) {
    const idx = normalized.findIndex(h => h === keyword);
    if (idx !== -1) return headers[idx];
  }

  // Partial match
  for (const keyword of EMAIL_KEYWORDS) {
    const idx = normalized.findIndex(h => h.includes(keyword));
    if (idx !== -1) return headers[idx];
  }

  return null;
}

export function detectNameColumn(headers: string[]): string | null {
  const normalized = headers.map(h => h.toLowerCase().trim().replace(/[_\-\s]+/g, ' '));

  for (const keyword of NAME_KEYWORDS) {
    const idx = normalized.findIndex(h => h === keyword);
    if (idx !== -1) return headers[idx];
  }

  for (const keyword of NAME_KEYWORDS) {
    const idx = normalized.findIndex(h => h.includes(keyword));
    if (idx !== -1) return headers[idx];
  }

  return null;
}

export function detectCompanyColumn(headers: string[]): string | null {
  const normalized = headers.map(h => h.toLowerCase().trim().replace(/[_\-\s]+/g, ' '));

  for (const keyword of COMPANY_KEYWORDS) {
    const idx = normalized.findIndex(h => h === keyword);
    if (idx !== -1) return headers[idx];
  }

  for (const keyword of COMPANY_KEYWORDS) {
    const idx = normalized.findIndex(h => h.includes(keyword));
    if (idx !== -1) return headers[idx];
  }

  return null;
}

export function extractEmailsFromText(text: string): Contact[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  const unique = [...new Set(matches)];
  return unique.map(email => ({ name: '', email, company: '' }));
}

import Papa from 'papaparse';
import { Contact, detectEmailColumn, detectNameColumn, detectCompanyColumn } from '../emailDetector';

export async function parseCSV(buffer: Buffer): Promise<Contact[]> {
  const text = buffer.toString('utf-8');
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });

  if (!result.data || result.data.length === 0) return [];

  const headers = result.meta.fields || [];
  const emailCol = detectEmailColumn(headers);
  const nameCol = detectNameColumn(headers);
  const companyCol = detectCompanyColumn(headers);

  if (!emailCol) {
    // Fallback: search all text for emails
    const { extractEmailsFromText } = await import('../emailDetector');
    return extractEmailsFromText(text);
  }

  const contacts: Contact[] = [];
  for (const row of result.data as Record<string, string>[]) {
    const email = (row[emailCol] || '').trim().replace(/['"]/g, '');
    if (!email || !email.includes('@')) continue;
    contacts.push({
      name: nameCol ? (row[nameCol] || '').trim() : '',
      email,
      company: companyCol ? (row[companyCol] || '').trim() : '',
    });
  }

  return contacts;
}

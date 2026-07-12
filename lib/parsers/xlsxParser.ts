import * as XLSX from 'xlsx';
import { Contact, detectEmailColumn, detectNameColumn, detectCompanyColumn, extractEmailsFromText } from '../emailDetector';

export async function parseXLSX(buffer: Buffer): Promise<Contact[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const contacts: Contact[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) continue;

    const headers = Object.keys(rows[0]);
    const emailCol = detectEmailColumn(headers);
    const nameCol = detectNameColumn(headers);
    const companyCol = detectCompanyColumn(headers);

    if (!emailCol) {
      // Fallback: dump to text and regex for emails
      const text = XLSX.utils.sheet_to_csv(sheet);
      contacts.push(...extractEmailsFromText(text));
      continue;
    }

    for (const row of rows) {
      const email = String(row[emailCol] || '').trim().replace(/['"]/g, '');
      if (!email || !email.includes('@')) continue;
      contacts.push({
        name: nameCol ? String(row[nameCol] || '').trim() : '',
        email,
        company: companyCol ? String(row[companyCol] || '').trim() : '',
      });
    }
  }

  return contacts;
}

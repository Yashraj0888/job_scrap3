import mammoth from 'mammoth';
import { Contact, extractEmailsFromText } from '../emailDetector';

export async function parseDOCX(buffer: Buffer): Promise<Contact[]> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return extractEmailsFromText(result.value);
  } catch {
    return [];
  }
}

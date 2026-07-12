import { Contact, extractEmailsFromText } from '../emailDetector';

export async function parseTXT(buffer: Buffer): Promise<Contact[]> {
  const text = buffer.toString('utf-8');
  return extractEmailsFromText(text);
}

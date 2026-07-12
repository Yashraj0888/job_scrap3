import { PDFParse } from 'pdf-parse';
import { Contact, extractEmailsFromText } from '../emailDetector';

export async function parsePDF(buffer: Buffer): Promise<Contact[]> {
  try {
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    await parser.destroy();
    return extractEmailsFromText(textResult.text || '');
  } catch (error) {
    console.error('PDF parsing error:', error);
    return [];
  }
}


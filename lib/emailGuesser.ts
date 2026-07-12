export function guessRecruiterEmails(company: string, customDomain?: string): string[] {
  const clean = company
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, '')
    .replace(/\s+/g, '')
    .replace(/^(the|inc|corp|ltd|llc|gmbh|co)\b/gi, '')
    .replace(/\.(com|inc|org|net)$/i, '')
    .trim();

  if (!clean) return [];

  const domain = customDomain || clean + '.com';

  return [
    `careers@${domain}`,
    `hr@${domain}`,
    `recruiting@${domain}`,
    `jobs@${domain}`,
    `talent@${domain}`,
  ];
}

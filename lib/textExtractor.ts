import { parseHTML } from 'linkedom';

const REMOVE_TAGS = new Set([
  'script', 'style', 'noscript', 'iframe', 'svg',
  'nav', 'footer', 'header', 'aside',
]);

const KEEP_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'p', 'ul', 'ol', 'strong', 'b', 'th',
]);

export function extractJobText(html: string): string {
  if (!html || html.length < 100) return '';

  const { document } = parseHTML(html);

  // Remove non-content tags
  for (const tag of REMOVE_TAGS) {
    for (const el of document.querySelectorAll(tag)) {
      el.remove();
    }
  }

  // Remove hidden elements
  for (const el of document.querySelectorAll(
    '[hidden], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]'
  )) {
    el.remove();
  }

  const body = document.body;
  if (!body) return '';

  const parts: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === 3) {
      const text = node.textContent?.replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
      return;
    }

    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName?.toLowerCase();

    // Only recurse into body, div, section, article, and the keep tags
    const containerTags = new Set(['body', 'div', 'section', 'article', 'main', 'span', 'td']);
    const isContainer = containerTags.has(tag || '');
    const isKeep = KEEP_TAGS.has(tag || '');

    if (!isContainer && !isKeep) return;

    if (tag === 'br') {
      parts.push('\n');
      return;
    }

    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag || '')) {
      const text = el.textContent?.replace(/\s+/g, ' ').trim();
      if (text) parts.push(`\n${text}\n`);
      return;
    }

    if (tag === 'li') {
      const text = el.textContent?.replace(/\s+/g, ' ').trim();
      if (text) parts.push(`• ${text}`);
      return;
    }

    if (tag === 'p' || tag === 'th') {
      const text = el.textContent?.replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
      return;
    }

    if (tag === 'strong' || tag === 'b') {
      const text = el.textContent?.replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
      return;
    }

    // For containers (body, div, section, article, etc.), recurse children
    for (const child of el.childNodes) {
      walk(child);
    }
  }

  walk(body);

  return parts
    .join('\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l)
    .join('\n')
    .slice(0, 12000);
}

/**
 * Paste sanitisation pipeline.
 *
 * Takes a raw HTML string (typically from clipboard) and returns clean,
 * semantic HTML safe for conversion into Lexical nodes.
 *
 * See CLAUDE.md Section 13.2 for the full specification.
 */

/**
 * Strict allowlist of HTML tag names that survive sanitisation.
 * Anything not on this list is unwrapped to its text content.
 */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'STRIKE',
  'CODE', 'PRE', 'BLOCKQUOTE',
  'UL', 'OL', 'LI',
  'A', 'IMG',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  'HR',
]);

/**
 * Tags that are stripped entirely (element + all children).
 */
const STRIP_ENTIRELY_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'NOSCRIPT']);

/**
 * Semantic attribute allowlist per tag.
 * Only these attributes survive on their respective elements.
 */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  A: new Set(['href']),
  IMG: new Set(['src', 'alt']),
};

/**
 * Maps common non-semantic bold/italic tags to their semantic equivalents.
 */
function normalizeTagName(tagName: string): string | null {
  switch (tagName) {
    case 'B': return 'STRONG';
    case 'I': return 'EM';
    case 'DEL': return 'S';
    case 'STRIKE': return 'S';
    default: return null;
  }
}

/**
 * Font-size thresholds for heading level normalization.
 * Google Docs uses inline font-size styles on generic elements.
 * We map font sizes to heading levels before stripping styles.
 */
function fontSizeToHeadingLevel(fontSize: string): number | null {
  const match = fontSize.match(/^([\d.]+)\s*(px|pt|em|rem)?$/);
  if (!match) return null;

  const value = parseFloat(match[1]!);
  const unit = match[2] ?? 'px';

  // Normalize to px
  let px: number;
  switch (unit) {
    case 'pt': px = value * (4 / 3); break;
    case 'em':
    case 'rem': px = value * 16; break;
    default: px = value;
  }

  // Map pixel ranges to heading levels
  if (px >= 32) return 1;
  if (px >= 24) return 2;
  if (px >= 18) return 3;
  return null; // Normal text — no heading
}

/**
 * Strips all attributes from an element except those in the allowlist.
 */
function stripAttributes(el: Element): void {
  const allowed = ALLOWED_ATTRIBUTES[el.tagName];
  const attrs = Array.from(el.attributes);

  for (const attr of attrs) {
    if (!allowed || !allowed.has(attr.name)) {
      el.removeAttribute(attr.name);
    }
  }
}

/**
 * Recursively sanitises a DOM tree in place.
 *
 * Returns true if the node should be kept, false if it was removed.
 */
function sanitizeNode(node: Node, doc: Document): void {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    return; // Keep text nodes as-is
  }

  if (node.nodeType !== 1 /* ELEMENT_NODE */) {
    // Remove comments, processing instructions, etc.
    node.parentNode?.removeChild(node);
    return;
  }

  const el = node as Element;
  const tagName = el.tagName;

  // Strip dangerous tags entirely (element + children)
  if (STRIP_ENTIRELY_TAGS.has(tagName)) {
    el.parentNode?.removeChild(el);
    return;
  }

  // Before stripping styles, check for font-size-based heading normalization
  const inlineStyle = el.getAttribute('style');
  let headingLevel: number | null = null;

  if (inlineStyle) {
    const fontSizeMatch = inlineStyle.match(/font-size\s*:\s*([^;]+)/i);
    if (fontSizeMatch) {
      headingLevel = fontSizeToHeadingLevel(fontSizeMatch[1]!.trim());
    }
  }

  // Process children first (bottom-up traversal to handle mutations safely)
  const children = Array.from(el.childNodes);
  for (const child of children) {
    sanitizeNode(child, doc);
  }

  // Handle SPAN: always unwrap (spans are non-semantic after style stripping)
  if (tagName === 'SPAN' || tagName === 'FONT') {
    // If this span had a font-size that maps to a heading, wrap in heading
    if (headingLevel !== null && headingLevel >= 1 && headingLevel <= 3) {
      const heading = doc.createElement(`h${headingLevel}`);
      while (el.firstChild) {
        heading.appendChild(el.firstChild);
      }
      el.parentNode?.replaceChild(heading, el);
      return;
    }

    // Otherwise just unwrap
    unwrapElement(el);
    return;
  }

  // Handle DIV: treat as paragraph if it has content, otherwise unwrap
  if (tagName === 'DIV') {
    // If this div had a heading font-size, convert to heading
    if (headingLevel !== null && headingLevel >= 1 && headingLevel <= 3) {
      const heading = doc.createElement(`h${headingLevel}`);
      while (el.firstChild) {
        heading.appendChild(el.firstChild);
      }
      el.parentNode?.replaceChild(heading, el);
      return;
    }

    // Convert div to p
    const p = doc.createElement('p');
    while (el.firstChild) {
      p.appendChild(el.firstChild);
    }
    el.parentNode?.replaceChild(p, el);
    return;
  }

  // Check allowlist
  if (!ALLOWED_TAGS.has(tagName)) {
    // Normalize non-semantic tags (B→STRONG, I→EM, etc.)
    const normalized = normalizeTagName(tagName);
    if (normalized && ALLOWED_TAGS.has(normalized)) {
      const replacement = doc.createElement(normalized);
      while (el.firstChild) {
        replacement.appendChild(el.firstChild);
      }
      el.parentNode?.replaceChild(replacement, el);
      stripAttributes(replacement);
      return;
    }

    // Unknown tag: unwrap to text content
    unwrapElement(el);
    return;
  }

  // Normalize B/I/DEL/STRIKE even if they're in the allowlist
  const normalized = normalizeTagName(tagName);
  if (normalized) {
    const replacement = doc.createElement(normalized);
    while (el.firstChild) {
      replacement.appendChild(el.firstChild);
    }
    el.parentNode?.replaceChild(replacement, el);
    stripAttributes(replacement);
    return;
  }

  // Element is allowed — strip non-semantic attributes
  stripAttributes(el);
}

/**
 * Unwraps an element, replacing it with its child nodes.
 */
function unwrapElement(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;

  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

/**
 * Sanitises pasted HTML for safe insertion into the Lexical AST.
 *
 * This is a pure function: it takes an HTML string and returns a sanitised
 * HTML string. It uses `DOMParser` (browser API) to parse and manipulate
 * the HTML.
 *
 * @param html - Raw HTML string from the clipboard
 * @returns Sanitised HTML string safe for `$generateNodesFromDOM`
 */
export function sanitizePastedHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Sanitise the body (which contains the pasted content)
  const body = doc.body;

  // Process all children
  const children = Array.from(body.childNodes);
  for (const child of children) {
    sanitizeNode(child, doc);
  }

  return body.innerHTML;
}

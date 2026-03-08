/**
 * Pure CSS inline style string utilities.
 *
 * Lexical's `selection.setStyle()` replaces the entire style string,
 * so we need helpers to merge properties without clobbering existing ones.
 */

/**
 * Parse a CSS inline style string into a Map of property → value.
 */
function parseStyle(style: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!style.trim()) return map;

  for (const declaration of style.split(";")) {
    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) continue;
    const prop = declaration.slice(0, colonIndex).trim();
    const val = declaration.slice(colonIndex + 1).trim();
    if (prop && val) {
      map.set(prop, val);
    }
  }
  return map;
}

/**
 * Serialize a Map of style properties back to an inline style string.
 */
function serializeStyle(map: Map<string, string>): string {
  const parts: string[] = [];
  for (const [prop, val] of map) {
    parts.push(`${prop}: ${val}`);
  }
  return parts.join("; ");
}

/**
 * Merge a single CSS property into an existing inline style string.
 * If `value` is `null`, the property is removed.
 * Returns the new style string.
 */
export function mergeInlineStyle(
  existing: string,
  property: string,
  value: string | null,
): string {
  const map = parseStyle(existing);
  if (value === null) {
    map.delete(property);
  } else {
    map.set(property, value);
  }
  return serializeStyle(map);
}

/**
 * Read a single CSS property value from an inline style string.
 * Returns the value or `null` if not present.
 */
export function getInlineStyleProperty(
  style: string,
  property: string,
): string | null {
  const map = parseStyle(style);
  return map.get(property) ?? null;
}

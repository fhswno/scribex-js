/**
 * Font family entries for the FontPicker dropdown.
 *
 * Values use CSS variable references so apps can swap the actual
 * Google Font (or any other font) without touching the library.
 */

export interface FontFamilyEntry {
  /** Human-readable label shown in the picker */
  label: string;
  /** CSS font-family value to apply. Empty string = remove / default. */
  value: string;
  /** Font stack used to render the preview text in the picker dropdown */
  preview: string;
}

export const DEFAULT_FONT_FAMILIES: FontFamilyEntry[] = [
  { label: "Default", value: "", preview: "var(--blokhaus-font-sans)" },
  { label: "Serif", value: "var(--blokhaus-font-serif)", preview: "var(--blokhaus-font-serif)" },
  { label: "Mono", value: "var(--blokhaus-font-mono)", preview: "var(--blokhaus-font-mono)" },
  { label: "Hand", value: "var(--blokhaus-font-hand)", preview: "var(--blokhaus-font-hand)" },
];

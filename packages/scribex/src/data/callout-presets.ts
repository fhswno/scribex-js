/**
 * Callout color preset definitions.
 *
 * Each preset maps to CSS variables defined in tokens.css:
 *   --scribex-callout-{id}-bg   (background)
 *   --scribex-callout-{id}-border (left border accent)
 *
 * Developers can override presets via the `presets` prop on `<CalloutPlugin>`.
 */

export interface CalloutPreset {
  /** Unique identifier used in CSS class names and serialization */
  id: string;
  /** Human-readable label shown in UI */
  label: string;
  /** Default emoji for this preset */
  emoji: string;
  /** Raw background color for rendering the picker dot */
  bgSwatch: string;
  /** Raw border color for rendering the picker dot */
  borderSwatch: string;
}

export const DEFAULT_CALLOUT_PRESETS: CalloutPreset[] = [
  { id: "default", label: "Default", emoji: "\u{1F4A1}", bgSwatch: "#f1f1ef", borderSwatch: "#d4d4d4" },
  { id: "info",    label: "Info",    emoji: "\u{2139}\u{FE0F}",  bgSwatch: "#ddebf1", borderSwatch: "#0b6e99" },
  { id: "warning", label: "Warning", emoji: "\u{26A0}\u{FE0F}",  bgSwatch: "#fbf3db", borderSwatch: "#dfab01" },
  { id: "error",   label: "Error",   emoji: "\u{1F6AB}", bgSwatch: "#fbe4e4", borderSwatch: "#e03e3e" },
  { id: "success", label: "Success", emoji: "\u{2705}", bgSwatch: "#ddedea", borderSwatch: "#0f7b6c" },
  { id: "purple",  label: "Note",    emoji: "\u{1F4DD}", bgSwatch: "#eae4f2", borderSwatch: "#6940a5" },
];

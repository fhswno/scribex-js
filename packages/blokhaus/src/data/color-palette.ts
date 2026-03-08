/**
 * Color palette types and default palette for text color & background highlighting.
 *
 * Colors are stored as CSS variable references (e.g., "var(--blokhaus-text-red)")
 * so developers can override them via tokens.css to rebrand.
 */

export interface ColorEntry {
  /** Human-readable label shown in the picker */
  label: string;
  /** CSS value to apply — should be a var() reference */
  value: string;
  /** Preview swatch color (raw hex/hsl for rendering the dot in the picker) */
  swatch: string;
}

export interface ColorPalette {
  text: ColorEntry[];
  highlight: ColorEntry[];
}

export const DEFAULT_COLOR_PALETTE: ColorPalette = {
  text: [
    { label: "Default", value: "", swatch: "currentColor" },
    { label: "Gray", value: "var(--blokhaus-text-gray)", swatch: "#9b9a97" },
    { label: "Brown", value: "var(--blokhaus-text-brown)", swatch: "#64473a" },
    { label: "Orange", value: "var(--blokhaus-text-orange)", swatch: "#d9730d" },
    { label: "Yellow", value: "var(--blokhaus-text-yellow)", swatch: "#dfab01" },
    { label: "Green", value: "var(--blokhaus-text-green)", swatch: "#0f7b6c" },
    { label: "Blue", value: "var(--blokhaus-text-blue)", swatch: "#0b6e99" },
    { label: "Purple", value: "var(--blokhaus-text-purple)", swatch: "#6940a5" },
    { label: "Pink", value: "var(--blokhaus-text-pink)", swatch: "#ad1a72" },
    { label: "Red", value: "var(--blokhaus-text-red)", swatch: "#e03e3e" },
  ],
  highlight: [
    { label: "Default", value: "", swatch: "transparent" },
    { label: "Gray", value: "var(--blokhaus-highlight-gray)", swatch: "#ebeced" },
    { label: "Brown", value: "var(--blokhaus-highlight-brown)", swatch: "#e9e5e3" },
    { label: "Orange", value: "var(--blokhaus-highlight-orange)", swatch: "#faebdd" },
    { label: "Yellow", value: "var(--blokhaus-highlight-yellow)", swatch: "#fbf3db" },
    { label: "Green", value: "var(--blokhaus-highlight-green)", swatch: "#ddedea" },
    { label: "Blue", value: "var(--blokhaus-highlight-blue)", swatch: "#ddebf1" },
    { label: "Purple", value: "var(--blokhaus-highlight-purple)", swatch: "#eae4f2" },
    { label: "Pink", value: "var(--blokhaus-highlight-pink)", swatch: "#f4dfeb" },
    { label: "Red", value: "var(--blokhaus-highlight-red)", swatch: "#fbe4e4" },
  ],
};

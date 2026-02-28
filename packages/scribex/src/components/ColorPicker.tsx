"use client";

import { useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { CheckIcon } from "@phosphor-icons/react";

import { SET_TEXT_COLOR_COMMAND, SET_HIGHLIGHT_COLOR_COMMAND } from "../commands";
import type { ColorPalette } from "../data/color-palette";
import { DEFAULT_COLOR_PALETTE } from "../data/color-palette";

interface ColorPickerProps {
  palette?: ColorPalette;
  activeTextColor: string | null;
  activeHighlightColor: string | null;
  onClose: () => void;
}

export function ColorPicker({
  palette = DEFAULT_COLOR_PALETTE,
  activeTextColor,
  activeHighlightColor,
  onClose,
}: ColorPickerProps) {
  const [editor] = useLexicalComposerContext();

  const handleTextColor = useCallback(
    (value: string) => {
      editor.dispatchCommand(SET_TEXT_COLOR_COMMAND, value);
      editor.focus();
      onClose();
    },
    [editor, onClose],
  );

  const handleHighlightColor = useCallback(
    (value: string) => {
      editor.dispatchCommand(SET_HIGHLIGHT_COLOR_COMMAND, value);
      editor.focus();
      onClose();
    },
    [editor, onClose],
  );

  return (
    <div
      data-testid="color-picker"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        padding: "8px",
        minWidth: "200px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {/* Text color section */}
      <div
        style={{
          fontSize: "10.5px",
          fontWeight: 600,
          color: "var(--scribex-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          padding: "2px 4px 6px",
          userSelect: "none",
        }}
      >
        Text color
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", marginBottom: "8px" }}>
        {palette.text.map((entry) => {
          const isActive =
            entry.value === "" ? !activeTextColor : activeTextColor === entry.value;

          return (
            <button
              key={`text-${entry.label}`}
              type="button"
              title={entry.label}
              data-testid={`color-text-${entry.label.toLowerCase()}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleTextColor(entry.value);
              }}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "4px",
                border: "1px solid var(--scribex-popover-border)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
                position: "relative",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color:
                    entry.swatch === "currentColor"
                      ? "var(--scribex-foreground, #1d1d1f)"
                      : entry.swatch,
                  lineHeight: 1,
                }}
              >
                A
              </span>
              {isActive && (
                <CheckIcon
                  size={8}
                  weight="bold"
                  style={{
                    position: "absolute",
                    bottom: "1px",
                    right: "1px",
                    color: "var(--scribex-accent, #007AFF)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div
        style={{
          height: "0.5px",
          backgroundColor: "var(--scribex-separator)",
          margin: "4px 0",
        }}
      />

      {/* Highlight color section */}
      <div
        style={{
          fontSize: "10.5px",
          fontWeight: 600,
          color: "var(--scribex-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          padding: "6px 4px 6px",
          userSelect: "none",
        }}
      >
        Background
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
        {palette.highlight.map((entry) => {
          const isActive =
            entry.value === ""
              ? !activeHighlightColor
              : activeHighlightColor === entry.value;

          return (
            <button
              key={`highlight-${entry.label}`}
              type="button"
              title={entry.label}
              data-testid={`color-highlight-${entry.label.toLowerCase()}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleHighlightColor(entry.value);
              }}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "4px",
                border: "1px solid var(--scribex-popover-border)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  entry.swatch === "transparent" ? "transparent" : entry.swatch,
                position: "relative",
              }}
            >
              {entry.swatch === "transparent" && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--scribex-text-tertiary)",
                    lineHeight: 1,
                  }}
                >
                  ∅
                </span>
              )}
              {isActive && (
                <CheckIcon
                  size={10}
                  weight="bold"
                  style={{
                    color:
                      entry.swatch === "transparent"
                        ? "var(--scribex-accent, #007AFF)"
                        : "var(--scribex-icon-secondary)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

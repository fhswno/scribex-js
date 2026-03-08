"use client";

import { useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { CheckIcon } from "@phosphor-icons/react";

import { SET_FONT_FAMILY_COMMAND } from "../commands";
import type { FontFamilyEntry } from "../data/font-families";
import { DEFAULT_FONT_FAMILIES } from "../data/font-families";

interface FontPickerProps {
  fonts?: FontFamilyEntry[];
  activeFont: string | null;
  onClose: () => void;
}

export function FontPicker({
  fonts = DEFAULT_FONT_FAMILIES,
  activeFont,
  onClose,
}: FontPickerProps) {
  const [editor] = useLexicalComposerContext();

  const handleSelect = useCallback(
    (value: string) => {
      editor.dispatchCommand(SET_FONT_FAMILY_COMMAND, value);
      editor.focus();
      onClose();
    },
    [editor, onClose],
  );

  return (
    <div
      data-testid="font-picker"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        padding: "4px",
        minWidth: "160px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {fonts.map((entry) => {
        const isActive =
          entry.value === "" ? !activeFont : activeFont === entry.value;

        return (
          <button
            key={entry.label}
            type="button"
            aria-label={entry.label}
            data-testid={`font-${entry.label.toLowerCase()}`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(entry.value);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "6px 8px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              backgroundColor: isActive
                ? "var(--blokhaus-hover-bg)"
                : "transparent",
              color: "var(--blokhaus-foreground, #1d1d1f)",
              transition: "background-color 80ms ease",
              fontFamily: entry.preview,
              fontSize: "13px",
              lineHeight: "1.4",
              textAlign: "start",
            }}
          >
            <span>{entry.label}</span>
            {isActive && (
              <CheckIcon
                size={12}
                weight="bold"
                style={{
                  color: "var(--blokhaus-accent, #007AFF)",
                  flexShrink: 0,
                  marginInlineStart: "8px",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

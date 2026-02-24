"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
} from "lexical";
import { SET_TEXT_COLOR_COMMAND, SET_HIGHLIGHT_COLOR_COMMAND } from "../commands";
import { mergeInlineStyle } from "../utils/style";

export function ColorPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      SET_TEXT_COLOR_COMMAND,
      (color: string) => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          // Empty string means "default" — remove the color property
          const nodes = selection.getNodes();
          for (const node of nodes) {
            if ("getStyle" in node && typeof node.getStyle === "function") {
              const existing = (node as { getStyle: () => string }).getStyle();
              const merged = mergeInlineStyle(
                existing,
                "color",
                color || null,
              );
              (node as { setStyle: (s: string) => void }).setStyle(merged);
            }
          }
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SET_HIGHLIGHT_COLOR_COMMAND,
      (color: string) => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const nodes = selection.getNodes();
          for (const node of nodes) {
            if ("getStyle" in node && typeof node.getStyle === "function") {
              const existing = (node as { getStyle: () => string }).getStyle();
              const merged = mergeInlineStyle(
                existing,
                "background-color",
                color || null,
              );
              (node as { setStyle: (s: string) => void }).setStyle(merged);
            }
          }
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}

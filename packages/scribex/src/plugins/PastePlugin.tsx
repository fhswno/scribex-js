"use client";

import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  PASTE_COMMAND,
} from "lexical";
import { $generateNodesFromDOM } from "@lexical/html";

import { sanitizePastedHTML } from "../utils/sanitize";

/**
 * PastePlugin — intercepts paste events, sanitises incoming HTML,
 * and inserts clean Lexical nodes into the AST.
 *
 * See CLAUDE.md Section 13 for the full specification.
 */
export function PastePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const hasImageFiles = Array.from(clipboardData.files).some((file) =>
          file.type.startsWith("image/"),
        );
        if (hasImageFiles) return false;

        const html = clipboardData.getData("text/html");
        if (!html) return false; // Fall through to Lexical's default plain-text paste

        const sanitizedHTML = sanitizePastedHTML(html);

        const parser = new DOMParser();
        const dom = parser.parseFromString(sanitizedHTML, "text/html");

        const nodes = $generateNodesFromDOM(editor, dom);

        if (nodes.length === 0) return false;

        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.removeText();
        }
        $insertNodes(nodes);

        event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}

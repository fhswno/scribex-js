"use client";

// REACT
import { useEffect } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  PASTE_COMMAND,
} from "lexical";
import { $generateNodesFromDOM } from "@lexical/html";

// UTILS
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

        // If clipboard has image files, let ImagePlugin handle it
        const hasImageFiles = Array.from(clipboardData.files).some((file) =>
          file.type.startsWith("image/"),
        );
        if (hasImageFiles) return false;

        // Extract HTML from clipboard
        const html = clipboardData.getData("text/html");
        if (!html) return false; // Fall through to Lexical's default plain-text paste

        // Sanitise the HTML
        const sanitizedHTML = sanitizePastedHTML(html);

        // Parse sanitised HTML into a DOM
        const parser = new DOMParser();
        const dom = parser.parseFromString(sanitizedHTML, "text/html");

        // Convert DOM to Lexical nodes
        const nodes = $generateNodesFromDOM(editor, dom);

        if (nodes.length === 0) return false;

        // Insert at current selection
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.removeText();
        }
        $insertNodes(nodes);

        // Prevent default paste
        event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}

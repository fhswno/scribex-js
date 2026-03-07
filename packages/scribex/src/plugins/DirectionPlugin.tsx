"use client";

// REACT
import { useEffect } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $isRootNode,
  ParagraphNode,
  COMMAND_PRIORITY_LOW,
  LexicalNode,
} from "lexical";

// PLUGINS
import { SET_BLOCK_DIRECTION_COMMAND } from "../commands";

// Same regex Lexical uses internally to detect RTL text
const RTL = "\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC";
const LTR =
  "A-Za-z\u00C0-\u00D6\u00D8-\u00F6" +
  "\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u200E\u2C00-\uFB1C" +
  "\uFE00-\uFE6F\uFEFD-\uFFFF";
// eslint-disable-next-line no-misleading-character-class
const RTL_REGEX = new RegExp("^[^" + LTR + "]*[" + RTL + "]");

export const DirectionPlugin = () => {
  // Hook - Lexical Editor Context
  const [editor] = useLexicalComposerContext();

  // Command handler for explicit direction changes
  useEffect(() => {
    return editor.registerCommand(
      SET_BLOCK_DIRECTION_COMMAND,
      (direction) => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const nodes: LexicalNode[] = selection.getNodes();
          const blockNodes = new Set<import("lexical").ElementNode>();

          for (const node of nodes) {
            let current = $isElementNode(node) ? node : node.getParent();
            while (
              current &&
              current.getParent() &&
              !$isRootNode(current.getParent())
            ) {
              current = current.getParent();
            }
            if (current && $isElementNode(current) && !$isRootNode(current)) {
              blockNodes.add(current);
            }
          }

          for (const block of blockNodes) {
            block.setDirection(direction);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  // Inherit direction from previous sibling for new empty paragraphs.
  // When a user presses Enter after RTL text, the new paragraph has
  // dir="auto" which resolves to LTR for empty content. This transform
  // detects that case and explicitly sets the direction.
  useEffect(() => {
    return editor.registerNodeTransform(ParagraphNode, (node) => {
      // Only act on paragraphs with no explicit direction
      if (node.getDirection() !== null) return;

      // Only act on empty paragraphs (newly created via Enter)
      if (node.getTextContentSize() > 0) return;

      const prev = node.getPreviousSibling();
      if (!prev || !$isElementNode(prev)) return;

      // Check if the previous sibling has explicit RTL direction
      const prevDir = prev.getDirection();
      if (prevDir !== null) {
        node.setDirection(prevDir);
        return;
      }

      // For auto-detected direction, check the previous sibling's text content
      const prevText = prev.getTextContent();
      if (prevText && RTL_REGEX.test(prevText)) {
        node.setDirection("rtl");
      }
    });
  }, [editor]);

  return null;
};

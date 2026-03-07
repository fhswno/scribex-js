"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { findTopBlock } from "../utils/block-selection";

/**
 * Highlights top-level blocks when the user's text selection spans multiple blocks.
 * Returns a `clearHighlights` function and a ref tracking whether block selection is active.
 */
export function useBlockHighlight() {
  const [editor] = useLexicalComposerContext();
  const rafRef = useRef(0);
  const hasBlockSelectionRef = useRef(false);
  const isDraggingRef = useRef(false);

  const clearHighlights = useCallback(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const selected = root.querySelectorAll("[data-block-selected]");
    for (let i = 0; i < selected.length; i++) {
      selected[i]!.removeAttribute("data-block-selected");
    }
    hasBlockSelectionRef.current = false;
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        if (isDraggingRef.current) return false;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;

          if (hasBlockSelectionRef.current) {
            clearHighlights();
          }

          editor.read(() => {
            const root = editor.getRootElement();
            if (!root) return;

            const selected = root.querySelectorAll("[data-block-selected]");
            for (let i = 0; i < selected.length; i++) {
              selected[i]!.removeAttribute("data-block-selected");
            }

            const selection = $getSelection();
            if (!$isRangeSelection(selection) || selection.isCollapsed()) return;

            const anchorBlock = findTopBlock(selection.anchor.getNode());
            const focusBlock = findTopBlock(selection.focus.getNode());
            if (!anchorBlock || !focusBlock) return;
            if (anchorBlock.getKey() === focusBlock.getKey()) return;

            const rootNode = anchorBlock.getParent();
            if (!rootNode || !$isRootNode(rootNode)) return;

            const children = rootNode.getChildren();
            const anchorIdx = children.findIndex(
              (c) => c.getKey() === anchorBlock.getKey(),
            );
            const focusIdx = children.findIndex(
              (c) => c.getKey() === focusBlock.getKey(),
            );
            if (anchorIdx === -1 || focusIdx === -1) return;

            const start = Math.min(anchorIdx, focusIdx);
            const end = Math.max(anchorIdx, focusIdx);

            for (let i = start; i <= end; i++) {
              const child = children[i];
              if (!child) continue;
              const el = editor.getElementByKey(child.getKey());
              if (el) el.setAttribute("data-block-selected", "true");
            }
          });
        });
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, clearHighlights]);

  return { clearHighlights, hasBlockSelectionRef, isDraggingRef };
}

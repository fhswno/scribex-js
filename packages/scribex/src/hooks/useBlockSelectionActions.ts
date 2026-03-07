"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";

/**
 * Handles dismissing block selection on click and deleting selected blocks
 * on Backspace/Delete. Uses capture-phase listeners to intercept before Lexical.
 */
export function useBlockSelectionActions(
  hasBlockSelectionRef: React.RefObject<boolean>,
  isDraggingRef: React.RefObject<boolean>,
  clearHighlights: () => void,
) {
  const [editor] = useLexicalComposerContext();
  const editorRef = useRef(editor);
  editorRef.current = editor;

  useEffect(() => {
    const onMouseDismiss = () => {
      if (hasBlockSelectionRef.current && !isDraggingRef.current) {
        clearHighlights();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!hasBlockSelectionRef.current || isDraggingRef.current) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();

        const ed = editorRef.current;

        ed.update(() => {
          const rootNode = $getRoot();
          const children = rootNode.getChildren();

          for (const child of children) {
            const el = ed.getElementByKey(child.getKey());
            if (el && el.hasAttribute("data-block-selected")) {
              child.remove();
            }
          }
        });

        clearHighlights();
        return;
      }

      clearHighlights();
    };

    document.addEventListener("mousedown", onMouseDismiss, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", onMouseDismiss, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [clearHighlights, hasBlockSelectionRef, isDraggingRef]);
}

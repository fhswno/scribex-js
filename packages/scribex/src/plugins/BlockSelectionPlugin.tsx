"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// REACT DOM
import { createPortal } from "react-dom";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import type { LexicalNode } from "lexical";

function findTopBlock(node: LexicalNode): LexicalNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    const parent: LexicalNode | null = current.getParent();
    if (!parent || $isRootNode(parent)) return current;
    current = parent;
  }
  return null;
}

/** Check if two rectangles overlap. */
function rectsIntersect(
  a: { top: number; left: number; bottom: number; right: number },
  b: DOMRect,
): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

interface MarqueeRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const MIN_DRAG_DISTANCE = 5;

/** Interactive selectors — mousedown on these should not start a marquee. */
const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a, [role="menu"], [role="menuitem"], ' +
  '[role="dialog"], [role="toolbar"], [data-radix-popper-content-wrapper], nav';

export function BlockSelectionPlugin() {
  const [editor] = useLexicalComposerContext();
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const rafRef = useRef(0);

  // Marquee state
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const isDraggingRef = useRef(false);
  const startPointRef = useRef({ x: 0, y: 0 }); // viewport coords
  const hasMovedRef = useRef(false);
  const hasBlockSelectionRef = useRef(false);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const isTouchDeviceRef = useRef(false);

  // Shared clear function (works outside editor.read)
  const clearHighlights = useCallback(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const selected = root.querySelectorAll("[data-block-selected]");
    for (let i = 0; i < selected.length; i++) {
      selected[i]!.removeAttribute("data-block-selected");
    }
    hasBlockSelectionRef.current = false;
  }, [editor]);

  // Find wrapper element on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    isTouchDeviceRef.current =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0 ||
      "ontouchstart" in window;

    const rootEl = editor.getRootElement();
    if (rootEl) {
      // Walk up to find [data-scribex-root]
      let el: HTMLElement | null = rootEl;
      while (el && !el.hasAttribute("data-scribex-root")) {
        el = el.parentElement;
      }
      wrapperRef.current = el;
    }
  }, [editor]);

  // ─── Existing: text selection → block highlighting ───────────────────────
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        // If marquee drag is active, don't interfere
        if (isDraggingRef.current) return false;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;

          // If there's an active marquee block selection, a text selection
          // change means the user clicked/typed — clear the marquee selection
          if (hasBlockSelectionRef.current) {
            clearHighlights();
          }

          editor.read(() => {
            const root = editor.getRootElement();
            if (!root) return;

            // Clear any existing highlights from text-based selection
            const selected = root.querySelectorAll("[data-block-selected]");
            for (let i = 0; i < selected.length; i++) {
              selected[i]!.removeAttribute("data-block-selected");
            }

            const selection = $getSelection();
            if (!$isRangeSelection(selection) || selection.isCollapsed())
              return;

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

  // ─── Marquee drag-to-select (document-level, proximity-scoped) ──────────
  useEffect(() => {
    if (isTouchDeviceRef.current) return;
    if (typeof document === "undefined") return;

    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    let moveRaf = 0;

    const onMouseDown = (e: MouseEvent) => {
      // Only left button
      if (e.button !== 0) return;

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const target = e.target as HTMLElement;

      // Skip clicks on actual editor content (blocks inside the contenteditable)
      if (rootElement.contains(target) && target !== rootElement) return;

      // Skip clicks inside another editor's wrapper
      const closestEditor = target.closest("[data-scribex-root]");
      if (closestEditor && closestEditor !== wrapper) return;

      // Skip interactive UI elements
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      // Only start marquee from empty space near this editor:
      // the wrapper itself, the rootElement (empty space below blocks),
      // or an ancestor element that contains the wrapper (e.g. <main> padding)
      const isNearEditor =
        target === wrapper ||
        target === rootElement ||
        target.contains(wrapper);
      if (!isNearEditor) return;

      // Vertical proximity check to avoid triggering from far-away ancestors
      const wrapperRect = wrapper.getBoundingClientRect();
      if (
        e.clientY < wrapperRect.top - 200 ||
        e.clientY > wrapperRect.bottom + 200
      )
        return;

      // Clear any existing text selection
      window.getSelection()?.removeAllRanges();

      e.preventDefault();

      startPointRef.current = { x: e.clientX, y: e.clientY };
      hasMovedRef.current = false;
      isDraggingRef.current = true;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const dx = e.clientX - startPointRef.current.x;
      const dy = e.clientY - startPointRef.current.y;

      // Don't start the marquee until the user has dragged at least MIN_DRAG_DISTANCE
      if (!hasMovedRef.current) {
        if (
          Math.abs(dx) < MIN_DRAG_DISTANCE &&
          Math.abs(dy) < MIN_DRAG_DISTANCE
        )
          return;
        hasMovedRef.current = true;
      }

      if (moveRaf) cancelAnimationFrame(moveRaf);
      moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        if (!isDraggingRef.current) return;

        // Compute marquee in viewport (fixed) coordinates
        const sx = startPointRef.current.x;
        const sy = startPointRef.current.y;
        const cx = e.clientX;
        const cy = e.clientY;

        const left = Math.min(sx, cx);
        const top = Math.min(sy, cy);
        const right = Math.max(sx, cx);
        const bottom = Math.max(sy, cy);

        setMarqueeRect({
          top,
          left,
          width: right - left,
          height: bottom - top,
        });

        // Test intersection with each top-level block using viewport coordinates
        const marqueeViewport = { top, left, bottom, right };

        editor.read(() => {
          const rootNode = $getRoot();
          const children = rootNode.getChildren();

          for (const child of children) {
            const el = editor.getElementByKey(child.getKey());
            if (!el) continue;
            const blockRect = el.getBoundingClientRect();

            if (rectsIntersect(marqueeViewport, blockRect)) {
              el.setAttribute("data-block-selected", "true");
            } else {
              el.removeAttribute("data-block-selected");
            }
          }
        });
      });
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      if (moveRaf) {
        cancelAnimationFrame(moveRaf);
        moveRaf = 0;
      }

      setMarqueeRect(null);

      // Check if any blocks ended up selected
      const root = editor.getRootElement();
      if (root && root.querySelector("[data-block-selected]")) {
        hasBlockSelectionRef.current = true;
      }
    };

    document.addEventListener("mousedown", onMouseDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (moveRaf) cancelAnimationFrame(moveRaf);
    };
  }, [editor, clearHighlights]);

  // ─── Dismiss on click, delete on Backspace/Delete ───────────────────────
  useEffect(() => {
    const onMouseDismiss = () => {
      if (hasBlockSelectionRef.current && !isDraggingRef.current) {
        clearHighlights();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!hasBlockSelectionRef.current || isDraggingRef.current) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        // Prevent the browser and Lexical from processing the key
        e.preventDefault();
        e.stopPropagation();

        const ed = editorRef.current;

        // Remove all block-selected nodes from the AST
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

      // Any other key dismisses the block selection
      clearHighlights();
    };

    // Use capture so we intercept before Lexical or other handlers
    document.addEventListener("mousedown", onMouseDismiss, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", onMouseDismiss, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [clearHighlights]);

  // ─── Render marquee rectangle (fixed positioning, portaled to body) ─────
  if (!marqueeRect || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-testid="block-selection-marquee"
      style={{
        position: "fixed",
        top: `${marqueeRect.top}px`,
        left: `${marqueeRect.left}px`,
        width: `${marqueeRect.width}px`,
        height: `${marqueeRect.height}px`,
        backgroundColor:
          "var(--scribex-block-selection, rgba(45, 133, 255, 0.08))",
        border: "1px solid rgba(45, 133, 255, 0.25)",
        borderRadius: "3px",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />,
    document.body,
  );
}

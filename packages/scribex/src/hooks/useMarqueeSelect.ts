"use client";

import { useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import {
  type MarqueeRect,
  MIN_DRAG_DISTANCE,
  INTERACTIVE_SELECTOR,
  rectsIntersect,
} from "../utils/block-selection";

/**
 * Implements marquee (lasso) drag-to-select for top-level blocks.
 * Renders nothing on touch devices.
 */
export function useMarqueeSelect(
  hasBlockSelectionRef: React.RefObject<boolean>,
  isDraggingRef: React.MutableRefObject<boolean>,
) {
  const [editor] = useLexicalComposerContext();
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const startPointRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const isTouchDeviceRef = useRef(false);

  // Detect touch device and find wrapper element
  useEffect(() => {
    if (typeof window === "undefined") return;

    isTouchDeviceRef.current =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0 ||
      "ontouchstart" in window;

    const rootEl = editor.getRootElement();
    if (rootEl) {
      let el: HTMLElement | null = rootEl;
      while (el && !el.hasAttribute("data-scribex-root")) {
        el = el.parentElement;
      }
      wrapperRef.current = el;
    }
  }, [editor]);

  // Document-level marquee drag listeners
  useEffect(() => {
    if (isTouchDeviceRef.current) return;
    if (typeof document === "undefined") return;

    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    let moveRaf = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const target = e.target as HTMLElement;

      if (rootElement.contains(target) && target !== rootElement) return;

      const closestEditor = target.closest("[data-scribex-root]");
      if (closestEditor && closestEditor !== wrapper) return;

      if (target.closest(INTERACTIVE_SELECTOR)) return;

      const isNearEditor =
        target === wrapper ||
        target === rootElement ||
        target.contains(wrapper);
      if (!isNearEditor) return;

      // Vertical proximity check — avoid triggering from far-away ancestor padding
      const wrapperRect = wrapper.getBoundingClientRect();
      if (
        e.clientY < wrapperRect.top - 200 ||
        e.clientY > wrapperRect.bottom + 200
      )
        return;

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

        const sx = startPointRef.current.x;
        const sy = startPointRef.current.y;
        const cx = e.clientX;
        const cy = e.clientY;

        const left = Math.min(sx, cx);
        const top = Math.min(sy, cy);
        const right = Math.max(sx, cx);
        const bottom = Math.max(sy, cy);

        setMarqueeRect({ top, left, width: right - left, height: bottom - top });

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
  }, [editor, isDraggingRef, hasBlockSelectionRef]);

  return { marqueeRect };
}

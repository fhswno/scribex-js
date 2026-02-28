"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, $getRoot } from "lexical";

// REACT DOM
import { createPortal } from "react-dom";

// LUCIDE
import { DotsSixVerticalIcon } from "@phosphor-icons/react";

interface BlockInfo {
  key: string;
  top: number;
  left: number;
  width: number;
  /** Vertical center of the first line of text in the block */
  firstLineCenter: number;
}

/**
 * Finds the nearest top-level block to a given Y coordinate.
 */
function findBlockAtY(
  clientY: number,
  editor: ReturnType<typeof useLexicalComposerContext>[0],
): BlockInfo | null {
  let result: BlockInfo | null = null;

  editor.read(() => {
    const root = $getRoot();
    const children = root.getChildren();
    let closestDist = 30;

    for (const child of children) {
      const el = editor.getElementByKey(child.getKey());
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      const blockTop = rect.top;
      const blockBottom = rect.bottom;

      // Compute the vertical center of the first line of text
      const computed = window.getComputedStyle(el);
      const paddingTop = parseFloat(computed.paddingTop) || 0;
      const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2 || 20;
      const firstLineCenter = rect.top + paddingTop + lineHeight / 2;

      if (clientY >= blockTop - 4 && clientY <= blockBottom + 4) {
        result = {
          key: child.getKey(),
          top: rect.top,
          left: rect.left,
          width: rect.width,
          firstLineCenter,
        };
        return;
      }

      const dist = Math.min(
        Math.abs(clientY - blockTop),
        Math.abs(clientY - blockBottom),
      );
      if (dist < closestDist) {
        closestDist = dist;
        result = {
          key: child.getKey(),
          top: rect.top,
          left: rect.left,
          width: rect.width,
          firstLineCenter,
        };
      }
    }
  });

  return result;
}

interface OverlayPortalProps {
  namespace: string;
}

export function OverlayPortal({ namespace }: OverlayPortalProps) {
  const [editor] = useLexicalComposerContext();
  const [isTouchDevice, setIsTouchDevice] = useState<boolean | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );

  // Use refs for handle position to avoid re-render-triggered unmount/remount
  const handleRef = useRef<HTMLDivElement>(null);
  const hoveredKeyRef = useRef<string | null>(null);
  const isMouseOverHandleRef = useRef(false);
  const handleVisibleRef = useRef(false);

  // Drag state
  const isDraggingRef = useRef(false);
  const dragSourceKeyRef = useRef<string | null>(null);
  const dropPositionRef = useRef<"before" | "after">("after");
  const dropTargetKeyRef = useRef<string | null>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // Detect touch device — use multiple signals for reliability
  // Chrome DevTools device emulation doesn't always set pointer: coarse
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0 ||
      "ontouchstart" in window;
    setIsTouchDevice(isTouch);
  }, []);

  // Portal into document.body
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  // Position the handle imperatively (no state updates = no re-renders = no flicker)
  // `firstLineCenter` is the vertical center of the first line of text in the block
  const showHandle = useCallback((firstLineCenter: number, left: number) => {
    if (!handleRef.current) return;
    handleRef.current.style.top = `${firstLineCenter - 12}px`;
    handleRef.current.style.left = `${left - 28}px`;
    handleRef.current.style.visibility = "visible";
    handleVisibleRef.current = true;
  }, []);

  const hideHandle = useCallback(() => {
    if (!handleRef.current) return;
    handleRef.current.style.visibility = "hidden";
    handleVisibleRef.current = false;
    hoveredKeyRef.current = null;
  }, []);

  const showIndicator = useCallback(
    (top: number, left: number, width: number) => {
      if (!indicatorRef.current) return;
      indicatorRef.current.style.top = `${top - 1}px`;
      indicatorRef.current.style.left = `${left}px`;
      indicatorRef.current.style.width = `${width}px`;
      indicatorRef.current.style.visibility = "visible";
    },
    [],
  );

  const hideIndicator = useCallback(() => {
    if (!indicatorRef.current) return;
    indicatorRef.current.style.visibility = "hidden";
  }, []);

  // Track mouse at document level
  useEffect(() => {
    if (isTouchDevice === null || isTouchDevice) return;

    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) return;

      const rootElement = editor.getRootElement();
      if (!rootElement) return;

      const wrapperElement = rootElement.closest(
        "[data-scribex-root]",
      ) as HTMLElement | null;
      if (!wrapperElement) return;

      const wrapperRect = wrapperElement.getBoundingClientRect();
      const GUTTER = 40;

      const isNearEditor =
        e.clientY >= wrapperRect.top &&
        e.clientY <= wrapperRect.bottom &&
        e.clientX >= wrapperRect.left - GUTTER &&
        e.clientX <= wrapperRect.right;

      if (!isNearEditor && !isMouseOverHandleRef.current) {
        hideHandle();
        return;
      }

      const block = findBlockAtY(e.clientY, editor);
      if (!block) {
        if (!isMouseOverHandleRef.current) {
          hideHandle();
        }
        return;
      }

      hoveredKeyRef.current = block.key;
      showHandle(block.firstLineCenter, block.left);
    };

    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, [editor, isTouchDevice, showHandle, hideHandle]);

  // Attach native DOM events on the handle for mouseenter/mouseleave/mousedown
  // (avoids React synthetic event issues with portalled elements)
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || isTouchDevice) return;

    const onEnter = () => {
      isMouseOverHandleRef.current = true;
      handle.style.opacity = "1";
    };

    const onLeave = () => {
      isMouseOverHandleRef.current = false;
      if (!isDraggingRef.current) {
        handle.style.opacity = "0.6";
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const key = hoveredKeyRef.current;
      if (!key) return;

      isDraggingRef.current = true;
      dragSourceKeyRef.current = key;

      handle.style.opacity = "0.3";
      handle.style.cursor = "grabbing";

      const onDragMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;

        const target = findBlockAtY(moveEvent.clientY, editor);
        if (!target || target.key === dragSourceKeyRef.current) {
          hideIndicator();
          dropTargetKeyRef.current = null;
          return;
        }

        const el = editor.getElementByKey(target.key);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isBefore = moveEvent.clientY < midY;

        dropPositionRef.current = isBefore ? "before" : "after";
        dropTargetKeyRef.current = target.key;

        showIndicator(
          isBefore ? rect.top : rect.bottom,
          rect.left,
          rect.width,
        );
      };

      const onDragEnd = () => {
        isDraggingRef.current = false;
        hideIndicator();

        handle.style.opacity = "0.6";
        handle.style.cursor = "grab";

        const sourceKey = dragSourceKeyRef.current;
        const targetKey = dropTargetKeyRef.current;
        const position = dropPositionRef.current;

        if (sourceKey && targetKey && sourceKey !== targetKey) {
          editor.update(() => {
            const sourceNode = $getNodeByKey(sourceKey);
            const targetNode = $getNodeByKey(targetKey);

            if (!sourceNode || !targetNode) return;

            sourceNode.remove();

            if (position === "before") {
              targetNode.insertBefore(sourceNode);
            } else {
              targetNode.insertAfter(sourceNode);
            }
          });
        }

        dragSourceKeyRef.current = null;
        dropTargetKeyRef.current = null;
        hideHandle();

        document.removeEventListener("mousemove", onDragMove);
        document.removeEventListener("mouseup", onDragEnd);
      };

      document.addEventListener("mousemove", onDragMove);
      document.addEventListener("mouseup", onDragEnd);
    };

    handle.addEventListener("mouseenter", onEnter);
    handle.addEventListener("mouseleave", onLeave);
    handle.addEventListener("mousedown", onMouseDown);

    return () => {
      handle.removeEventListener("mouseenter", onEnter);
      handle.removeEventListener("mouseleave", onLeave);
      handle.removeEventListener("mousedown", onMouseDown);
    };
  }, [editor, isTouchDevice, hideHandle, hideIndicator, showIndicator]);

  if (isTouchDevice === null || isTouchDevice || !portalContainer) return null;

  return createPortal(
    <>
      {/* Drag handle — always in DOM, positioned imperatively */}
      <div
        ref={handleRef}
        data-testid="overlay-drag-handle"
        data-namespace={namespace}
        style={{
          position: "fixed",
          top: "0px",
          left: "0px",
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          borderRadius: "4px",
          color: "var(--scribex-muted-foreground, #94a3b8)",
          opacity: 0.6,
          transition: "opacity 0.15s",
          userSelect: "none",
          zIndex: 40,
          visibility: "hidden",
        }}
      >
        <DotsSixVerticalIcon size={16} weight="bold" />
      </div>

      {/* Drop indicator line — always in DOM, positioned imperatively */}
      <div
        ref={indicatorRef}
        data-testid="overlay-drop-indicator"
        style={{
          position: "fixed",
          top: "0px",
          left: "0px",
          width: "0px",
          height: "2px",
          backgroundColor: "var(--scribex-accent, #3b82f6)",
          pointerEvents: "none",
          zIndex: 50,
          visibility: "hidden",
        }}
      />
    </>,
    portalContainer,
  );
}

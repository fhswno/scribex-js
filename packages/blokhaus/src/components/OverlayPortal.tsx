"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { LexicalNode } from "lexical";
import { $getNodeByKey, $getRoot } from "lexical";
import { $isToggleContainerNode } from "../nodes/ToggleContainerNode";
import { $isToggleContentNode } from "../nodes/ToggleContentNode";

// REACT DOM
import { createPortal } from "react-dom";

// PHOSPHOR
import { DotsSixVerticalIcon } from "@phosphor-icons/react";

// INTERNAL
import { TurnIntoMenu } from "./TurnIntoMenu";

interface BlockInfo {
  key: string;
  top: number;
  left: number;
  width: number;
  /** Vertical center of the first line of text in the block */
  firstLineCenter: number;
  /** Text direction of this block (read from the DOM `dir` attribute) */
  direction: "ltr" | "rtl" | null;
}

/**
 * Computes BlockInfo for a DOM element/Lexical node pair.
 * Avoids getComputedStyle — uses a fixed approximation for first-line center.
 */
function getBlockInfo(
  node: LexicalNode,
  rect: DOMRect,
  element?: HTMLElement | null,
): BlockInfo {
  let dir: "ltr" | "rtl" | null = null;
  if (element) {
    const d = element.getAttribute("dir") || element.dir;
    if (d === "rtl") {
      dir = "rtl";
    } else if (d === "ltr") {
      dir = "ltr";
    } else {
      // For dir="auto" or inherited direction, use the computed direction
      // so auto-detected RTL text gets the handle on the right side
      const computed = getComputedStyle(element).direction;
      if (computed === "rtl") dir = "rtl";
      else if (computed === "ltr") dir = "ltr";
    }
  }
  return {
    key: node.getKey(),
    top: rect.top,
    left: rect.left,
    width: rect.width,
    firstLineCenter: rect.top + 14,
    direction: dir,
  };
}

/**
 * Searches children of an open toggle's content node for the nearest
 * match at clientY. Returns null if the mouse isn't over the content area.
 */
function findToggleContentChildAtY(
  clientY: number,
  containerNode: LexicalNode,
  editor: ReturnType<typeof useLexicalComposerContext>[0],
): BlockInfo | null {
  if (!$isToggleContainerNode(containerNode)) return null;

  for (const sub of containerNode.getChildren()) {
    if (!$isToggleContentNode(sub)) continue;

    const contentEl = editor.getElementByKey(sub.getKey());
    if (!contentEl) continue;
    const contentRect = contentEl.getBoundingClientRect();
    if (clientY < contentRect.top - 4 || clientY > contentRect.bottom + 4)
      continue;

    const children = sub.getChildren();

    if (children.length === 0) {
      return getBlockInfo(sub, contentRect, contentEl);
    }

    let closestDist = Infinity;
    let match: BlockInfo | null = null;

    for (const contentChild of children) {
      const el = editor.getElementByKey(contentChild.getKey());
      if (!el) continue;

      const rect = el.getBoundingClientRect();

      if (clientY >= rect.top - 4 && clientY <= rect.bottom + 4) {
        return getBlockInfo(contentChild, rect, el);
      }

      const dist = Math.min(
        Math.abs(clientY - rect.top),
        Math.abs(clientY - rect.bottom),
      );
      if (dist < closestDist) {
        closestDist = dist;
        match = getBlockInfo(contentChild, rect, el);
      }
    }

    if (match) return match;

    const firstChild = children[0]!;
    const firstChildEl = editor.getElementByKey(firstChild.getKey());
    if (firstChildEl)
      return getBlockInfo(firstChild, firstChildEl.getBoundingClientRect(), firstChildEl);

    return getBlockInfo(sub, contentRect, contentEl);
  }

  return null;
}

/**
 * Finds the nearest draggable block to a given Y coordinate.
 * For open toggle containers, checks content children first.
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

      if (
        $isToggleContainerNode(child) &&
        child.getOpen() &&
        clientY >= rect.top - 4 &&
        clientY <= rect.bottom + 4
      ) {
        const innerMatch = findToggleContentChildAtY(
          clientY,
          child,
          editor,
        );
        if (innerMatch) {
          result = innerMatch;
          return;
        }
      }

      if (clientY >= rect.top - 4 && clientY <= rect.bottom + 4) {
        result = getBlockInfo(child, rect, el);
        return;
      }

      const dist = Math.min(
        Math.abs(clientY - rect.top),
        Math.abs(clientY - rect.bottom),
      );
      if (dist < closestDist) {
        closestDist = dist;
        result = getBlockInfo(child, rect, el);
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

  // Click vs drag detection
  const mousedownTimeRef = useRef(0);
  const mousedownPosRef = useRef({ x: 0, y: 0 });

  // RAF throttle ref
  const rafIdRef = useRef(0);

  // Turn Into menu state
  const [menuState, setMenuState] = useState<{
    open: boolean;
    blockKey: string;
    position: { top: number; left: number };
  } | null>(null);

  // Detect touch device
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

  const showHandle = useCallback(
    (firstLineCenter: number, left: number, width: number, direction: "ltr" | "rtl" | null) => {
      if (!handleRef.current) return;
      handleRef.current.style.top = `${firstLineCenter - 12}px`;
      if (direction === "rtl") {
        handleRef.current.style.left = `${left + width + 4}px`;
      } else {
        handleRef.current.style.left = `${left - 28}px`;
      }
      handleRef.current.style.visibility = "visible";
      handleVisibleRef.current = true;
    },
    [],
  );

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

  // Track mouse at document level — throttled to one RAF per frame
  useEffect(() => {
    if (isTouchDevice === null || isTouchDevice) return;

    let lastClientX = 0;
    let lastClientY = 0;

    const processMousePosition = () => {
      rafIdRef.current = 0;

      if (isDraggingRef.current) return;

      const rootElement = editor.getRootElement();
      if (!rootElement) return;

      const wrapperElement = rootElement.closest(
        "[data-blokhaus-root]",
      ) as HTMLElement | null;
      if (!wrapperElement) return;

      const wrapperRect = wrapperElement.getBoundingClientRect();
      const GUTTER = 40;

      const isNearEditor =
        lastClientY >= wrapperRect.top &&
        lastClientY <= wrapperRect.bottom &&
        lastClientX >= wrapperRect.left - GUTTER &&
        lastClientX <= wrapperRect.right + GUTTER;

      if (!isNearEditor && !isMouseOverHandleRef.current) {
        hideHandle();
        return;
      }

      const block = findBlockAtY(lastClientY, editor);
      if (!block) {
        if (!isMouseOverHandleRef.current) {
          hideHandle();
        }
        return;
      }

      hoveredKeyRef.current = block.key;
      showHandle(block.firstLineCenter, block.left, block.width, block.direction);
    };

    const onMouseMove = (e: MouseEvent) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      if (isDraggingRef.current) return;

      // Throttle: only schedule one RAF per frame
      if (rafIdRef.current === 0) {
        rafIdRef.current = requestAnimationFrame(processMousePosition);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [editor, isTouchDevice, showHandle, hideHandle]);

  // Attach native DOM events on the handle for mouseenter/mouseleave/mousedown
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

      mousedownTimeRef.current = Date.now();
      mousedownPosRef.current = { x: e.clientX, y: e.clientY };

      dragSourceKeyRef.current = key;
      let hasMoved = false;
      let dragRafId = 0;
      let pendingMoveEvent: MouseEvent | null = null;

      const processDragMove = () => {
        dragRafId = 0;
        const moveEvent = pendingMoveEvent;
        if (!moveEvent) return;

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

      const onDragMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - mousedownPosRef.current.x;
        const dy = moveEvent.clientY - mousedownPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!hasMoved && dist < 5) return;
        hasMoved = true;

        if (!isDraggingRef.current) {
          isDraggingRef.current = true;
          handle.style.opacity = "0.3";
          handle.style.cursor = "grabbing";
        }

        pendingMoveEvent = moveEvent;
        if (dragRafId === 0) {
          dragRafId = requestAnimationFrame(processDragMove);
        }
      };

      const onDragEnd = () => {
        document.removeEventListener("mousemove", onDragMove);
        document.removeEventListener("mouseup", onDragEnd);
        if (dragRafId) {
          cancelAnimationFrame(dragRafId);
        }

        if (!hasMoved) {
          isDraggingRef.current = false;
          const blockKey = dragSourceKeyRef.current;
          if (blockKey && handleRef.current) {
            const handleRect = handleRef.current.getBoundingClientRect();
            setMenuState({
              open: true,
              blockKey,
              position: {
                top: handleRect.bottom + 4,
                left: handleRect.left,
              },
            });
          }
          dragSourceKeyRef.current = null;
          return;
        }

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

            // Prevent circular drops
            let ancestor: LexicalNode | null = targetNode;
            while (ancestor !== null) {
              if (ancestor.getKey() === sourceKey) return;
              ancestor = ancestor.getParent();
            }

            // If target is a ToggleContentNode (empty content area),
            // append source as first child
            if ($isToggleContentNode(targetNode)) {
              sourceNode.remove();
              targetNode.append(sourceNode);
              return;
            }

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

  const closeMenu = useCallback(() => {
    setMenuState(null);
  }, []);

  if (isTouchDevice === null || isTouchDevice || !portalContainer) return null;

  return (
    <>
      {createPortal(
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
              color: "var(--blokhaus-muted-foreground, #94a3b8)",
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
              backgroundColor: "var(--blokhaus-accent, #3b82f6)",
              pointerEvents: "none",
              zIndex: 50,
              visibility: "hidden",
            }}
          />
        </>,
        portalContainer,
      )}

      {/* Turn Into menu — rendered when drag handle is clicked */}
      {menuState?.open && (
        <TurnIntoMenu
          editor={editor}
          blockKey={menuState.blockKey}
          position={menuState.position}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

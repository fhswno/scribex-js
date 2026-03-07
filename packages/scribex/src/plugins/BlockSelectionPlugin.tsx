"use client";

import { createPortal } from "react-dom";
import { useBlockHighlight } from "../hooks/useBlockHighlight";
import { useMarqueeSelect } from "../hooks/useMarqueeSelect";
import { useBlockSelectionActions } from "../hooks/useBlockSelectionActions";

export function BlockSelectionPlugin() {
  const { clearHighlights, hasBlockSelectionRef, isDraggingRef } =
    useBlockHighlight();
  const { marqueeRect } = useMarqueeSelect(hasBlockSelectionRef, isDraggingRef);
  useBlockSelectionActions(hasBlockSelectionRef, isDraggingRef, clearHighlights);

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

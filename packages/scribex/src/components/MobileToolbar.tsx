"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { FORMAT_TEXT_COMMAND } from "lexical";

// REACT DOM
import { createPortal } from "react-dom";

// PHOSPHOR ICONS
import {
  TextBIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  CodeIcon,
} from "@phosphor-icons/react";
import type { IconWeight } from "@phosphor-icons/react";

type TextFormat = "bold" | "italic" | "underline" | "strikethrough" | "code";

interface ToolbarButton {
  icon: React.ComponentType<{ size?: number; weight?: IconWeight }>;
  format: TextFormat;
  label: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { icon: TextBIcon, format: "bold", label: "Bold" },
  { icon: TextItalicIcon, format: "italic", label: "Italic" },
  { icon: TextUnderlineIcon, format: "underline", label: "Underline" },
  { icon: TextStrikethroughIcon, format: "strikethrough", label: "Strikethrough" },
  { icon: CodeIcon, format: "code", label: "Inline Code" },
];

/**
 * MobileToolbar — bottom-anchored formatting toolbar for touch devices.
 *
 * Renders a fixed toolbar at the bottom of the viewport when the user
 * has selected text inside the editor. Completely hidden on non-touch devices.
 *
 * See CLAUDE.md Section 14 for the specification.
 */
export function MobileToolbar() {
  const [editor] = useLexicalComposerContext();
  const [isTouchDevice, setIsTouchDevice] = useState<boolean | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const rootElementRef = useRef<HTMLElement | null>(null);

  // Detect touch device once on mount — use multiple signals for reliability
  // Chrome DevTools device emulation doesn't always set pointer: coarse
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0 ||
      "ontouchstart" in window;
    setIsTouchDevice(isTouch);
    setPortalContainer(document.body);
  }, []);

  // Cache the editor root element
  useEffect(() => {
    rootElementRef.current = editor.getRootElement();
  }, [editor]);

  // Listen to selectionchange to show/hide toolbar
  useEffect(() => {
    if (isTouchDevice !== true) return;

    const onSelectionChange = () => {
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.isCollapsed || domSelection.rangeCount === 0) {
        setIsVisible(false);
        return;
      }

      // Check if the selection is inside our editor
      const rootEl = rootElementRef.current;
      if (!rootEl) {
        setIsVisible(false);
        return;
      }

      const anchorNode = domSelection.anchorNode;
      if (!anchorNode || !rootEl.contains(anchorNode)) {
        setIsVisible(false);
        return;
      }

      setIsVisible(true);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [isTouchDevice]);

  const handleFormat = useCallback(
    (format: TextFormat) => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    },
    [editor],
  );

  // Don't render on non-touch devices or during SSR
  if (isTouchDevice !== true || !portalContainer) return null;

  if (!isVisible) return null;

  return createPortal(
    <div
      role="toolbar"
      aria-label="Text formatting"
      data-testid="mobile-toolbar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        padding: "8px 12px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        backgroundColor: "var(--scribex-popover-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderTop: "1px solid var(--scribex-popover-border)",
        zIndex: 50,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {TOOLBAR_BUTTONS.map(({ icon: Icon, format, label }) => (
        <button
          key={format}
          type="button"
          title={label}
          aria-label={label}
          data-testid={`mobile-toolbar-${format}`}
          onMouseDown={(e) => {
            e.preventDefault();
            handleFormat(format);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleFormat(format);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            border: "none",
            cursor: "default",
            backgroundColor: "transparent",
            color: "var(--scribex-icon-secondary)",
          }}
        >
          <Icon size={20} weight="regular" />
        </button>
      ))}
    </div>,
    portalContainer,
  );
}

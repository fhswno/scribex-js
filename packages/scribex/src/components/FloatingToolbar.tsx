"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";

// REACT DOM
import { Bold, Italic, Underline, Strikethrough, Code } from "lucide-react";
import { createPortal } from "react-dom";

type TextFormat = "bold" | "italic" | "underline" | "strikethrough" | "code";

interface ToolbarButton {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  format: TextFormat;
  label: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { icon: Bold, format: "bold", label: "Bold" },
  { icon: Italic, format: "italic", label: "Italic" },
  { icon: Underline, format: "underline", label: "Underline" },
  { icon: Strikethrough, format: "strikethrough", label: "Strikethrough" },
  { icon: Code, format: "code", label: "Inline Code" },
];

export function FloatingToolbar() {
  // Hook - Lexical Editor Context
  const [editor] = useLexicalComposerContext();

  // States
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );

  // Effect - Set Portal Container on Mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  // Callback - Update Toolbar Position and Active Formats
  const updateToolbar = useCallback(() => {
    // Read DOM selection OUTSIDE editor.read() — the DOM is already up to date
    // when SELECTION_CHANGE_COMMAND fires
    const domSelection = window.getSelection();
    if (
      !domSelection ||
      domSelection.rangeCount === 0 ||
      domSelection.isCollapsed
    ) {
      setIsVisible(false);
      return;
    }

    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      setIsVisible(false);
      return;
    }

    // Read Lexical state for active formats
    editor.read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        setIsVisible(false);
        return;
      }

      const formats = new Set<string>();
      if (selection.hasFormat("bold")) formats.add("bold");
      if (selection.hasFormat("italic")) formats.add("italic");
      if (selection.hasFormat("underline")) formats.add("underline");
      if (selection.hasFormat("strikethrough")) formats.add("strikethrough");
      if (selection.hasFormat("code")) formats.add("code");
      setActiveFormats(formats);
    });

    // Position above the selection, or below if too close to top
    const toolbarHeight = 40;
    const gap = 8;
    const showBelow = rect.top < toolbarHeight + gap;

    setPosition({
      top: showBelow ? rect.bottom + gap : rect.top - gap,
      left: rect.left + rect.width / 2,
    });
    setIsVisible(true);
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, updateToolbar]);

  // Close toolbar on Escape — handled via Lexical command since focus stays in editor
  useEffect(() => {
    if (!isVisible) return;

    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        setIsVisible(false);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, isVisible]);

  const handleFormat = useCallback(
    (format: TextFormat) => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
      // Re-focus editor after button click
      editor.focus();
    },
    [editor],
  );

  if (!isVisible || !portalContainer) return null;

  // Use inline styles for the portal — Tailwind may not scan portalled elements
  const showBelow = position.top > 100; // rough heuristic
  const transformValue =
    position.top < 50 ? "translateX(-50%)" : "translate(-50%, -100%)";

  return createPortal(
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting"
      data-testid="floating-toolbar"
      style={{
        position: "fixed",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "4px",
        borderRadius: "8px",
        border: "1px solid var(--scribex-border, #e2e8f0)",
        backgroundColor: "var(--scribex-background, #ffffff)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: transformValue,
      }}
    >
      {TOOLBAR_BUTTONS.map(({ icon: Icon, format, label }) => (
        <button
          key={format}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={activeFormats.has(format)}
          data-testid={`toolbar-${format}`}
          onMouseDown={(e) => {
            // Prevent the button click from stealing focus from the editor
            e.preventDefault();
            handleFormat(format);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            backgroundColor: activeFormats.has(format)
              ? "var(--scribex-muted, #f1f5f9)"
              : "transparent",
            color: "var(--scribex-foreground, #0f172a)",
          }}
        >
          <Icon size={16} strokeWidth={2} />
        </button>
      ))}
    </div>,
    portalContainer,
  );
}

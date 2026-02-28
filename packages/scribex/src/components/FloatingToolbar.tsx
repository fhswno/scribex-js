"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { $isTableSelection } from "@lexical/table";

// REACT DOM
import { createPortal } from "react-dom";

// PHOSPHOR ICONS
import {
  TextBIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  CodeIcon,
  LinkIcon,
} from "@phosphor-icons/react";
import type { IconWeight } from "@phosphor-icons/react";

// LEXICAL LINK
import { $isLinkNode } from "@lexical/link";

// INTERNAL
import { OPEN_LINK_INPUT_COMMAND } from "../commands";
import { getInlineStyleProperty } from "../utils/style";
import { ColorPicker } from "./ColorPicker";
import type { ColorPalette } from "../data/color-palette";

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

interface FloatingToolbarProps {
  colorPalette?: ColorPalette;
}

export function FloatingToolbar({ colorPalette }: FloatingToolbarProps = {}) {
  // Hook - Lexical Editor Context
  const [editor] = useLexicalComposerContext();

  // States
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [activeTextColor, setActiveTextColor] = useState<string | null>(null);
  const [activeHighlightColor, setActiveHighlightColor] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
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

      // Hide toolbar when table selection is active (table has its own action menu)
      if ($isTableSelection(selection)) {
        setIsVisible(false);
        return;
      }

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

      // Check if cursor is inside a link
      const node = selection.anchor.getNode();
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        formats.add("link");
      }

      // Read active text color and highlight from the anchor node's style
      const anchorNode = selection.anchor.getNode();
      if ($isTextNode(anchorNode)) {
        const style = anchorNode.getStyle();
        setActiveTextColor(getInlineStyleProperty(style, "color"));
        setActiveHighlightColor(getInlineStyleProperty(style, "background-color"));
      } else {
        setActiveTextColor(null);
        setActiveHighlightColor(null);
      }

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

  // Close color picker when toolbar hides
  useEffect(() => {
    if (!isVisible) setShowColorPicker(false);
  }, [isVisible]);

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
        gap: "1px",
        padding: "3px",
        borderRadius: "10px",
        border: "1px solid var(--scribex-popover-border)",
        backgroundColor: "var(--scribex-popover-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "var(--scribex-popover-shadow)",
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: transformValue,
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
          aria-pressed={activeFormats.has(format)}
          data-testid={`toolbar-${format}`}
          onMouseDown={(e) => {
            e.preventDefault();
            handleFormat(format);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "30px",
            borderRadius: "7px",
            border: "none",
            cursor: "default",
            backgroundColor: activeFormats.has(format)
              ? "var(--scribex-accent, #007AFF)"
              : "transparent",
            color: activeFormats.has(format)
              ? "var(--scribex-accent-foreground, #fff)"
              : "var(--scribex-icon-secondary)",
            transition: "background-color 80ms ease, color 80ms ease",
          }}
        >
          <Icon
            size={15}
            weight={activeFormats.has(format) ? "bold" : "regular"}
          />
        </button>
      ))}

      {/* Separator */}
      <div
        style={{
          width: "1px",
          height: "18px",
          backgroundColor: "var(--scribex-separator)",
          margin: "0 2px",
        }}
      />

      {/* Link button */}
      <button
        type="button"
        title="Link (Cmd+K)"
        aria-label="Link"
        aria-pressed={activeFormats.has("link")}
        data-testid="toolbar-link"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.dispatchCommand(OPEN_LINK_INPUT_COMMAND, undefined);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "30px",
          height: "30px",
          borderRadius: "7px",
          border: "none",
          cursor: "default",
          backgroundColor: activeFormats.has("link")
            ? "var(--scribex-accent, #007AFF)"
            : "transparent",
          color: activeFormats.has("link")
            ? "var(--scribex-accent-foreground, #fff)"
            : "var(--scribex-icon-secondary)",
          transition: "background-color 80ms ease, color 80ms ease",
        }}
      >
        <LinkIcon
          size={15}
          weight={activeFormats.has("link") ? "bold" : "regular"}
        />
      </button>

      {/* Separator */}
      <div
        style={{
          width: "1px",
          height: "18px",
          backgroundColor: "var(--scribex-separator)",
          margin: "0 2px",
        }}
      />

      {/* Color button */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          title="Text color"
          aria-label="Text color"
          aria-expanded={showColorPicker}
          data-testid="toolbar-color"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowColorPicker((prev) => !prev);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            width: "30px",
            height: "30px",
            borderRadius: "7px",
            border: "none",
            cursor: "default",
            backgroundColor: showColorPicker
              ? "var(--scribex-hover-bg)"
              : "transparent",
            color: "var(--scribex-icon-secondary)",
            transition: "background-color 80ms ease",
            gap: "1px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              lineHeight: 1,
              color: activeTextColor || "var(--scribex-icon-secondary)",
            }}
          >
            A
          </span>
          <div
            style={{
              width: "12px",
              height: "2.5px",
              borderRadius: "1px",
              backgroundColor: activeHighlightColor || "var(--scribex-accent, #007AFF)",
            }}
          />
        </button>

        {/* Color picker dropdown */}
        {showColorPicker && (
          <div
            data-testid="color-picker-dropdown"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: "50%",
              transform: "translateX(-50%)",
              borderRadius: "12px",
              border: "1px solid var(--scribex-popover-border)",
              backgroundColor: "var(--scribex-popover-bg)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              boxShadow: "var(--scribex-popover-shadow)",
              zIndex: 60,
            }}
          >
            <ColorPicker
              palette={colorPalette}
              activeTextColor={activeTextColor}
              activeHighlightColor={activeHighlightColor}
              onClose={() => setShowColorPicker(false)}
            />
          </div>
        )}
      </div>
    </div>,
    portalContainer,
  );
}

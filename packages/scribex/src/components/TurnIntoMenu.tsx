"use client";

// REACT
import { useCallback, useEffect, useRef } from "react";

// REACT DOM
import { createPortal } from "react-dom";

// LEXICAL
import type { LexicalEditor } from "lexical";
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $isElementNode,
} from "lexical";
import {
  $createHeadingNode,
  $isHeadingNode,
  $isQuoteNode,
  $createQuoteNode,
} from "@lexical/rich-text";
import {
  $createListNode,
  $createListItemNode,
  $isListNode,
} from "@lexical/list";
import { $isCalloutNode } from "../nodes/CalloutNode";
import { $createCalloutNode } from "../nodes/CalloutNode";
import { $isCodeBlockNode, $createCodeBlockNode } from "../nodes/CodeBlockNode";

// PHOSPHOR ICONS
import type { IconWeight } from "@phosphor-icons/react";
import {
  TextAlignLeftIcon,
  TextHOneIcon,
  TextHTwoIcon,
  TextHThreeIcon,
  QuotesIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  CheckSquareIcon,
  CodeSimpleIcon,
  InfoIcon,
  CheckIcon,
} from "@phosphor-icons/react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TurnIntoItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; weight?: IconWeight }>;
}

const TURN_INTO_ITEMS: TurnIntoItem[] = [
  { id: "paragraph", label: "Paragraph", icon: TextAlignLeftIcon },
  { id: "heading-1", label: "Heading 1", icon: TextHOneIcon },
  { id: "heading-2", label: "Heading 2", icon: TextHTwoIcon },
  { id: "heading-3", label: "Heading 3", icon: TextHThreeIcon },
  { id: "quote", label: "Quote", icon: QuotesIcon },
  { id: "bullet-list", label: "Bullet List", icon: ListBulletsIcon },
  { id: "numbered-list", label: "Numbered List", icon: ListNumbersIcon },
  { id: "check-list", label: "Checklist", icon: CheckSquareIcon },
  { id: "code", label: "Code Block", icon: CodeSimpleIcon },
  { id: "callout", label: "Callout", icon: InfoIcon },
];

// ─── Block Type Detection ───────────────────────────────────────────────────

function getBlockType(
  editor: LexicalEditor,
  blockKey: string,
): string | null {
  let type: string | null = null;
  editor.read(() => {
    const node = $getNodeByKey(blockKey);
    if (!node) return;
    if ($isHeadingNode(node)) {
      const tag = node.getTag();
      type = `heading-${tag.replace("h", "")}`;
    } else if ($isQuoteNode(node)) {
      type = "quote";
    } else if ($isListNode(node)) {
      const listType = node.getListType();
      if (listType === "bullet") type = "bullet-list";
      else if (listType === "number") type = "numbered-list";
      else if (listType === "check") type = "check-list";
    } else if ($isCodeBlockNode(node)) {
      type = "code";
    } else if ($isCalloutNode(node)) {
      type = "callout";
    } else if (node.getType() === "paragraph") {
      type = "paragraph";
    }
  });
  return type;
}

// ─── Block Conversion Logic ─────────────────────────────────────────────────

function convertBlock(
  editor: LexicalEditor,
  blockKey: string,
  targetType: string,
): void {
  editor.update(() => {
    const node = $getNodeByKey(blockKey);
    if (!node) return;

    // Extract text content for conversion
    const extractChildren = () => {
      if ($isElementNode(node)) {
        const children = node.getChildren();
        // Return cloned children array (removing from parent detaches them)
        return children;
      }
      return [];
    };

    const extractTextContent = (): string => {
      return node.getTextContent();
    };

    // Helper: move children from source to target ElementNode
    const moveChildrenTo = (
      target: import("lexical").ElementNode,
    ) => {
      if ($isListNode(node)) {
        // For lists, extract children from the first list item
        const firstItem = node.getFirstChild();
        if (firstItem && $isElementNode(firstItem)) {
          const children = firstItem.getChildren();
          for (const child of children) {
            target.append(child);
          }
        }
      } else if ($isElementNode(node)) {
        const children = node.getChildren();
        for (const child of children) {
          target.append(child);
        }
      } else {
        // DecoratorNode — use text content
        target.append($createTextNode(extractTextContent()));
      }
    };

    // Helper: wrap children into a list item inside a new list
    const wrapInList = (
      listType: "bullet" | "number" | "check",
    ) => {
      const list = $createListNode(listType);
      const item = $createListItemNode();
      if ($isListNode(node)) {
        // If converting between list types, move all items
        const items = node.getChildren();
        for (const existingItem of items) {
          list.append(existingItem);
        }
      } else {
        moveChildrenTo(item);
        list.append(item);
      }
      return list;
    };

    let newNode: import("lexical").LexicalNode | null = null;

    switch (targetType) {
      case "paragraph": {
        const p = $createParagraphNode();
        moveChildrenTo(p);
        newNode = p;
        break;
      }
      case "heading-1": {
        const h = $createHeadingNode("h1");
        moveChildrenTo(h);
        newNode = h;
        break;
      }
      case "heading-2": {
        const h = $createHeadingNode("h2");
        moveChildrenTo(h);
        newNode = h;
        break;
      }
      case "heading-3": {
        const h = $createHeadingNode("h3");
        moveChildrenTo(h);
        newNode = h;
        break;
      }
      case "quote": {
        const q = $createQuoteNode();
        moveChildrenTo(q);
        newNode = q;
        break;
      }
      case "bullet-list": {
        newNode = wrapInList("bullet");
        break;
      }
      case "numbered-list": {
        newNode = wrapInList("number");
        break;
      }
      case "check-list": {
        newNode = wrapInList("check");
        break;
      }
      case "code": {
        const text = extractTextContent();
        const codeBlock = $createCodeBlockNode({
          code: text,
          language: "javascript",
        });
        const trailing = $createParagraphNode();
        node.replace(codeBlock);
        codeBlock.insertAfter(trailing);
        trailing.selectEnd();
        return; // early return — already handled
      }
      case "callout": {
        const callout = $createCalloutNode();
        moveChildrenTo(callout);
        newNode = callout;
        break;
      }
    }

    if (newNode) {
      node.replace(newNode);
      if ($isElementNode(newNode)) {
        newNode.selectEnd();
      }
    }
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

interface TurnIntoMenuProps {
  editor: LexicalEditor;
  blockKey: string;
  position: { top: number; left: number };
  onClose: () => void;
}

export function TurnIntoMenu({
  editor,
  blockKey,
  position,
  onClose,
}: TurnIntoMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentType = getBlockType(editor, blockKey);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClickOutside);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSelect = useCallback(
    (itemId: string) => {
      if (itemId === currentType) {
        onClose();
        return;
      }
      convertBlock(editor, blockKey, itemId);
      onClose();
    },
    [editor, blockKey, currentType, onClose],
  );

  return createPortal(
    <div
      ref={containerRef}
      data-testid="turn-into-menu"
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        padding: "4px",
        borderRadius: "12px",
        border: "1px solid var(--scribex-popover-border, rgba(0,0,0,0.06))",
        backgroundColor: "var(--scribex-popover-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "var(--scribex-popover-shadow)",
        fontFamily: "var(--scribex-font-sans, system-ui, sans-serif)",
        minWidth: "180px",
        maxHeight: "340px",
        overflowY: "auto",
        animation: "scribex-turn-into-enter 0.15s ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: "10.5px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--scribex-muted-foreground, #94a3b8)",
          padding: "6px 8px 4px",
        }}
      >
        Turn into
      </div>

      {TURN_INTO_ITEMS.map((item) => {
        const isActive = item.id === currentType;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "6px 8px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              backgroundColor: isActive
                ? "var(--scribex-muted, #f1f5f9)"
                : "transparent",
              color: "var(--scribex-foreground, #0f172a)",
              fontSize: "13px",
              fontFamily: "inherit",
              textAlign: "left",
              transition: "background-color 0.1s",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor =
                  "var(--scribex-hover-bg, rgba(0,0,0,0.04))";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isActive
                ? "var(--scribex-muted, #f1f5f9)"
                : "transparent";
            }}
          >
            <Icon size={16} weight="duotone" />
            <span style={{ flex: 1 }}>{item.label}</span>
            {isActive && (
              <CheckIcon
                size={14}
                weight="bold"
                style={{ color: "var(--scribex-accent, #3b82f6)" }}
              />
            )}
          </button>
        );
      })}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes scribex-turn-into-enter {
              from {
                opacity: 0;
                transform: translateY(-4px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `,
        }}
      />
    </div>,
    document.body,
  );
}

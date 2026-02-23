"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  TextNode,
} from "lexical";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $createListNode, $createListItemNode } from "@lexical/list";

// REACT DOM
import { createPortal } from "react-dom";

// LUCIDE
import {
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Minus,
  ImageIcon,
} from "lucide-react";

// COMMANDS
import { OPEN_SLASH_MENU_COMMAND, INSERT_IMAGE_COMMAND } from "../commands";

export interface SlashMenuItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  onSelect: () => void;
}

function getDefaultItems(
  editor: ReturnType<typeof useLexicalComposerContext>[0],
): SlashMenuItem[] {
  const replaceCurrentBlock = (
    createNode: () => import("lexical").ElementNode,
  ) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchor = selection.anchor.getNode();

      // Walk up to find the top-level block BEFORE removing anything
      let block: import("lexical").LexicalNode = anchor;
      while (block.getParent() && !$isRootNode(block.getParent())) {
        block = block.getParent()!;
      }

      // Remove the "/" text
      if (anchor instanceof TextNode) {
        anchor.remove();
      }

      const newNode = createNode();
      if ($isRootNode(block)) {
        // anchor was the root itself — append
        $getRoot().append(newNode);
      } else if (
        "getChildrenSize" in block &&
        typeof block.getChildrenSize === "function" &&
        (block.getChildrenSize as () => number)() === 0
      ) {
        block.replace(newNode);
      } else {
        block.insertAfter(newNode);
      }
      newNode.selectEnd();
    });
  };

  return [
    {
      id: "heading-1",
      label: "Heading 1",
      description: "Large heading",
      icon: Heading1,
      onSelect: () => replaceCurrentBlock(() => $createHeadingNode("h1")),
    },
    {
      id: "heading-2",
      label: "Heading 2",
      description: "Medium heading",
      icon: Heading2,
      onSelect: () => replaceCurrentBlock(() => $createHeadingNode("h2")),
    },
    {
      id: "heading-3",
      label: "Heading 3",
      description: "Small heading",
      icon: Heading3,
      onSelect: () => replaceCurrentBlock(() => $createHeadingNode("h3")),
    },
    {
      id: "quote",
      label: "Quote",
      description: "Blockquote",
      icon: Quote,
      onSelect: () => replaceCurrentBlock(() => $createQuoteNode()),
    },
    {
      id: "bullet-list",
      label: "Bullet List",
      description: "Unordered list",
      icon: List,
      onSelect: () =>
        replaceCurrentBlock(() => {
          const list = $createListNode("bullet");
          const item = $createListItemNode();
          list.append(item);
          return list;
        }),
    },
    {
      id: "numbered-list",
      label: "Numbered List",
      description: "Ordered list",
      icon: ListOrdered,
      onSelect: () =>
        replaceCurrentBlock(() => {
          const list = $createListNode("number");
          const item = $createListItemNode();
          list.append(item);
          return list;
        }),
    },
    {
      id: "divider",
      label: "Divider",
      description: "Horizontal rule",
      icon: Minus,
      onSelect: () => replaceCurrentBlock(() => $createParagraphNode()),
    },
    {
      id: "image",
      label: "Image",
      description: "Upload an image",
      icon: ImageIcon,
      onSelect: () => {
        // Remove the "/" trigger text first
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();
          if (anchor instanceof TextNode) {
            anchor.remove();
          }
        });
        // Open file picker
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files?.[0];
          if (file) {
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, file);
          }
        };
        input.click();
      },
    },
  ];
}

interface SlashMenuProps {
  items?: SlashMenuItem[];
}

export function SlashMenu({ items: externalItems }: SlashMenuProps) {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  const defaultItems = getDefaultItems(editor);
  const allItems = externalItems
    ? [...defaultItems, ...externalItems]
    : defaultItems;

  const filteredItems = query
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()),
      )
    : allItems;

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const selectItem = useCallback(
    (index: number) => {
      const item = filteredItems[index];
      if (item) {
        close();
        item.onSelect();
      }
    },
    [filteredItems, close],
  );

  // Listen for the slash menu command
  useEffect(() => {
    return editor.registerCommand(
      OPEN_SLASH_MENU_COMMAND,
      () => {
        const domSelection = window.getSelection();
        if (!domSelection || domSelection.rangeCount === 0) return false;

        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
        setIsOpen(true);
        setQuery("");
        setSelectedIndex(0);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  // Track text typed after "/" to use as filter query
  useEffect(() => {
    if (!isOpen) return;

    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          close();
          return;
        }
        const anchor = selection.anchor.getNode();
        if (anchor instanceof TextNode) {
          const text = anchor.getTextContent();
          if (text.startsWith("/")) {
            setQuery(text.slice(1));
            setSelectedIndex(0);
          } else if (text === "") {
            // User deleted the "/"
            close();
          } else {
            close();
          }
        }
      });
    });
  }, [editor, isOpen, close]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const removeArrowDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        event?.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredItems.length - 1),
        );
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    const removeArrowUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        event?.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    const removeEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        event?.preventDefault();
        selectItem(selectedIndex);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    const removeEscape = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        close();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      removeArrowDown();
      removeArrowUp();
      removeEnter();
      removeEscape();
    };
  }, [editor, isOpen, filteredItems.length, selectedIndex, selectItem, close]);

  if (!isOpen || !portalContainer) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Slash menu"
      data-testid="slash-menu"
      style={{
        position: "fixed",
        zIndex: 50,
        width: "256px",
        maxHeight: "320px",
        overflow: "auto",
        borderRadius: "8px",
        border: "1px solid var(--scribex-border, #e2e8f0)",
        backgroundColor: "var(--scribex-background, #ffffff)",
        padding: "4px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        top: `${position.top}px`,
        left: `${position.left}px`,
        fontFamily: "var(--scribex-font-sans, system-ui, sans-serif)",
      }}
    >
      {filteredItems.length === 0 ? (
        <div
          style={{ padding: "8px 12px", fontSize: "14px", color: "#9ca3af" }}
        >
          No results
        </div>
      ) : (
        filteredItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            data-testid={`slash-menu-item-${item.id}`}
            onMouseDown={(e) => {
              e.preventDefault();
              selectItem(index);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              gap: "12px",
              borderRadius: "6px",
              padding: "8px 12px",
              textAlign: "left",
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              backgroundColor:
                index === selectedIndex
                  ? "var(--scribex-muted, #f1f5f9)"
                  : "transparent",
              color: "var(--scribex-foreground, #0f172a)",
            }}
          >
            <item.icon size={18} />
            <div>
              <div style={{ fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                {item.description}
              </div>
            </div>
          </button>
        ))
      )}
    </div>,
    portalContainer,
  );
}

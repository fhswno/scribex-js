"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// REACT DOM
import { createPortal } from "react-dom";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  TextNode,
} from "lexical";

// INTERNAL
import type { EmojiItem } from "../data/emoji-list";
import { DEFAULT_EMOJIS } from "../data/emoji-list";

// ─── Plugin Props ────────────────────────────────────────────────────────────

export interface EmojiPickerPluginProps {
  /** Override the built-in emoji list. */
  emojis?: EmojiItem[];
  /** Max results shown in dropdown (default: 8). */
  maxResults?: number;
  /** Custom render function for each emoji row. */
  renderItem?: (item: EmojiItem, isSelected: boolean) => React.ReactNode;
  /** Custom render function for the dropdown container. */
  renderDropdown?: (props: {
    children: React.ReactNode;
    position: { top: number; left: number };
  }) => React.ReactNode;
}

// ─── Plugin Component ────────────────────────────────────────────────────────

export function EmojiPickerPlugin({
  emojis,
  maxResults = 8,
  renderItem,
  renderDropdown,
}: EmojiPickerPluginProps = {}) {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmojiItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const triggerOffsetRef = useRef<number>(0);
  const emojiList = emojis ?? DEFAULT_EMOJIS;

  // Portal container
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  // Close the dropdown
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
  }, []);

  // Filter emojis by query
  const filterEmojis = useCallback(
    (q: string): EmojiItem[] => {
      if (!q) return [];
      const lower = q.toLowerCase();
      return emojiList
        .filter(
          (e) =>
            e.name.includes(lower) ||
            e.keywords.some((k) => k.includes(lower)),
        )
        .slice(0, maxResults);
    },
    [emojiList, maxResults],
  );

  // Track text changes to detect : trigger and query text
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          if (isOpen) close();
          return;
        }

        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (!$isTextNode(node)) {
          if (isOpen) close();
          return;
        }

        const text = node.getTextContent();
        const offset = anchor.offset;

        // Look backwards from cursor for ':'
        let colonIndex = -1;

        for (let i = offset - 1; i >= 0; i--) {
          const char = text[i];
          if (char === undefined) break;

          if (char === ":") {
            // Valid trigger: at start of text or preceded by whitespace
            if (i === 0 || text[i - 1] === " " || text[i - 1] === "\n") {
              colonIndex = i;
            }
            break;
          }

          // If we hit a space before finding :, stop
          if (char === " " || char === "\n") {
            break;
          }
        }

        if (colonIndex === -1) {
          if (isOpen) close();
          return;
        }

        // Extract query text after :
        const queryText = text.slice(colonIndex + 1, offset);

        // Need at least 1 character to search
        if (queryText.length < 1) {
          if (isOpen) close();
          return;
        }

        // Filter emojis
        const filtered = filterEmojis(queryText);
        if (filtered.length === 0) {
          if (isOpen) close();
          return;
        }

        // Update position from DOM
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setPosition({
            top: rect.bottom + 4,
            left: rect.left,
          });
        }

        triggerOffsetRef.current = colonIndex;
        setQuery(queryText);
        setResults(filtered);
        setSelectedIndex(0);
        setIsOpen(true);
      });
    });
  }, [editor, isOpen, close, filterEmojis]);

  // Select an emoji and replace :query with the emoji character
  const selectItem = useCallback(
    (item: EmojiItem) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (!$isTextNode(node)) return;

        const text = node.getTextContent();
        const offset = anchor.offset;
        const triggerIndex = triggerOffsetRef.current;

        // Text before the :trigger
        const before = text.slice(0, triggerIndex);
        // Text after cursor
        const after = text.slice(offset);

        // Replace with emoji character
        node.setTextContent(before + item.emoji + after);

        // Position cursor after the emoji
        const newOffset = before.length + item.emoji.length;
        node.select(newOffset, newOffset);
      });

      close();
    },
    [editor, close],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const unregisterDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        if (!isOpen || results.length === 0) return false;
        event?.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregisterUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        if (!isOpen || results.length === 0) return false;
        event?.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + results.length) % results.length,
        );
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!isOpen || results.length === 0) return false;
        event?.preventDefault();
        const item = results[selectedIndex];
        if (item) selectItem(item);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregisterTab = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        if (!isOpen || results.length === 0) return false;
        event?.preventDefault();
        const item = results[selectedIndex];
        if (item) selectItem(item);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregisterEscape = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event) => {
        if (!isOpen) return false;
        event?.preventDefault();
        close();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      unregisterDown();
      unregisterUp();
      unregisterEnter();
      unregisterTab();
      unregisterEscape();
    };
  }, [editor, isOpen, results, selectedIndex, selectItem, close]);

  if (!portalContainer || !isOpen || results.length === 0) return null;

  // Custom dropdown render
  if (renderDropdown) {
    return createPortal(
      renderDropdown({
        position,
        children: results.map((item, index) => (
          <div
            key={item.name}
            onMouseDown={(e) => {
              e.preventDefault();
              selectItem(item);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {renderItem ? (
              renderItem(item, index === selectedIndex)
            ) : (
              <DefaultEmojiRow item={item} isSelected={index === selectedIndex} />
            )}
          </div>
        )),
      }),
      portalContainer,
    );
  }

  return createPortal(
    <EmojiDropdown
      items={results}
      selectedIndex={selectedIndex}
      position={position}
      onSelect={selectItem}
      onHover={setSelectedIndex}
      renderItem={renderItem}
    />,
    portalContainer,
  );
}

// ─── Default Emoji Row ──────────────────────────────────────────────────────

function DefaultEmojiRow({
  item,
  isSelected,
}: {
  item: EmojiItem;
  isSelected: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "6px 10px",
        borderRadius: "6px",
        cursor: "pointer",
        backgroundColor: isSelected
          ? "var(--scribex-hover-bg)"
          : "transparent",
        transition: "background-color 0.1s",
      }}
    >
      <span style={{ fontSize: "20px", lineHeight: 1 }}>{item.emoji}</span>
      <span
        style={{
          fontSize: "13px",
          color: "var(--scribex-foreground, #0f172a)",
          fontWeight: isSelected ? 500 : 400,
        }}
      >
        {item.name.replace(/_/g, " ")}
      </span>
    </div>
  );
}

// ─── Dropdown Component ─────────────────────────────────────────────────────

function EmojiDropdown({
  items,
  selectedIndex,
  position,
  onSelect,
  onHover,
  renderItem,
}: {
  items: EmojiItem[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (item: EmojiItem) => void;
  onHover: (index: number) => void;
  renderItem?: (item: EmojiItem, isSelected: boolean) => React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement | undefined;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={listRef}
      data-testid="emoji-picker-dropdown"
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 60,
        minWidth: "220px",
        maxWidth: "320px",
        maxHeight: "280px",
        overflowY: "auto",
        borderRadius: "10px",
        border: "1px solid var(--scribex-border, #e2e8f0)",
        backgroundColor: "var(--scribex-popover-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "var(--scribex-popover-shadow)",
        fontFamily: "var(--scribex-font-sans, system-ui, sans-serif)",
        animation: "scribex-emoji-enter 0.15s ease-out",
        padding: "4px",
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.name}
          data-testid={`emoji-item-${item.name}`}
          role="option"
          aria-selected={index === selectedIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          onMouseEnter={() => onHover(index)}
        >
          {renderItem ? (
            renderItem(item, index === selectedIndex)
          ) : (
            <DefaultEmojiRow item={item} isSelected={index === selectedIndex} />
          )}
        </div>
      ))}

      {/* Animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes scribex-emoji-enter {
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
    </div>
  );
}

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

// TYPES
import type { MentionProvider, MentionItem } from "../types";

// ─── Plugin Props ────────────────────────────────────────────────────────────

interface MentionPluginProps {
  /** One or more mention providers, each with their own trigger character. */
  providers: MentionProvider[];
}

// ─── Plugin Component ────────────────────────────────────────────────────────

export function MentionPlugin({ providers }: MentionPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MentionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const activeProviderRef = useRef<MentionProvider | null>(null);
  const triggerOffsetRef = useRef<number>(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Portal container
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  // Build a set of trigger characters
  const triggers = providers.map((p) => p.trigger);

  // Close the dropdown
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setItems([]);
    setSelectedIndex(0);
    activeProviderRef.current = null;
  }, []);

  // Track text changes to detect trigger characters and query text
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

        // Look backwards from cursor to find a trigger character
        let triggerIndex = -1;
        let matchedTrigger = "";

        for (let i = offset - 1; i >= 0; i--) {
          const char = text[i];
          if (char === undefined) break;

          // Check if this char is a trigger
          if (triggers.includes(char)) {
            // Valid trigger position: at start of text or preceded by whitespace
            if (i === 0 || text[i - 1] === " " || text[i - 1] === "\n") {
              triggerIndex = i;
              matchedTrigger = char;
            }
            break;
          }

          // If we hit a space before finding a trigger, stop looking
          if (char === " " || char === "\n") {
            break;
          }
        }

        if (triggerIndex === -1 || !matchedTrigger) {
          if (isOpen) close();
          return;
        }

        // Extract the query (text between trigger and cursor)
        const queryText = text.slice(triggerIndex + 1, offset);

        // Find the matching provider
        const provider = providers.find((p) => p.trigger === matchedTrigger);
        if (!provider) {
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

        activeProviderRef.current = provider;
        triggerOffsetRef.current = triggerIndex;
        setQuery(queryText);
        setIsOpen(true);

        // Debounced search
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
          provider.onSearch(queryText).then((results) => {
            setItems(results);
            setSelectedIndex(0);
          });
        }, 50);
      });
    });
  }, [editor, isOpen, close, triggers, providers]);

  // Select an item and replace trigger+query with a MentionNode
  const selectItem = useCallback(
    (item: MentionItem) => {
      const provider = activeProviderRef.current;
      if (!provider) return;

      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (!$isTextNode(node)) return;

        const text = node.getTextContent();
        const offset = anchor.offset;

        // Find the trigger in the text
        const triggerIndex = triggerOffsetRef.current;
        const trigger = provider.trigger;

        // Text before trigger
        const before = text.slice(0, triggerIndex);
        // Text after cursor
        const after = text.slice(offset);

        // Create the mention node from the provider
        const mentionNode = provider.onSelect(item);

        if (before === "" && after === "") {
          // The entire text node is the trigger+query — replace it
          node.replace(mentionNode);
        } else {
          // Split: set current node to "before" text, insert mention after it
          node.setTextContent(before);

          // Insert mention after the current node
          node.insertAfter(mentionNode);

          // If there's text after the cursor, create a new text node
          if (after) {
            const afterNode = new TextNode(after);
            mentionNode.insertAfter(afterNode);
          }
        }

        // Move selection after the mention node
        mentionNode.selectNext(0, 0);
      });

      close();
    },
    [editor, close],
  );

  // Keyboard navigation — register at HIGH priority to intercept before editor
  useEffect(() => {
    if (!isOpen) return;

    const unregisterDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        if (!isOpen || items.length === 0) return false;
        event?.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregisterUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        if (!isOpen || items.length === 0) return false;
        event?.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!isOpen || items.length === 0) return false;
        event?.preventDefault();
        const item = items[selectedIndex];
        if (item) selectItem(item);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregisterTab = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        if (!isOpen || items.length === 0) return false;
        event?.preventDefault();
        const item = items[selectedIndex];
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
  }, [editor, isOpen, items, selectedIndex, selectItem, close]);

  if (!portalContainer || !isOpen || items.length === 0) return null;

  return createPortal(
    <MentionDropdown
      items={items}
      selectedIndex={selectedIndex}
      position={position}
      provider={activeProviderRef.current}
      onSelect={selectItem}
      onHover={setSelectedIndex}
    />,
    portalContainer,
  );
}

// ─── Dropdown Component ──────────────────────────────────────────────────────

function MentionDropdown({
  items,
  selectedIndex,
  position,
  provider,
  onSelect,
  onHover,
}: {
  items: MentionItem[];
  selectedIndex: number;
  position: { top: number; left: number };
  provider: MentionProvider | null;
  onSelect: (item: MentionItem) => void;
  onHover: (index: number) => void;
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

  // Determine accent based on trigger
  const trigger = provider?.trigger ?? "@";
  const accentColor =
    trigger === "#"
      ? "var(--scribex-accent, #3b82f6)"
      : "var(--scribex-ai-stream, #7c3aed)";

  return (
    <div
      data-testid="mention-dropdown"
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 60,
        minWidth: "200px",
        maxWidth: "320px",
        maxHeight: "240px",
        overflowY: "auto",
        borderRadius: "10px",
        border: "1px solid var(--scribex-border, #e2e8f0)",
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow:
          "0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)",
        fontFamily: "var(--scribex-font-sans, system-ui, sans-serif)",
        animation: "scribex-mention-enter 0.15s ease-out",
        padding: "4px",
      }}
      ref={listRef}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          data-testid={`mention-item-${item.id}`}
          role="option"
          aria-selected={index === selectedIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          onMouseEnter={() => onHover(index)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 10px",
            borderRadius: "6px",
            cursor: "pointer",
            backgroundColor:
              index === selectedIndex
                ? `color-mix(in srgb, ${accentColor} 8%, transparent)`
                : "transparent",
            transition: "background-color 0.1s",
          }}
        >
          {/* Icon / Avatar */}
          {item.icon && (
            <img
              src={item.icon}
              alt=""
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          )}
          {!item.icon && (
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
                color: accentColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {item.label.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Label + Meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--scribex-foreground, #0f172a)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {provider ? provider.renderItem(item) : item.label}
            </div>
            {item.meta && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--scribex-muted-foreground, #94a3b8)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.meta}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes scribex-mention-enter {
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

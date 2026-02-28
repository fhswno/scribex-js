"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextNode,
} from "lexical";

import { INSERT_CALLOUT_COMMAND } from "../commands";
import { $createCalloutNode, $isCalloutNode } from "../nodes/CalloutNode";
import type { CalloutPreset } from "../data/callout-presets";
import { DEFAULT_CALLOUT_PRESETS } from "../data/callout-presets";
import { DEFAULT_EMOJIS } from "../data/emoji-list";

// ─── Props ──────────────────────────────────────────────────────────────────

interface CalloutPluginProps {
  /** Override the default color presets */
  presets?: CalloutPreset[];
  /** Default emoji for newly created callouts */
  defaultEmoji?: string;
  /** Default color preset for newly created callouts */
  defaultPreset?: string;
}

// ─── Plugin Component ───────────────────────────────────────────────────────

export function CalloutPlugin({
  presets,
  defaultEmoji = "\u{1F4A1}",
  defaultPreset = "default",
}: CalloutPluginProps = {}) {
  const [editor] = useLexicalComposerContext();
  const resolvedPresets = presets ?? DEFAULT_CALLOUT_PRESETS;

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [activeCallout, setActiveCallout] = useState<{
    nodeKey: string;
    emoji: string;
    colorPreset: string;
    rect: DOMRect;
  } | null>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const emojiInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  // ── Register INSERT_CALLOUT_COMMAND ────────────────────────────────────

  useEffect(() => {
    return editor.registerCommand(
      INSERT_CALLOUT_COMMAND,
      (payload: { emoji?: string; colorPreset?: string }) => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const calloutNode = $createCalloutNode({
            emoji: payload.emoji ?? defaultEmoji,
            colorPreset: payload.colorPreset ?? defaultPreset,
          });

          // Add an empty paragraph inside the callout
          const paragraph = $createParagraphNode();
          calloutNode.append(paragraph);

          // Find the current block and replace/insert after it
          const anchor = selection.anchor.getNode();
          let block = anchor as import("lexical").LexicalNode;
          while (block.getParent() && !$isRootNode(block.getParent())) {
            block = block.getParent()!;
          }

          // Remove "/" trigger text if present
          if (anchor instanceof TextNode) {
            const text = anchor.getTextContent();
            if (text.trim() === "/") {
              anchor.remove();
            }
          }

          if ($isRootNode(block)) {
            $getRoot().append(calloutNode);
          } else if (
            "getChildrenSize" in block &&
            typeof block.getChildrenSize === "function" &&
            (block.getChildrenSize as () => number)() === 0
          ) {
            block.replace(calloutNode);
          } else {
            block.insertAfter(calloutNode);
          }

          paragraph.selectStart();
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, defaultEmoji, defaultPreset]);

  // ── Detect active callout via selection changes ───────────────────────

  const checkActiveCallout = useCallback(() => {
    editor.read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        setActiveCallout(null);
        return;
      }

      // Walk up ancestors to find a CalloutNode
      let node = selection.anchor.getNode() as import("lexical").LexicalNode | null;
      while (node) {
        if ($isCalloutNode(node)) {
          const key = node.getKey();
          const domElement = editor.getElementByKey(key);
          if (domElement) {
            const rect = domElement.getBoundingClientRect();
            setActiveCallout({
              nodeKey: key,
              emoji: node.getEmoji(),
              colorPreset: node.getColorPreset(),
              rect,
            });
          }
          return;
        }
        node = node.getParent();
      }
      setActiveCallout(null);
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        checkActiveCallout();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, checkActiveCallout]);

  // Also clear toolbar when editor loses focus (click outside)
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleBlur = (e: FocusEvent) => {
      // Don't clear if focus moved to our toolbar
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest("[data-callout-toolbar]")) return;
      // Small delay to let Lexical's selection update first
      setTimeout(() => {
        setActiveCallout(null);
        setShowEmojiPicker(false);
        setEmojiSearch("");
      }, 100);
    };

    rootElement.addEventListener("blur", handleBlur, true);
    return () => rootElement.removeEventListener("blur", handleBlur, true);
  }, [editor]);

  // ── Escape callout: Enter on empty last paragraph ──────────────────────

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const anchorNode = selection.anchor.getNode();

        // Find the callout ancestor
        let calloutNode: import("lexical").LexicalNode | null = null;
        let current = anchorNode as import("lexical").LexicalNode | null;
        while (current) {
          if ($isCalloutNode(current)) {
            calloutNode = current;
            break;
          }
          current = current.getParent();
        }
        if (!calloutNode || !$isCalloutNode(calloutNode)) return false;

        // Check if we're in the last child paragraph and it's empty
        const lastChild = calloutNode.getLastChild();
        const parentParagraph = $isParagraphNode(anchorNode)
          ? anchorNode
          : anchorNode.getParent();

        if (
          parentParagraph &&
          $isParagraphNode(parentParagraph) &&
          parentParagraph === lastChild &&
          parentParagraph.getTextContent() === ""
        ) {
          // Escape: move this empty paragraph out of the callout
          event?.preventDefault();
          const newParagraph = $createParagraphNode();
          calloutNode.insertAfter(newParagraph);
          parentParagraph.remove();
          newParagraph.selectStart();
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  // ── Escape callout: Arrow Down at end of last child ────────────────────

  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const anchorNode = selection.anchor.getNode();

        // Find the callout ancestor
        let calloutNode: import("lexical").LexicalNode | null = null;
        let current = anchorNode as import("lexical").LexicalNode | null;
        while (current) {
          if ($isCalloutNode(current)) {
            calloutNode = current;
            break;
          }
          current = current.getParent();
        }
        if (!calloutNode || !$isCalloutNode(calloutNode)) return false;

        // Check if cursor is at the very end of the callout
        const lastChild = calloutNode.getLastChild();
        const parentParagraph = $isParagraphNode(anchorNode)
          ? anchorNode
          : anchorNode.getParent();

        if (parentParagraph === lastChild) {
          const textLength = parentParagraph?.getTextContentSize() ?? 0;
          if (selection.anchor.offset >= textLength) {
            // At the end of the last paragraph — move to next sibling or create one
            event.preventDefault();
            const nextSibling = calloutNode.getNextSibling();
            if (nextSibling) {
              if ("selectStart" in nextSibling && typeof nextSibling.selectStart === "function") {
                (nextSibling as import("lexical").ElementNode).selectStart();
              }
            } else {
              const newParagraph = $createParagraphNode();
              calloutNode.insertAfter(newParagraph);
              newParagraph.selectStart();
            }
            return true;
          }
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  // ── Backspace at start of callout → unwrap children out ─────────────

  useEffect(() => {
    const handleBackspace = (event: KeyboardEvent) => {
      const selection = $getSelection();

      // Case 1: NodeSelection containing a callout (e.g. from programmatic select)
      if ($isNodeSelection(selection)) {
        const nodes = selection.getNodes();
        const callout = nodes.find($isCalloutNode);
        if (!callout) return false;

        event.preventDefault();
        const paragraph = $createParagraphNode();
        callout.insertBefore(paragraph);
        callout.remove();
        paragraph.selectStart();
        return true;
      }

      // Case 2: Cursor at offset 0 of the first child inside a callout
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
      if (selection.anchor.offset !== 0) return false;

      const anchorNode = selection.anchor.getNode();

      // Find the callout ancestor
      let calloutNode: import("lexical").LexicalNode | null = null;
      let current = anchorNode as import("lexical").LexicalNode | null;
      while (current) {
        if ($isCalloutNode(current)) {
          calloutNode = current;
          break;
        }
        current = current.getParent();
      }
      if (!calloutNode || !$isCalloutNode(calloutNode)) return false;

      // Only unwrap if cursor is in the first child (or at the very start)
      const firstChild = calloutNode.getFirstChild();
      const parentBlock = $isParagraphNode(anchorNode) ? anchorNode : anchorNode.getParent();
      if (parentBlock !== firstChild) return false;

      // Unwrap: move all children out before the callout, then remove it
      event.preventDefault();
      const children = calloutNode.getChildren();
      for (const child of children) {
        calloutNode.insertBefore(child);
      }
      calloutNode.remove();

      // Restore cursor to start of first unwrapped child
      if (children[0] && "selectStart" in children[0] && typeof children[0].selectStart === "function") {
        (children[0] as import("lexical").ElementNode).selectStart();
      }
      return true;
    };

    const handleDelete = (event: KeyboardEvent) => {
      const selection = $getSelection();
      if (!$isNodeSelection(selection)) return false;

      const nodes = selection.getNodes();
      const callout = nodes.find($isCalloutNode);
      if (!callout) return false;

      event.preventDefault();
      const paragraph = $createParagraphNode();
      callout.insertBefore(paragraph);
      callout.remove();
      paragraph.selectStart();
      return true;
    };

    const u1 = editor.registerCommand(KEY_BACKSPACE_COMMAND, handleBackspace, COMMAND_PRIORITY_LOW);
    const u2 = editor.registerCommand(KEY_DELETE_COMMAND, handleDelete, COMMAND_PRIORITY_LOW);
    return () => { u1(); u2(); };
  }, [editor]);

  // ── Click on emoji span in DOM to open picker ──────────────────────────

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute("data-callout-emoji-display")) {
        e.preventDefault();
        e.stopPropagation();
        setShowEmojiPicker((prev) => !prev);
      }
    };

    rootElement.addEventListener("click", handleClick);
    return () => rootElement.removeEventListener("click", handleClick);
  }, [editor]);

  // Close emoji picker when callout changes
  useEffect(() => {
    if (!activeCallout) {
      setShowEmojiPicker(false);
      setEmojiSearch("");
    }
  }, [activeCallout]);

  // Focus emoji search input when picker opens
  useEffect(() => {
    if (showEmojiPicker && emojiInputRef.current) {
      emojiInputRef.current.focus();
    }
  }, [showEmojiPicker]);

  // ── Change emoji ──────────────────────────────────────────────────────

  const changeEmoji = useCallback(
    (newEmoji: string) => {
      if (!activeCallout) return;
      editor.update(() => {
        const node = $getNodeByKey(activeCallout.nodeKey);
        if ($isCalloutNode(node)) {
          node.setEmoji(newEmoji);
        }
      });
      setActiveCallout((prev) => (prev ? { ...prev, emoji: newEmoji } : null));
      setShowEmojiPicker(false);
      setEmojiSearch("");
      editor.focus();
    },
    [editor, activeCallout],
  );

  // ── Change color preset ───────────────────────────────────────────────

  const changePreset = useCallback(
    (presetId: string) => {
      if (!activeCallout) return;
      editor.update(() => {
        const node = $getNodeByKey(activeCallout.nodeKey);
        if ($isCalloutNode(node)) {
          node.setColorPreset(presetId);
        }
      });
      setActiveCallout((prev) => (prev ? { ...prev, colorPreset: presetId } : null));
      editor.focus();
    },
    [editor, activeCallout],
  );

  // ── Delete callout (unwrap children) ──────────────────────────────────

  const deleteCallout = useCallback(() => {
    if (!activeCallout) return;
    editor.update(() => {
      const node = $getNodeByKey(activeCallout.nodeKey);
      if ($isCalloutNode(node)) {
        const children = node.getChildren();
        const parent = node.getParent();
        if (parent) {
          for (const child of children) {
            node.insertBefore(child);
          }
        }
        node.remove();
      }
    });
    setActiveCallout(null);
    editor.focus();
  }, [editor, activeCallout]);

  // ── Filter emojis ─────────────────────────────────────────────────────

  const filteredEmojis = emojiSearch.trim()
    ? DEFAULT_EMOJIS.filter(
        (e) =>
          e.name.includes(emojiSearch.toLowerCase()) ||
          e.keywords.some((k) => k.includes(emojiSearch.toLowerCase())),
      ).slice(0, 40)
    : DEFAULT_EMOJIS.slice(0, 40);

  // ─── Render ───────────────────────────────────────────────────────────

  if (!portalContainer || !activeCallout) return null;

  const { rect } = activeCallout;

  // Position toolbar at top-right of callout, clamped to viewport
  const toolbarWidth = 240;
  const toolbarLeft = Math.min(rect.right - toolbarWidth, window.innerWidth - toolbarWidth - 16);
  const emojiPickerWidth = 280;
  const emojiPickerLeft = Math.min(toolbarLeft, window.innerWidth - emojiPickerWidth - 16);

  return createPortal(
    <div data-callout-toolbar>
      {/* ── Callout toolbar ─────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: `${rect.top + 6}px`,
          left: `${toolbarLeft}px`,
          display: "flex",
          alignItems: "center",
          gap: "3px",
          padding: "3px",
          borderRadius: "8px",
          border: "1px solid var(--scribex-popover-border)",
          backgroundColor: "var(--scribex-popover-bg)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow: "var(--scribex-popover-shadow)",
          zIndex: 50,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* Emoji button */}
        <button
          type="button"
          title="Change emoji"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowEmojiPicker((prev) => !prev);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "26px",
            height: "26px",
            borderRadius: "5px",
            border: "none",
            cursor: "pointer",
            backgroundColor: showEmojiPicker ? "var(--scribex-hover-bg)" : "transparent",
            fontSize: "14px",
            transition: "background-color 80ms",
          }}
        >
          {activeCallout.emoji}
        </button>

        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: "16px",
            backgroundColor: "var(--scribex-separator)",
            margin: "0 1px",
          }}
        />

        {/* Color preset dots */}
        {resolvedPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            onMouseDown={(e) => {
              e.preventDefault();
              changePreset(preset.id);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border:
                activeCallout.colorPreset === preset.id
                  ? "2px solid var(--scribex-accent, #007AFF)"
                  : "2px solid transparent",
              cursor: "pointer",
              padding: "0",
              backgroundColor: "transparent",
              transition: "border-color 80ms",
            }}
          >
            <span
              style={{
                display: "block",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: preset.bgSwatch,
                border: `1.5px solid ${preset.borderSwatch}`,
              }}
            />
          </button>
        ))}

        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: "16px",
            backgroundColor: "var(--scribex-separator)",
            margin: "0 1px",
          }}
        />

        {/* Delete button */}
        <button
          type="button"
          title="Remove callout"
          onMouseDown={(e) => {
            e.preventDefault();
            deleteCallout();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "26px",
            height: "26px",
            borderRadius: "5px",
            border: "none",
            cursor: "pointer",
            backgroundColor: "transparent",
            color: "var(--scribex-text-tertiary)",
            fontSize: "14px",
            transition: "background-color 80ms, color 80ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--scribex-hover-bg)";
            e.currentTarget.style.color = "var(--scribex-destructive, #e03e3e)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--scribex-text-tertiary)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>

      {/* ── Emoji picker popover ────────────────────────────────── */}
      {showEmojiPicker && (
        <div
          data-callout-toolbar
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: "fixed",
            top: `${rect.top + 38}px`,
            left: `${emojiPickerLeft}px`,
            width: `${emojiPickerWidth}px`,
            borderRadius: "10px",
            border: "1px solid var(--scribex-popover-border)",
            backgroundColor: "var(--scribex-popover-bg)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            boxShadow: "var(--scribex-popover-shadow)",
            zIndex: 60,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
          }}
        >
          {/* Search input */}
          <div style={{ padding: "8px 8px 4px" }}>
            <input
              ref={emojiInputRef}
              type="text"
              placeholder="Search emoji..."
              value={emojiSearch}
              onChange={(e) => setEmojiSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowEmojiPicker(false);
                  setEmojiSearch("");
                  editor.focus();
                }
                if (e.key === "Enter" && filteredEmojis.length > 0) {
                  changeEmoji(filteredEmojis[0]!.emoji);
                }
              }}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px solid var(--scribex-popover-border)",
                fontSize: "13px",
                outline: "none",
                backgroundColor: "transparent",
              }}
            />
          </div>

          {/* Emoji grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: "2px",
              padding: "4px 8px 8px",
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            {filteredEmojis.map((item) => (
              <button
                key={item.name}
                type="button"
                title={item.name.replace(/_/g, " ")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  changeEmoji(item.emoji);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "5px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  fontSize: "16px",
                  transition: "background-color 60ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--scribex-hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    portalContainer,
  );
}

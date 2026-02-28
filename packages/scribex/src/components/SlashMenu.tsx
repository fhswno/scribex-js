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

// PHOSPHOR ICONS — Duotone wrappers for the slash menu
import {
  TextHOneIcon,
  TextHTwoIcon,
  TextHThreeIcon,
  QuotesIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  CheckSquareIcon,
  MinusSquareIcon,
  ImageSquareIcon,
  SparkleIcon,
  CodeSimpleIcon,
  TableIcon,
  InfoIcon,
  SmileyIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";

// COMMANDS
import {
  OPEN_SLASH_MENU_COMMAND,
  INSERT_IMAGE_COMMAND,
  OPEN_AI_PROMPT_COMMAND,
  OPEN_EMOJI_PICKER_COMMAND,
  INSERT_TABLE_COMMAND_SCRIBEX,
  INSERT_CALLOUT_COMMAND,
  OPEN_VIDEO_INPUT_COMMAND,
} from "../commands";

import { $createCodeBlockNode } from "../nodes/CodeBlockNode";
import { $createHorizontalRuleNode } from "../nodes/HorizontalRuleNode";

// ── Duotone icon wrappers (stable references, no re-creation) ───────────────

const IconH1 = ({ size }: { size?: number }) => (
  <TextHOneIcon size={size} weight="duotone" />
);
const IconH2 = ({ size }: { size?: number }) => (
  <TextHTwoIcon size={size} weight="duotone" />
);
const IconH3 = ({ size }: { size?: number }) => (
  <TextHThreeIcon size={size} weight="duotone" />
);
const IconQuote = ({ size }: { size?: number }) => (
  <QuotesIcon size={size} weight="duotone" />
);
const IconBulletList = ({ size }: { size?: number }) => (
  <ListBulletsIcon size={size} weight="duotone" />
);
const IconNumberedList = ({ size }: { size?: number }) => (
  <ListNumbersIcon size={size} weight="duotone" />
);
const IconDivider = ({ size }: { size?: number }) => (
  <MinusSquareIcon size={size} weight="duotone" />
);
const IconImage = ({ size }: { size?: number }) => (
  <ImageSquareIcon size={size} weight="duotone" />
);
const IconCode = ({ size }: { size?: number }) => (
  <CodeSimpleIcon size={size} weight="duotone" />
);
const IconAI = ({ size }: { size?: number }) => (
  <SparkleIcon size={size} weight="duotone" />
);
const IconTable = ({ size }: { size?: number }) => (
  <TableIcon size={size} weight="duotone" />
);
const IconCallout = ({ size }: { size?: number }) => (
  <InfoIcon size={size} weight="duotone" />
);
const IconEmoji = ({ size }: { size?: number }) => (
  <SmileyIcon size={size} weight="duotone" />
);
const IconVideo = ({ size }: { size?: number }) => (
  <VideoCameraIcon size={size} weight="duotone" />
);
const IconChecklist = ({ size }: { size?: number }) => (
  <CheckSquareIcon size={size} weight="duotone" />
);

// ── Public interface ────────────────────────────────────────────────────────

export interface SlashMenuItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  onSelect: () => void;
  /** Extra search terms (e.g. "h1" for "Heading 1") */
  keywords?: string[];
}

// ── Markdown shortcut hints (shown on the right of each item) ───────────────

const SHORTCUT_HINTS: Record<string, string> = {
  "heading-1": "#",
  "heading-2": "##",
  "heading-3": "###",
  quote: ">",
  "bullet-list": "-",
  "numbered-list": "1.",
  "check-list": "[]",
  divider: "---",
  code: "```",
};

// ── Category color system ───────────────────────────────────────────────────

interface CategoryStyle {
  bg: string;
  icon: string;
}

const CATEGORY_COLORS: Record<string, CategoryStyle> = {
  ai: { bg: "var(--scribex-muted)", icon: "#3366CC" },
  headings: { bg: "var(--scribex-muted)", icon: "#6366F1" },
  blocks: { bg: "var(--scribex-muted)", icon: "#8B5CF6" },
  lists: { bg: "var(--scribex-muted)", icon: "#10B981" },
  media: { bg: "var(--scribex-muted)", icon: "#F59E0B" },
  other: { bg: "var(--scribex-muted)", icon: "#6B7280" },
};

function getCategoryForId(id: string): string {
  if (id === "ai") return "ai";
  if (id.startsWith("heading")) return "headings";
  if (id === "quote" || id === "divider" || id === "code" || id === "table" || id === "callout") return "blocks";
  if (id === "bullet-list" || id === "numbered-list" || id === "check-list")
    return "lists";
  if (id === "image" || id === "emoji" || id === "video") return "media";
  return "other";
}

// ── Injected CSS for animations ─────────────────────────────────────────────

const SLASH_MENU_STYLES = `
@keyframes scribex-menu-enter {
  from {
    opacity: 0;
    transform: scale(0.98) translateY(3px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@keyframes scribex-icon-lift {
  0%, 100% { transform: translateY(0) scale(1); }
  40% { transform: translateY(-2px) scale(1.08); }
  70% { transform: translateY(0.5px) scale(0.98); }
}
[data-testid="slash-menu"]::-webkit-scrollbar {
  display: none;
}
`;

// ── Default items factory ───────────────────────────────────────────────────

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
      id: "ai",
      label: "Ask AI",
      description: "Generate content with AI",
      icon: IconAI,
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
        // Then open the AI prompt input
        editor.dispatchCommand(OPEN_AI_PROMPT_COMMAND, undefined);
      },
    },
    {
      id: "heading-1",
      label: "Heading 1",
      description: "Large heading",
      keywords: ["h1"],
      icon: IconH1,
      onSelect: () => replaceCurrentBlock(() => $createHeadingNode("h1")),
    },
    {
      id: "heading-2",
      label: "Heading 2",
      description: "Medium heading",
      keywords: ["h2"],
      icon: IconH2,
      onSelect: () => replaceCurrentBlock(() => $createHeadingNode("h2")),
    },
    {
      id: "heading-3",
      label: "Heading 3",
      description: "Small heading",
      keywords: ["h3"],
      icon: IconH3,
      onSelect: () => replaceCurrentBlock(() => $createHeadingNode("h3")),
    },
    {
      id: "quote",
      label: "Quote",
      description: "Blockquote",
      icon: IconQuote,
      onSelect: () => replaceCurrentBlock(() => $createQuoteNode()),
    },
    {
      id: "bullet-list",
      label: "Bullet List",
      description: "Unordered list",
      icon: IconBulletList,
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
      icon: IconNumberedList,
      onSelect: () =>
        replaceCurrentBlock(() => {
          const list = $createListNode("number");
          const item = $createListItemNode();
          list.append(item);
          return list;
        }),
    },
    {
      id: "check-list",
      label: "Checklist",
      description: "Task list with checkboxes",
      keywords: ["todo", "task", "checkbox", "check"],
      icon: IconChecklist,
      onSelect: () =>
        replaceCurrentBlock(() => {
          const list = $createListNode("check");
          const item = $createListItemNode();
          list.append(item);
          return list;
        }),
    },
    {
      id: "divider",
      label: "Divider",
      description: "Horizontal rule",
      icon: IconDivider,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();

          let block: import("lexical").LexicalNode = anchor;
          while (block.getParent() && !$isRootNode(block.getParent())) {
            block = block.getParent()!;
          }

          if (anchor instanceof TextNode) {
            anchor.remove();
          }

          const rule = $createHorizontalRuleNode();
          const trailingParagraph = $createParagraphNode();

          if ($isRootNode(block)) {
            const root = $getRoot();
            root.append(rule);
            root.append(trailingParagraph);
          } else if (
            "getChildrenSize" in block &&
            typeof block.getChildrenSize === "function" &&
            (block.getChildrenSize as () => number)() === 0
          ) {
            block.replace(rule);
            rule.insertAfter(trailingParagraph);
          } else {
            block.insertAfter(rule);
            rule.insertAfter(trailingParagraph);
          }
          trailingParagraph.selectEnd();
        });
      },
    },
    {
      id: "code",
      label: "Code Block",
      description: "Syntax highlighted code",
      icon: IconCode,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();

          let block: import("lexical").LexicalNode = anchor;
          while (block.getParent() && !$isRootNode(block.getParent())) {
            block = block.getParent()!;
          }

          if (anchor instanceof TextNode) {
            anchor.remove();
          }

          const codeBlock = $createCodeBlockNode({ code: "", language: "javascript", autoFocus: true });
          const trailingParagraph = $createParagraphNode();
          if ($isRootNode(block)) {
            $getRoot().append(codeBlock);
          } else if (
            "getChildrenSize" in block &&
            typeof block.getChildrenSize === "function" &&
            (block.getChildrenSize as () => number)() === 0
          ) {
            block.replace(codeBlock);
          } else {
            block.insertAfter(codeBlock);
          }
          codeBlock.insertAfter(trailingParagraph);
          trailingParagraph.selectEnd();
        });
      },
    },
    {
      id: "table",
      label: "Table",
      description: "Insert a table",
      icon: IconTable,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();
          if (anchor instanceof TextNode) {
            anchor.remove();
          }
        });
        editor.dispatchCommand(INSERT_TABLE_COMMAND_SCRIBEX, {
          rows: 3,
          columns: 3,
        });
      },
    },
    {
      id: "callout",
      label: "Callout",
      description: "Highlighted block with icon",
      icon: IconCallout,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();
          if (anchor instanceof TextNode) {
            anchor.remove();
          }
        });
        editor.dispatchCommand(INSERT_CALLOUT_COMMAND, {});
      },
    },
    {
      id: "image",
      label: "Image",
      description: "Upload an image",
      icon: IconImage,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();
          if (anchor instanceof TextNode) {
            anchor.remove();
          }
        });
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
    {
      id: "emoji",
      label: "Emoji",
      description: "Insert an emoji",
      keywords: ["smiley", "face", "emoticon"],
      icon: IconEmoji,
      onSelect: () => {
        // Remove the "/" trigger text, then open the emoji picker via command
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();
          if (anchor instanceof TextNode) {
            anchor.remove();
          }
        });
        editor.dispatchCommand(OPEN_EMOJI_PICKER_COMMAND, undefined);
      },
    },
    {
      id: "video",
      label: "Video",
      description: "Embed or upload a video",
      keywords: ["youtube", "vimeo", "loom", "embed", "movie", "clip"],
      icon: IconVideo,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();
          if (anchor instanceof TextNode) {
            anchor.remove();
          }
        });
        editor.dispatchCommand(OPEN_VIDEO_INPUT_COMMAND, undefined);
      },
    },
  ];
}

// ── Item grouping ───────────────────────────────────────────────────────────

interface ItemGroup {
  label: string;
  category: string;
  items: SlashMenuItem[];
}

function groupItems(items: SlashMenuItem[]): ItemGroup[] {
  const buckets: Record<string, SlashMenuItem[]> = {};
  const categoryLabels: Record<string, string> = {
    ai: "AI",
    headings: "Headings",
    blocks: "Blocks",
    lists: "Lists",
    media: "Media",
    other: "Other",
  };
  const order = ["ai", "headings", "blocks", "lists", "media", "other"];

  for (const item of items) {
    const cat = getCategoryForId(item.id);
    if (!buckets[cat]) buckets[cat] = [];
    buckets[cat]!.push(item);
  }

  const groups: ItemGroup[] = [];
  for (const cat of order) {
    const bucket = buckets[cat];
    if (bucket && bucket.length > 0) {
      groups.push({
        label: categoryLabels[cat] ?? cat,
        category: cat,
        items: bucket,
      });
    }
  }
  return groups;
}

// ── Component ───────────────────────────────────────────────────────────────

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
    ? allItems.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.keywords?.some((kw) => kw.toLowerCase().includes(q)) ||
          false
        );
      })
    : allItems;

  // Group and flatten for sectioned display
  const groupedItems = groupItems(filteredItems);
  const flatItems: SlashMenuItem[] = [];
  for (const group of groupedItems) {
    for (const item of group.items) {
      flatItems.push(item);
    }
  }

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const selectItem = useCallback(
    (index: number) => {
      const item = flatItems[index];
      if (item) {
        close();
        item.onSelect();
      }
    },
    [flatItems, close],
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
          top: rect.bottom + 6,
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

  // Track text typed after "/"
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
        setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
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
  }, [editor, isOpen, flatItems.length, selectedIndex, selectItem, close]);

  // Auto-scroll the selected item into view
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const selected = menuRef.current.querySelector(
      '[aria-selected="true"]',
    ) as HTMLElement | null;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, selectedIndex]);

  if (!isOpen || !portalContainer) return null;

  let flatIndex = 0;

  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Slash menu"
      data-testid="slash-menu"
      style={{
        position: "fixed",
        zIndex: 50,
        width: "248px",
        maxHeight: "min(380px, 60vh)",
        overflow: "auto",
        borderRadius: "12px",
        border: "1px solid var(--scribex-popover-border)",
        backgroundColor: "var(--scribex-popover-bg)",
        backdropFilter: "blur(24px) saturate(190%)",
        WebkitBackdropFilter: "blur(24px) saturate(190%)",
        padding: "6px",
        boxShadow: "var(--scribex-popover-shadow)",
        top: `${position.top}px`,
        left: `${position.left}px`,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
        letterSpacing: "-0.01em",
        animation: "scribex-menu-enter 180ms cubic-bezier(0.2, 0.9, 0.3, 1)",
        scrollbarWidth: "none" as const,
        msOverflowStyle: "none" as const,
      }}
    >
      <style>{SLASH_MENU_STYLES}</style>

      {flatItems.length === 0 ? (
        <div
          style={{
            padding: "20px 12px",
            fontSize: "12.5px",
            color: "var(--scribex-text-tertiary)",
            textAlign: "center",
            fontWeight: 400,
          }}
        >
          No matching commands
        </div>
      ) : (
        groupedItems.map((group, groupIdx) => (
          <div key={group.label}>
            {/* Section separator */}
            {groupIdx > 0 && (
              <div
                style={{
                  height: "0.5px",
                  backgroundColor: "var(--scribex-separator)",
                  margin: "4px 10px",
                }}
              />
            )}

            {/* Section header — only when not filtering */}
            {!query && (
              <div
                style={{
                  padding: "7px 10px 4px",
                  fontSize: "10.5px",
                  fontWeight: 600,
                  color: "var(--scribex-text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  userSelect: "none",
                }}
              >
                {group.label}
              </div>
            )}

            {group.items.map((item) => {
              const idx = flatIndex++;
              const isActive = idx === selectedIndex;
              const category = getCategoryForId(item.id);
              const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other!;
              const shortcut = SHORTCUT_HINTS[item.id];

              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-testid={`slash-menu-item-${item.id}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectItem(idx);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: "10px",
                    borderRadius: "8px",
                    padding: "5px 8px",
                    textAlign: "left",
                    fontSize: "13px",
                    border: "none",
                    cursor: "default",
                    backgroundColor: isActive
                      ? "var(--scribex-accent, #007AFF)"
                      : "transparent",
                    color: isActive
                      ? "var(--scribex-accent-foreground, #fff)"
                      : "var(--scribex-foreground, #1d1d1f)",
                    transition: "background-color 80ms ease",
                  }}
                >
                  {/* Icon tile */}
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "7px",
                      background: isActive
                        ? "rgba(255, 255, 255, 0.2)"
                        : colors.bg,
                      flexShrink: 0,
                      color: isActive ? "var(--scribex-accent-foreground, #fff)" : colors.icon,
                      animation: isActive
                        ? "scribex-icon-lift 400ms cubic-bezier(0.34, 1.56, 0.64, 1)"
                        : "none",
                    }}
                  >
                    <item.icon size={16} />
                  </div>

                  {/* Label */}
                  <div
                    style={{
                      flex: 1,
                      fontWeight: 450,
                      lineHeight: "18px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.label}
                  </div>

                  {/* Markdown shortcut hint */}
                  {shortcut && (
                    <div
                      style={{
                        fontSize: "10.5px",
                        fontFamily:
                          '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
                        fontWeight: 400,
                        color: isActive
                          ? "var(--scribex-accent-foreground, rgba(255, 255, 255, 0.55))"
                          : "var(--scribex-text-tertiary)",
                        flexShrink: 0,
                        paddingRight: "2px",
                      }}
                    >
                      {shortcut}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>,
    portalContainer,
  );
}

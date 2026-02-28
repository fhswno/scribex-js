// LEXICAL
import type { LexicalNode, ElementNode } from "lexical";
import {
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  $isTextNode,
} from "lexical";
import { $createHeadingNode, $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import { $createQuoteNode } from "@lexical/rich-text";
import {
  $createListItemNode,
  $createListNode,
  $isListNode,
  $isListItemNode,
} from "@lexical/list";
import { $isImageNode } from "../nodes/ImageNode";
import { $isVideoNode } from "../nodes/VideoNode";
import { $isLinkNode } from "@lexical/link";
import {
  $isTableNode,
  $isTableRowNode,
  $isTableCellNode,
} from "@lexical/table";
import { $isCalloutNode } from "../nodes/CalloutNode";
import { $isHorizontalRuleNode } from "../nodes/HorizontalRuleNode";

// ─── Lexical → Markdown (context building) ───────────────────────────────────

/**
 * Serializes an array of Lexical nodes to Markdown.
 * Pure function — call inside editor.read().
 */
export function serializeNodesToMarkdown(nodes: LexicalNode[]): string {
  const lines: string[] = [];

  for (const node of nodes) {
    lines.push(serializeNode(node));
  }

  return lines.join("\n\n");
}

function serializeNode(node: LexicalNode): string {
  // Heading
  if ($isHeadingNode(node)) {
    const tag = node.getTag();
    const level = parseInt(tag.replace("h", ""), 10);
    const prefix = "#".repeat(level);
    return `${prefix} ${serializeChildren(node)}`;
  }

  // Blockquote
  if ($isQuoteNode(node)) {
    return `> ${serializeChildren(node)}`;
  }

  // List
  if ($isListNode(node)) {
    const listType = node.getListType();
    const items = node.getChildren();
    return items
      .map((item, i) => {
        const content = $isElementNode(item)
          ? serializeChildren(item)
          : item.getTextContent();
        const prefix = listType === "number" ? `${i + 1}. ` : "- ";
        return `${prefix}${content}`;
      })
      .join("\n");
  }

  // Image
  if ($isImageNode(node)) {
    return `![${node.getAltText()}](${node.getSrc()})`;
  }

  // Video
  if ($isVideoNode(node)) {
    const title = node.getTitle() || "Video";
    return `[${title}](${node.getSrc()})`;
  }

  // Horizontal rule
  if ($isHorizontalRuleNode(node)) {
    return "---";
  }

  // Table → pipe-delimited markdown
  if ($isTableNode(node)) {
    const rows = node.getChildren();
    const lines: string[] = [];

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row || !$isTableRowNode(row)) continue;

      const cells = row.getChildren();
      const cellTexts: string[] = [];

      for (const cell of cells) {
        if ($isTableCellNode(cell)) {
          cellTexts.push(serializeChildren(cell).replace(/\|/g, "\\|"));
        }
      }

      lines.push(`| ${cellTexts.join(" | ")} |`);

      // Add separator after first row
      if (rowIdx === 0) {
        lines.push(`| ${cellTexts.map(() => "---").join(" | ")} |`);
      }
    }

    return lines.join("\n");
  }

  // Callout → GitHub-flavored callout syntax
  if ($isCalloutNode(node)) {
    const emoji = node.getEmoji();
    const childContent = node
      .getChildren()
      .map((child) => {
        if ($isElementNode(child)) {
          return serializeChildren(child);
        }
        return child.getTextContent();
      })
      .join("\n> ");
    return `> [!${emoji}] ${childContent}`;
  }

  // Element with children (paragraph, etc.)
  if ($isElementNode(node)) {
    return serializeChildren(node);
  }

  // Fallback: plain text
  return node.getTextContent();
}

function serializeChildren(node: ElementNode): string {
  const children = node.getChildren();
  let result = "";

  for (const child of children) {
    if ($isTextNode(child)) {
      let text = child.getTextContent();
      const format = child.getFormat();

      // Bold (bit 0)
      if (format & 1) text = `**${text}**`;
      // Italic (bit 1)
      if (format & 2) text = `*${text}*`;
      // Strikethrough (bit 2)
      if (format & 4) text = `~~${text}~~`;
      // Underline (bit 3) — no Markdown equivalent, skip
      // Code (bit 4)
      if (format & 16) text = `\`${text}\``;

      result += text;
    } else if ($isLinkNode(child)) {
      const linkText = serializeChildren(child);
      const url = child.getURL();
      result += `[${linkText}](${url})`;
    } else if ($isElementNode(child)) {
      result += serializeChildren(child);
    } else {
      result += child.getTextContent();
    }
  }

  return result;
}

// ─── Markdown → Lexical (accept flow) ────────────────────────────────────────

/**
 * Parses a Markdown string into Lexical nodes.
 * Must be called inside editor.update() — creates Lexical nodes that require
 * an active editor context.
 */
export function $parseMarkdownToLexicalNodes(
  markdown: string,
): LexicalNode[] {
  const blocks = markdown.split(/\n\n+/);
  const nodes: LexicalNode[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const tag = `h${Math.min(level, 6)}` as
        | "h1"
        | "h2"
        | "h3"
        | "h4"
        | "h5"
        | "h6";
      const heading = $createHeadingNode(tag);
      heading.append(...$parseInlineMarkdown(headingMatch[2]!));
      nodes.push(heading);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      const quote = $createQuoteNode();
      const content = trimmed
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join(" ");
      quote.append(...$parseInlineMarkdown(content));
      nodes.push(quote);
      continue;
    }

    // List items
    const lines = trimmed.split("\n");
    const isBullet = lines.every((l) => /^[-*]\s/.test(l));
    const isNumbered = lines.every((l) => /^\d+\.\s/.test(l));

    if (isBullet || isNumbered) {
      const list = $createListNode(isBullet ? "bullet" : "number");
      for (const line of lines) {
        const content = line.replace(/^[-*]\s|^\d+\.\s/, "");
        const item = $createListItemNode();
        item.append(...$parseInlineMarkdown(content));
        list.append(item);
      }
      nodes.push(list);
      continue;
    }

    // Default: paragraph
    const paragraph = $createParagraphNode();
    paragraph.append(...$parseInlineMarkdown(trimmed));
    nodes.push(paragraph);
  }

  return nodes;
}

/**
 * Parses inline Markdown formatting into TextNode instances with format bitmasks.
 * Handles: **bold**, *italic*, `code`, ~~strikethrough~~
 */
function $parseInlineMarkdown(text: string): LexicalNode[] {
  const nodes: LexicalNode[] = [];

  // Regex that matches inline formatting tokens
  // Order matters: ** before *, ~~ before ~
  const pattern =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add plain text before the match
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain) {
        nodes.push($createTextNode(plain));
      }
    }

    if (match[2] != null) {
      // **bold**
      const node = $createTextNode(match[2]);
      node.setFormat(1); // bold
      nodes.push(node);
    } else if (match[3] != null) {
      // *italic*
      const node = $createTextNode(match[3]);
      node.setFormat(2); // italic
      nodes.push(node);
    } else if (match[4] != null) {
      // `code`
      const node = $createTextNode(match[4]);
      node.setFormat(16); // code
      nodes.push(node);
    } else if (match[5] != null) {
      // ~~strikethrough~~
      const node = $createTextNode(match[5]);
      node.setFormat(4); // strikethrough
      nodes.push(node);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      nodes.push($createTextNode(remaining));
    }
  }

  // If no nodes were created, create a single text node
  if (nodes.length === 0) {
    nodes.push($createTextNode(text));
  }

  return nodes;
}

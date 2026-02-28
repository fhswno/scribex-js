"use client";

// REACT
import { useEffect } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TextNode, $createParagraphNode } from "lexical";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $createListNode, $createListItemNode } from "@lexical/list";
import { $createCodeBlockNode } from "../nodes/CodeBlockNode";
import { $createHorizontalRuleNode } from "../nodes/HorizontalRuleNode";

// COMMANDS
import { OPEN_SLASH_MENU_COMMAND } from "../commands";

// TYPES
import type { InputRule } from "../types";

/**
 * Built-in rules. Note: onMatch runs inside a node transform, which is already
 * within an editor.update() context. Do NOT wrap mutations in editor.update()
 * here — that would be a nested update (see CLAUDE.md Section 7.1).
 */
const BUILTIN_RULES: InputRule[] = [
  {
    pattern: /^# $/,
    type: "heading",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const heading = $createHeadingNode("h1");
      parent.replace(heading);
      heading.selectEnd();
    },
  },
  {
    pattern: /^## $/,
    type: "heading",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const heading = $createHeadingNode("h2");
      parent.replace(heading);
      heading.selectEnd();
    },
  },
  {
    pattern: /^### $/,
    type: "heading",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const heading = $createHeadingNode("h3");
      parent.replace(heading);
      heading.selectEnd();
    },
  },
  {
    pattern: /^> $/,
    type: "quote",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const quote = $createQuoteNode();
      parent.replace(quote);
      quote.selectEnd();
    },
  },
  {
    pattern: /^[-*] $/,
    type: "custom",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const list = $createListNode("bullet");
      const item = $createListItemNode();
      list.append(item);
      parent.replace(list);
      item.selectEnd();
    },
  },
  {
    pattern: /^1\. $/,
    type: "custom",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const list = $createListNode("number");
      const item = $createListItemNode();
      list.append(item);
      parent.replace(list);
      item.selectEnd();
    },
  },
  {
    pattern: /^\[\] $/,
    type: "custom",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const list = $createListNode("check");
      const item = $createListItemNode();
      list.append(item);
      parent.replace(list);
      item.selectEnd();
    },
  },
  {
    pattern: /^\[x\] $/,
    type: "custom",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const list = $createListNode("check");
      const item = $createListItemNode(true);
      list.append(item);
      parent.replace(list);
      item.selectEnd();
    },
  },
  {
    pattern: /^---$/,
    type: "divider",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const rule = $createHorizontalRuleNode();
      const trailingParagraph = $createParagraphNode();
      parent.replace(rule);
      rule.insertAfter(trailingParagraph);
      trailingParagraph.selectEnd();
    },
  },
  {
    pattern: /^```$/,
    type: "code",
    onMatch: (_match, node) => {
      const parent = node.getParent();
      if (!parent) return;
      const codeBlock = $createCodeBlockNode({ code: "", language: "javascript", autoFocus: true });
      // DecoratorNodes can't hold a cursor, so insert a trailing paragraph
      // to prevent the "selection lost" error. The autoFocus flag on the
      // CodeBlockNode will focus the textarea once it mounts.
      const trailingParagraph = $createParagraphNode();
      parent.replace(codeBlock);
      codeBlock.insertAfter(trailingParagraph);
      trailingParagraph.selectEnd();
    },
  },
];

interface InputRulePluginProps {
  rules?: InputRule[];
}

export function InputRulePlugin({ rules = [] }: InputRulePluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const allRules = [...BUILTIN_RULES, ...rules];

    return editor.registerNodeTransform(TextNode, (textNode) => {
      // IME safety: skip transforms during composition
      const editorWithComposition = editor as unknown as {
        _compositionKey: string | null;
      };
      if (editorWithComposition._compositionKey !== null) return;

      const text = textNode.getTextContent();

      // Slash menu trigger: "/" at start of an otherwise empty paragraph
      if (text === "/") {
        const parent = textNode.getParent();
        if (parent && parent.getChildrenSize() === 1) {
          // Dispatch needs to happen outside the transform — defer with queueMicrotask
          queueMicrotask(() => {
            editor.dispatchCommand(OPEN_SLASH_MENU_COMMAND, undefined);
          });
          return;
        }
      }

      // Check against all registered rules
      for (const rule of allRules) {
        const match = text.match(rule.pattern);
        if (match) {
          // Remove trigger text, then call onMatch (already in update context)
          textNode.setTextContent("");
          rule.onMatch(match, textNode, editor);
          return;
        }
      }
    });
  }, [editor, rules]);

  return null;
}

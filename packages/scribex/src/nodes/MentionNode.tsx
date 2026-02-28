"use client";

// REACT
import { useCallback } from "react";
import type { ReactElement } from "react";

// LEXICAL
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  COMMAND_PRIORITY_LOW,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MentionPayload {
  id: string;
  label: string;
  trigger: string;
  key?: NodeKey;
}

export type SerializedMentionNode = Spread<
  {
    mentionId: string;
    label: string;
    trigger: string;
  },
  SerializedLexicalNode
>;

// ─── Node Class ──────────────────────────────────────────────────────────────

export class MentionNode extends DecoratorNode<ReactElement> {
  __mentionId: string;
  __label: string;
  __trigger: string;

  static getType(): string {
    return "mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(
      node.__mentionId,
      node.__label,
      node.__trigger,
      node.__key,
    );
  }

  constructor(
    mentionId: string,
    label: string,
    trigger: string,
    key?: NodeKey,
  ) {
    super(key);
    this.__mentionId = mentionId;
    this.__label = label;
    this.__trigger = trigger;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const span = document.createElement("span");
    span.setAttribute("data-mention-id", this.__mentionId);
    span.setAttribute("data-mention-trigger", this.__trigger);
    span.textContent = `${this.__trigger}${this.__label}`;
    return { element: span };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-mention-id")) return null;
        return {
          conversion: (element: HTMLElement): DOMConversionOutput | null => {
            const mentionId = element.getAttribute("data-mention-id");
            const trigger =
              element.getAttribute("data-mention-trigger") ?? "@";
            const label = element.textContent?.replace(trigger, "") ?? "";
            if (!mentionId) return null;
            return {
              node: $createMentionNode({
                id: mentionId,
                label,
                trigger,
              }),
            };
          },
          priority: 1,
        };
      },
    };
  }

  static importJSON(serialized: SerializedMentionNode): MentionNode {
    return $createMentionNode({
      id: serialized.mentionId,
      label: serialized.label,
      trigger: serialized.trigger,
    });
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      mentionId: this.__mentionId,
      label: this.__label,
      trigger: this.__trigger,
      type: "mention",
      version: 1,
    };
  }

  isInline(): true {
    return true;
  }

  getTextContent(): string {
    return `${this.__trigger}${this.__label}`;
  }

  decorate(): ReactElement {
    return (
      <MentionComponent
        nodeKey={this.getKey()}
        mentionId={this.__mentionId}
        label={this.__label}
        trigger={this.__trigger}
      />
    );
  }
}

// ─── React Component ─────────────────────────────────────────────────────────

function MentionComponent({
  nodeKey,
  mentionId,
  label,
  trigger,
}: {
  nodeKey: NodeKey;
  mentionId: string;
  label: string;
  trigger: string;
}) {
  const [editor] = useLexicalComposerContext();

  // Handle Delete/Backspace when this node is selected
  useEffect(() => {
    const removeNode = () => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isNodeSelection(selection)) return false;
        const nodes = selection.getNodes();
        for (const node of nodes) {
          if (node.getKey() === nodeKey) {
            node.remove();
            return true;
          }
        }
        return false;
      });
      return true;
    };

    const unregisterBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isNodeSelection(selection)) return false;
        const nodes = selection.getNodes();
        const isSelected = nodes.some((n) => n.getKey() === nodeKey);
        if (isSelected) {
          event?.preventDefault();
          removeNode();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const unregisterDelete = editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isNodeSelection(selection)) return false;
        const nodes = selection.getNodes();
        const isSelected = nodes.some((n) => n.getKey() === nodeKey);
        if (isSelected) {
          event?.preventDefault();
          removeNode();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      unregisterBackspace();
      unregisterDelete();
    };
  }, [editor, nodeKey]);

  // Determine chip color based on trigger
  const chipColor =
    trigger === "#"
      ? "var(--scribex-accent, #3b82f6)"
      : "var(--scribex-ai-stream, #3366cc)";

  return (
    <span
      data-testid="mention-node"
      data-mention-id={mentionId}
      data-mention-trigger={trigger}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        padding: "1px 6px",
        borderRadius: "4px",
        backgroundColor: `color-mix(in srgb, ${chipColor} 12%, transparent)`,
        color: chipColor,
        fontSize: "inherit",
        lineHeight: "inherit",
        fontWeight: 500,
        cursor: "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        verticalAlign: "baseline",
      }}
    >
      <span style={{ opacity: 0.6 }}>{trigger}</span>
      {label}
    </span>
  );
}

// ─── Factory Functions ───────────────────────────────────────────────────────

export function $createMentionNode(
  payload: MentionPayload,
): MentionNode {
  return new MentionNode(
    payload.id,
    payload.label,
    payload.trigger,
    payload.key,
  );
}

export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode;
}

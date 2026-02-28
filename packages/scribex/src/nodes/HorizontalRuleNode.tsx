"use client";

// REACT
import { useCallback, useEffect, useRef } from "react";
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
} from "lexical";
import {
  $getNodeByKey,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";

// ─── Node ───────────────────────────────────────────────────────────────────

export class HorizontalRuleNode extends DecoratorNode<ReactElement> {
  static getType(): string {
    return "horizontal-rule";
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    div.style.display = "block";
    div.style.width = "100%";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement("hr") };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      hr: () => ({
        conversion: convertHorizontalRuleElement,
        priority: 0,
      }),
    };
  }

  static importJSON(_serializedNode: SerializedLexicalNode): HorizontalRuleNode {
    return $createHorizontalRuleNode();
  }

  exportJSON(): SerializedLexicalNode {
    return {
      ...super.exportJSON(),
      type: "horizontal-rule",
      version: 1,
    };
  }

  decorate(): ReactElement {
    return <HorizontalRuleComponent nodeKey={this.getKey()} />;
  }
}

// ─── DOM Converter ──────────────────────────────────────────────────────────

function convertHorizontalRuleElement(): DOMConversionOutput {
  return { node: $createHorizontalRuleNode() };
}

// ─── React Component ────────────────────────────────────────────────────────

function HorizontalRuleComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click to select
  useEffect(() => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        if (containerRef.current?.contains(event.target as Node)) {
          if (!event.shiftKey) {
            clearSelection();
          }
          setSelected(true);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, clearSelection, setSelected]);

  // Delete/Backspace to remove
  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected) {
        event.preventDefault();
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node) node.remove();
        });
        return true;
      }
      return false;
    },
    [editor, isSelected, nodeKey],
  );

  useEffect(() => {
    const unregisterBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      onDelete,
      COMMAND_PRIORITY_LOW,
    );
    const unregisterDelete = editor.registerCommand(
      KEY_DELETE_COMMAND,
      onDelete,
      COMMAND_PRIORITY_LOW,
    );
    return () => {
      unregisterBackspace();
      unregisterDelete();
    };
  }, [editor, onDelete]);

  return (
    <div
      ref={containerRef}
      data-testid="horizontal-rule"
      style={{
        cursor: "pointer",
        padding: "12px 0",
      }}
    >
      <hr
        style={{
          border: "none",
          borderTop: isSelected
            ? "2px solid var(--scribex-ring, #3b82f6)"
            : "1px solid var(--scribex-border, #e2e8f0)",
          margin: 0,
          transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}

// ─── Factories ──────────────────────────────────────────────────────────────

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return new HorizontalRuleNode();
}

export function $isHorizontalRuleNode(
  node: LexicalNode | null | undefined,
): node is HorizontalRuleNode {
  return node instanceof HorizontalRuleNode;
}

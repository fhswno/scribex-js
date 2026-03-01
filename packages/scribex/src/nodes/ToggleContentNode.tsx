"use client";

import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  SerializedElementNode,
} from "lexical";
import { ElementNode } from "lexical";

// ─── Node Class ─────────────────────────────────────────────────────────────

export class ToggleContentNode extends ElementNode {
  static getType(): string {
    return "toggle-content";
  }

  static clone(node: ToggleContentNode): ToggleContentNode {
    return new ToggleContentNode(node.__key);
  }

  // ── DOM ─────────────────────────────────────────────────────────────────

  createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement("div");
    const themeClass = config.theme.toggleContent as string | undefined;
    if (themeClass) {
      dom.className = themeClass;
    }
    dom.setAttribute("data-toggle-content", "true");
    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  // Content area is a shadow root — block-level operations stay contained
  isShadowRoot(): boolean {
    return true;
  }

  // ── DOM Import/Export ───────────────────────────────────────────────────

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: Node) => {
        if (
          domNode instanceof HTMLElement &&
          domNode.hasAttribute("data-toggle-content")
        ) {
          return {
            conversion: convertToggleContentElement,
            priority: 2,
          };
        }
        return null;
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-toggle-content", "true");
    return { element };
  }

  // ── JSON Serialization ─────────────────────────────────────────────────

  static importJSON(_serialized: SerializedElementNode): ToggleContentNode {
    return $createToggleContentNode();
  }

  exportJSON(): SerializedElementNode {
    return {
      ...super.exportJSON(),
      type: "toggle-content",
      version: 1,
    };
  }
}

// ─── DOM Conversion ─────────────────────────────────────────────────────────

function convertToggleContentElement(
  _domNode: Node,
): DOMConversionOutput | null {
  return { node: $createToggleContentNode() };
}

// ─── Factory Functions ──────────────────────────────────────────────────────

export function $createToggleContentNode(): ToggleContentNode {
  return new ToggleContentNode();
}

export function $isToggleContentNode(
  node: LexicalNode | null | undefined,
): node is ToggleContentNode {
  return node instanceof ToggleContentNode;
}

"use client";

import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  RangeSelection,
  SerializedElementNode,
  Spread,
} from "lexical";
import { $createParagraphNode, $isElementNode, ElementNode } from "lexical";
import { IS_CHROME } from "@lexical/utils";

export interface ToggleContainerPayload {
  open?: boolean;
  key?: NodeKey;
}

export type SerializedToggleContainerNode = Spread<
  { open: boolean },
  SerializedElementNode
>;

export class ToggleContainerNode extends ElementNode {
  __open: boolean;

  static getType(): string {
    return "toggle-container";
  }

  static clone(node: ToggleContainerNode): ToggleContainerNode {
    return new ToggleContainerNode(node.__open, node.__key);
  }

  constructor(open: boolean = true, key?: NodeKey) {
    super(key);
    this.__open = open;
  }

  // Container acts as a structural boundary in the AST
  isShadowRoot(): boolean {
    return true;
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const themeClass = config.theme.toggleContainer as string | undefined;
    let dom: HTMLElement;

    if (IS_CHROME) {
      // Chrome has issues with <details> in contenteditable contexts
      dom = document.createElement("div");
      dom.setAttribute("data-toggle-container", "true");
      dom.setAttribute("data-open", this.__open ? "true" : "false");
    } else {
      const details = document.createElement("details");
      details.open = this.__open;
      details.addEventListener("toggle", () => {
        const open = editor.getEditorState().read(() => this.getOpen());
        if (open !== details.open) {
          editor.update(() => this.toggleOpen());
        }
      });
      dom = details;
    }

    if (themeClass) {
      dom.className = themeClass;
    }

    return dom;
  }

  updateDOM(prevNode: ToggleContainerNode, dom: HTMLElement): boolean {
    if (prevNode.__open !== this.__open) {
      if (IS_CHROME) {
        dom.setAttribute("data-open", this.__open ? "true" : "false");
      } else {
        (dom as HTMLDetailsElement).open = this.__open;
      }
    }
    return false;
  }

  // Backspace at start of first child → unwrap the entire container
  collapseAtStart(_selection: RangeSelection): boolean {
    const children = this.getChildren();
    const nodesToInsert: LexicalNode[] = [];
    for (const child of children) {
      if ($isElementNode(child)) {
        nodesToInsert.push(...child.getChildren());
      }
    }
    for (const node of nodesToInsert) {
      this.insertBefore(node);
    }
    this.remove();
    if (nodesToInsert.length > 0) {
      const first = nodesToInsert[0]!;
      if ($isElementNode(first)) {
        first.selectStart();
      }
    }
    return true;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      details: (_domNode: Node) => ({
        conversion: convertDetailsElement,
        priority: 1,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("details");
    if (this.__open) {
      element.setAttribute("open", "");
    }
    return { element };
  }

  static importJSON(
    serialized: SerializedToggleContainerNode,
  ): ToggleContainerNode {
    return $createToggleContainerNode({ open: serialized.open });
  }

  exportJSON(): SerializedToggleContainerNode {
    return {
      ...super.exportJSON(),
      open: this.__open,
      type: "toggle-container",
      version: 1,
    };
  }

  getOpen(): boolean {
    return this.getLatest().__open;
  }

  setOpen(open: boolean): void {
    const writable = this.getWritable();
    writable.__open = open;
  }

  toggleOpen(): void {
    this.setOpen(!this.getOpen());
  }
}

function convertDetailsElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLElement) {
    const isOpen = (domNode as HTMLDetailsElement).open !== false;
    return { node: $createToggleContainerNode({ open: isOpen }) };
  }
  return null;
}

export function $createToggleContainerNode(
  payload?: ToggleContainerPayload,
): ToggleContainerNode {
  return new ToggleContainerNode(payload?.open ?? true, payload?.key);
}

export function $isToggleContainerNode(
  node: LexicalNode | null | undefined,
): node is ToggleContainerNode {
  return node instanceof ToggleContainerNode;
}

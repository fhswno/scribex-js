"use client";

import type {
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  RangeSelection,
  SerializedElementNode,
} from "lexical";
import { $createParagraphNode, $isElementNode, ElementNode } from "lexical";
import { IS_CHROME } from "@lexical/utils";
import { $isToggleContainerNode } from "./ToggleContainerNode";
import { $isToggleContentNode } from "./ToggleContentNode";

export class ToggleTitleNode extends ElementNode {
  static getType(): string {
    return "toggle-title";
  }

  static clone(node: ToggleTitleNode): ToggleTitleNode {
    return new ToggleTitleNode(node.__key);
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const dom = document.createElement("summary");
    const themeClass = config.theme.toggleTitle as string | undefined;
    if (themeClass) {
      dom.className = themeClass;
    }
    dom.setAttribute("data-placeholder", "Toggle heading");

    if (IS_CHROME) {
      // On Chrome we use <div> parent, so <summary> has no native toggle.
      // Toggle when clicking the disclosure triangle area (~28px from inline-start).
      dom.addEventListener("click", (e: MouseEvent) => {
        const isRtl = getComputedStyle(dom).direction === "rtl";
        const clickedOnTriangle = isRtl
          ? e.offsetX > dom.offsetWidth - 28
          : e.offsetX < 28;

        if (clickedOnTriangle) {
          e.preventDefault();
          editor.update(() => {
            const container = this.getLatest().getParent();
            if ($isToggleContainerNode(container)) {
              container.toggleOpen();
            }
          });
        }
      });
    }

    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  // ── Enter key: move cursor from title to content ────────────────────────

  insertNewAfter(
    _selection: RangeSelection,
    restoreSelection?: boolean,
  ): ElementNode | null {
    const container = this.getParent();

    if (!$isToggleContainerNode(container)) {
      return null;
    }

    if (container.getOpen()) {
      // Open → navigate into the content node
      const content = this.getNextSibling();
      if ($isToggleContentNode(content)) {
        const firstChild = content.getFirstChild();
        if ($isElementNode(firstChild)) {
          return firstChild;
        }
        // Content is empty — add a paragraph
        const paragraph = $createParagraphNode();
        content.append(paragraph);
        return paragraph;
      }
    }

    // Closed → insert paragraph after the container
    const paragraph = $createParagraphNode();
    container.insertAfter(paragraph, restoreSelection);
    return paragraph;
  }

  // ── Backspace at start: unwrap entire toggle ────────────────────────────

  collapseAtStart(_selection: RangeSelection): boolean {
    const container = this.getParent();
    if ($isToggleContainerNode(container)) {
      return container.collapseAtStart(_selection);
    }
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      summary: (_domNode: Node) => ({
        conversion: convertSummaryElement,
        priority: 1,
      }),
    };
  }

  static importJSON(_serialized: SerializedElementNode): ToggleTitleNode {
    return $createToggleTitleNode();
  }

  exportJSON(): SerializedElementNode {
    return {
      ...super.exportJSON(),
      type: "toggle-title",
      version: 1,
    };
  }

  // Title is NOT a shadow root — it's editable inline text
}

function convertSummaryElement(_domNode: Node): DOMConversionOutput | null {
  return { node: $createToggleTitleNode() };
}

export function $createToggleTitleNode(): ToggleTitleNode {
  return new ToggleTitleNode();
}

export function $isToggleTitleNode(
  node: LexicalNode | null | undefined,
): node is ToggleTitleNode {
  return node instanceof ToggleTitleNode;
}

"use client";

import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementDOMSlot,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  Spread,
} from "lexical";
import { ElementNode } from "lexical";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalloutPayload {
  emoji?: string;
  colorPreset?: string;
  key?: NodeKey;
}

export type SerializedCalloutNode = Spread<
  {
    emoji: string;
    colorPreset: string;
  },
  SerializedElementNode
>;

// ─── Node Class ─────────────────────────────────────────────────────────────

export class CalloutNode extends ElementNode {
  __emoji: string;
  __colorPreset: string;

  static getType(): string {
    return "callout";
  }

  static clone(node: CalloutNode): CalloutNode {
    return new CalloutNode(node.__emoji, node.__colorPreset, node.__key);
  }

  constructor(emoji: string = "\u{1F4A1}", colorPreset: string = "default", key?: NodeKey) {
    super(key);
    this.__emoji = emoji;
    this.__colorPreset = colorPreset;
  }

  // ── DOM ─────────────────────────────────────────────────────────────────

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    const themeClass = config.theme.callout as string | undefined;
    if (themeClass) {
      div.className = themeClass;
    }
    if (this.__colorPreset !== "default") {
      div.classList.add(`scribex-callout--${this.__colorPreset}`);
    }
    div.dataset.calloutEmoji = this.__emoji;
    div.dataset.calloutColor = this.__colorPreset;

    // Non-editable emoji element — Lexical children are placed after it
    const emojiSpan = document.createElement("span");
    emojiSpan.textContent = this.__emoji;
    emojiSpan.contentEditable = "false";
    emojiSpan.setAttribute("data-callout-emoji-display", "true");
    div.appendChild(emojiSpan);

    return div;
  }

  /**
   * Tell Lexical's reconciler to insert children after the emoji span.
   * This is the correct API (Lexical 0.40+) for nodes whose createDOM()
   * includes accessory elements that aren't Lexical children.
   */
  getDOMSlot(element: HTMLElement): ElementDOMSlot {
    const emojiSpan = element.querySelector("[data-callout-emoji-display]");
    return super.getDOMSlot(element).withAfter(emojiSpan);
  }

  updateDOM(prevNode: CalloutNode, dom: HTMLElement): boolean {
    // Update emoji in place
    if (prevNode.__emoji !== this.__emoji) {
      dom.dataset.calloutEmoji = this.__emoji;
      const emojiSpan = dom.querySelector("[data-callout-emoji-display]");
      if (emojiSpan) {
        emojiSpan.textContent = this.__emoji;
      }
    }

    // Update color preset in place
    if (prevNode.__colorPreset !== this.__colorPreset) {
      dom.dataset.calloutColor = this.__colorPreset;
      // Remove old preset class
      if (prevNode.__colorPreset !== "default") {
        dom.classList.remove(`scribex-callout--${prevNode.__colorPreset}`);
      }
      // Add new preset class
      if (this.__colorPreset !== "default") {
        dom.classList.add(`scribex-callout--${this.__colorPreset}`);
      }
    }

    // Return false — we handled updates in place, no full re-create needed
    return false;
  }

  // ── DOM Import/Export ───────────────────────────────────────────────────

  exportDOM(): DOMExportOutput {
    const div = document.createElement("div");
    div.dataset.calloutEmoji = this.__emoji;
    div.dataset.calloutColor = this.__colorPreset;
    return { element: div };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: Node) => {
        if (domNode instanceof HTMLElement && domNode.dataset.calloutEmoji) {
          return {
            conversion: convertCalloutElement,
            priority: 1,
          };
        }
        return null;
      },
    };
  }

  // ── JSON Serialization ─────────────────────────────────────────────────

  static importJSON(serialized: SerializedCalloutNode): CalloutNode {
    return $createCalloutNode({
      emoji: serialized.emoji,
      colorPreset: serialized.colorPreset,
    });
  }

  exportJSON(): SerializedCalloutNode {
    return {
      ...super.exportJSON(),
      emoji: this.__emoji,
      colorPreset: this.__colorPreset,
      type: "callout",
      version: 1,
    };
  }

  // ── Getters & Setters ──────────────────────────────────────────────────

  getEmoji(): string {
    return this.getLatest().__emoji;
  }

  setEmoji(emoji: string): this {
    const writable = this.getWritable();
    writable.__emoji = emoji;
    return this;
  }

  getColorPreset(): string {
    return this.getLatest().__colorPreset;
  }

  setColorPreset(preset: string): this {
    const writable = this.getWritable();
    writable.__colorPreset = preset;
    return this;
  }
}

// ─── DOM Conversion ─────────────────────────────────────────────────────────

function convertCalloutElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLElement) {
    const emoji = domNode.dataset.calloutEmoji ?? "\u{1F4A1}";
    const colorPreset = domNode.dataset.calloutColor ?? "default";
    const node = $createCalloutNode({ emoji, colorPreset });
    return { node };
  }
  return null;
}

// ─── Factory Functions ──────────────────────────────────────────────────────

export function $createCalloutNode(payload?: CalloutPayload): CalloutNode {
  return new CalloutNode(
    payload?.emoji ?? "\u{1F4A1}",
    payload?.colorPreset ?? "default",
    payload?.key,
  );
}

export function $isCalloutNode(node: LexicalNode | null | undefined): node is CalloutNode {
  return node instanceof CalloutNode;
}

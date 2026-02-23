"use client";

import type { ReactElement } from "react";
import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { DecoratorNode } from "lexical";

export type SerializedLoadingImageNode = Spread<
  { objectURL: string },
  SerializedLexicalNode
>;

export class LoadingImageNode extends DecoratorNode<ReactElement> {
  __objectURL: string;

  static getType(): string {
    return "loading-image";
  }

  static clone(node: LoadingImageNode): LoadingImageNode {
    return new LoadingImageNode(node.__objectURL, node.__key);
  }

  constructor(objectURL: string, key?: NodeKey) {
    super(key);
    this.__objectURL = objectURL;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    div.style.position = "relative";
    div.style.display = "inline-block";
    div.style.maxWidth = "100%";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-loading-image", "true");
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  static importJSON(
    serializedNode: SerializedLoadingImageNode,
  ): LoadingImageNode {
    return $createLoadingImageNode(serializedNode.objectURL);
  }

  exportJSON(): SerializedLoadingImageNode {
    return {
      ...super.exportJSON(),
      objectURL: this.__objectURL,
      type: "loading-image",
      version: 1,
    };
  }

  getObjectURL(): string {
    return this.__objectURL;
  }

  decorate(): ReactElement {
    return <LoadingImageComponent objectURL={this.__objectURL} />;
  }
}

function LoadingImageComponent({ objectURL }: { objectURL: string }) {
  return (
    <div
      data-testid="loading-image-node"
      style={{
        position: "relative",
        display: "inline-block",
        maxWidth: "100%",
      }}
    >
      <img
        src={objectURL}
        alt="Uploading..."
        style={{
          maxWidth: "100%",
          borderRadius: "var(--scribex-radius, 0.5rem)",
          opacity: 0.6,
        }}
      />
      {/* Spinner overlay */}
      <div
        data-testid="loading-image-spinner"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          borderRadius: "var(--scribex-radius, 0.5rem)",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid var(--scribex-muted, #e2e8f0)",
            borderTopColor: "var(--scribex-accent, #3b82f6)",
            borderRadius: "50%",
            animation: "scribex-spin 0.8s linear infinite",
          }}
        />
      </div>
      <style>{`@keyframes scribex-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function $createLoadingImageNode(objectURL: string): LoadingImageNode {
  return new LoadingImageNode(objectURL);
}

export function $isLoadingImageNode(
  node: LexicalNode | null | undefined,
): node is LoadingImageNode {
  return node instanceof LoadingImageNode;
}

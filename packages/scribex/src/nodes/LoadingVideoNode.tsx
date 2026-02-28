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

export type SerializedLoadingVideoNode = Spread<
  { objectURL: string; fileName: string },
  SerializedLexicalNode
>;

export class LoadingVideoNode extends DecoratorNode<ReactElement> {
  __objectURL: string;
  __fileName: string;

  static getType(): string {
    return "loading-video";
  }

  static clone(node: LoadingVideoNode): LoadingVideoNode {
    return new LoadingVideoNode(
      node.__objectURL,
      node.__fileName,
      node.__key,
    );
  }

  constructor(objectURL: string, fileName: string, key?: NodeKey) {
    super(key);
    this.__objectURL = objectURL;
    this.__fileName = fileName;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    div.style.position = "relative";
    div.style.display = "block";
    div.style.maxWidth = "100%";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-loading-video", "true");
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  static importJSON(
    serializedNode: SerializedLoadingVideoNode,
  ): LoadingVideoNode {
    return $createLoadingVideoNode(
      serializedNode.objectURL,
      serializedNode.fileName,
    );
  }

  exportJSON(): SerializedLoadingVideoNode {
    return {
      ...super.exportJSON(),
      objectURL: this.__objectURL,
      fileName: this.__fileName,
      type: "loading-video",
      version: 1,
    };
  }

  getObjectURL(): string {
    return this.__objectURL;
  }

  getFileName(): string {
    return this.__fileName;
  }

  decorate(): ReactElement {
    return (
      <LoadingVideoComponent
        objectURL={this.__objectURL}
        fileName={this.__fileName}
      />
    );
  }
}

function LoadingVideoComponent({
  fileName,
}: {
  objectURL: string;
  fileName: string;
}) {
  return (
    <div
      data-testid="loading-video-node"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        maxHeight: "400px",
        backgroundColor: "var(--scribex-muted, #f1f5f9)",
        borderRadius: "var(--scribex-radius, 0.5rem)",
        overflow: "hidden",
        opacity: 0.6,
      }}
    >
      {/* File name label */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "12px",
          right: "12px",
          fontSize: "13px",
          color: "var(--scribex-muted-foreground, #64748b)",
          fontFamily: "var(--scribex-font-sans, system-ui, sans-serif)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {fileName}
      </div>

      {/* Spinner overlay */}
      <div
        data-testid="loading-video-spinner"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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

export function $createLoadingVideoNode(
  objectURL: string,
  fileName: string,
): LoadingVideoNode {
  return new LoadingVideoNode(objectURL, fileName);
}

export function $isLoadingVideoNode(
  node: LexicalNode | null | undefined,
): node is LoadingVideoNode {
  return node instanceof LoadingVideoNode;
}

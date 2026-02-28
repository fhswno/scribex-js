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
  Spread,
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

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VideoPayload {
  src: string;
  videoType: "embed" | "file";
  provider: string;
  title?: string;
  key?: NodeKey;
}

export type SerializedVideoNode = Spread<
  {
    src: string;
    videoType: "embed" | "file";
    provider: string;
    title: string;
  },
  SerializedLexicalNode
>;

// ─── Node ───────────────────────────────────────────────────────────────────

export class VideoNode extends DecoratorNode<ReactElement> {
  __src: string;
  __videoType: "embed" | "file";
  __provider: string;
  __title: string;

  static getType(): string {
    return "video";
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode(
      node.__src,
      node.__videoType,
      node.__provider,
      node.__title,
      node.__key,
    );
  }

  constructor(
    src: string,
    videoType: "embed" | "file",
    provider: string,
    title?: string,
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__videoType = videoType;
    this.__provider = provider;
    this.__title = title ?? "";
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    div.style.display = "block";
    div.style.maxWidth = "100%";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const div = document.createElement("div");
    div.setAttribute("data-video-src", this.__src);
    div.setAttribute("data-video-type", this.__videoType);
    div.setAttribute("data-video-provider", this.__provider);
    if (this.__title) {
      div.setAttribute("data-video-title", this.__title);
    }
    return { element: div };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-video-src")) return null;
        return {
          conversion: convertVideoElement,
          priority: 1,
        };
      },
      iframe: (domNode: HTMLElement) => {
        const src = domNode.getAttribute("src") ?? "";
        if (
          src.includes("youtube.com") ||
          src.includes("vimeo.com") ||
          src.includes("loom.com")
        ) {
          return {
            conversion: convertIframeElement,
            priority: 1,
          };
        }
        return null;
      },
    };
  }

  static importJSON(serializedNode: SerializedVideoNode): VideoNode {
    return $createVideoNode({
      src: serializedNode.src,
      videoType: serializedNode.videoType,
      provider: serializedNode.provider,
      title: serializedNode.title,
    });
  }

  exportJSON(): SerializedVideoNode {
    return {
      ...super.exportJSON(),
      src: this.__src,
      videoType: this.__videoType,
      provider: this.__provider,
      title: this.__title,
      type: "video",
      version: 1,
    };
  }

  getSrc(): string {
    return this.__src;
  }

  getVideoType(): "embed" | "file" {
    return this.__videoType;
  }

  getProvider(): string {
    return this.__provider;
  }

  getTitle(): string {
    return this.__title;
  }

  decorate(): ReactElement {
    return (
      <VideoComponent
        src={this.__src}
        videoType={this.__videoType}
        provider={this.__provider}
        title={this.__title}
        nodeKey={this.getKey()}
      />
    );
  }
}

// ─── DOM Converters ─────────────────────────────────────────────────────────

function convertVideoElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLElement) {
    const src = domNode.getAttribute("data-video-src");
    if (!src) return null;
    const node = $createVideoNode({
      src,
      videoType:
        (domNode.getAttribute("data-video-type") as "embed" | "file") ??
        "embed",
      provider: domNode.getAttribute("data-video-provider") ?? "generic",
      title: domNode.getAttribute("data-video-title") ?? "",
    });
    return { node };
  }
  return null;
}

function convertIframeElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLIFrameElement) {
    const src = domNode.getAttribute("src");
    if (!src) return null;

    let provider = "generic";
    if (src.includes("youtube.com")) provider = "youtube";
    else if (src.includes("vimeo.com")) provider = "vimeo";
    else if (src.includes("loom.com")) provider = "loom";

    const node = $createVideoNode({
      src,
      videoType: "embed",
      provider,
      title: domNode.getAttribute("title") ?? "",
    });
    return { node };
  }
  return null;
}

// ─── React Component ────────────────────────────────────────────────────────

function VideoComponent({
  src,
  videoType,
  provider,
  title,
  nodeKey,
}: {
  src: string;
  videoType: "embed" | "file";
  provider: string;
  title: string;
  nodeKey: NodeKey;
}) {
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
      data-testid="video-node"
      data-video-provider={provider}
      style={{
        position: "relative",
        maxWidth: "100%",
        cursor: "pointer",
        borderRadius: "var(--scribex-radius, 0.5rem)",
        outline: isSelected
          ? "2px solid var(--scribex-ring, #3b82f6)"
          : "none",
        outlineOffset: "2px",
      }}
    >
      {videoType === "embed" ? (
        <iframe
          src={src}
          title={title || "Embedded video"}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "16 / 9",
            border: "none",
            borderRadius: "var(--scribex-radius, 0.5rem)",
          }}
          draggable={false}
        />
      ) : (
        <video
          src={src}
          controls
          style={{
            display: "block",
            width: "100%",
            maxHeight: "500px",
            borderRadius: "var(--scribex-radius, 0.5rem)",
          }}
          draggable={false}
        >
          <track kind="captions" />
        </video>
      )}

      {/* Transparent click overlay — captures clicks that iframes/videos swallow.
          Hidden when selected so the user can interact with the player. */}
      {!isSelected && (
        <div
          data-testid="video-click-overlay"
          style={{
            position: "absolute",
            inset: 0,
            cursor: "pointer",
            borderRadius: "var(--scribex-radius, 0.5rem)",
          }}
        />
      )}
    </div>
  );
}

// ─── Factories ──────────────────────────────────────────────────────────────

export function $createVideoNode(payload: VideoPayload): VideoNode {
  return new VideoNode(
    payload.src,
    payload.videoType,
    payload.provider,
    payload.title,
    payload.key,
  );
}

export function $isVideoNode(
  node: LexicalNode | null | undefined,
): node is VideoNode {
  return node instanceof VideoNode;
}

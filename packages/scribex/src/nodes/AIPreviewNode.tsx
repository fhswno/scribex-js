"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

// LEXICAL
import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $getNodeByKey, DecoratorNode } from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

// INTERNAL
import { getAIProvider, getAIConfig } from "../plugins/aiProviderRegistry";
import { $parseMarkdownToLexicalNodes } from "../utils/markdown";
import type { AIPluginConfig } from "../types";

// PHOSPHOR
import { SparkleIcon, CheckIcon, XIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AIPreviewPayload {
  prompt: string;
  context: string;
  key?: NodeKey;
}

export type SerializedAIPreviewNode = Spread<
  {
    prompt: string;
    context: string;
  },
  SerializedLexicalNode
>;

type StreamStatus = "streaming" | "complete" | "error";

// ─── Node Class ──────────────────────────────────────────────────────────────

export class AIPreviewNode extends DecoratorNode<ReactElement> {
  __prompt: string;
  __context: string;

  static getType(): string {
    return "ai-preview";
  }

  static clone(node: AIPreviewNode): AIPreviewNode {
    return new AIPreviewNode(node.__prompt, node.__context, node.__key);
  }

  constructor(prompt: string, context: string, key?: NodeKey) {
    super(key);
    this.__prompt = prompt;
    this.__context = context;
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
    // Transient node — should not persist in exported HTML
    const div = document.createElement("div");
    div.textContent = "[AI Preview]";
    return { element: div };
  }

  static importDOM(): DOMConversionMap | null {
    // Transient node — never imported from HTML
    return null;
  }

  static importJSON(serialized: SerializedAIPreviewNode): AIPreviewNode {
    return $createAIPreviewNode({
      prompt: serialized.prompt,
      context: serialized.context,
    });
  }

  exportJSON(): SerializedAIPreviewNode {
    return {
      ...super.exportJSON(),
      prompt: this.__prompt,
      context: this.__context,
      type: "ai-preview",
      version: 1,
    };
  }

  decorate(): ReactElement {
    return (
      <AIPreviewComponent
        nodeKey={this.getKey()}
        prompt={this.__prompt}
        context={this.__context}
      />
    );
  }
}

// ─── React Component ─────────────────────────────────────────────────────────

function AIPreviewComponent({
  nodeKey,
  prompt,
  context,
}: {
  nodeKey: NodeKey;
  prompt: string;
  context: string;
}) {
  const [editor] = useLexicalComposerContext();
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<StreamStatus>("streaming");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);
  const cancelledRef = useRef(false);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const configRef = useRef<AIPluginConfig>({});

  // Read config from registry once (stable across renders)
  useEffect(() => {
    configRef.current = getAIConfig(editor);
  }, [editor]);

  // Resolved labels with defaults
  const labels = configRef.current.labels ?? {};
  const headerLabel = labels.header ?? "AI";
  const streamingLabel = labels.streaming ?? "generating...";
  const acceptLabel = labels.accept ?? "Accept";
  const discardLabel = labels.discard ?? "Discard";
  const retryLabel = labels.retry ?? "Retry";
  const dismissLabel = labels.dismiss ?? "Dismiss";
  const defaultErrorLabel = labels.defaultError ?? "An error occurred";

  // Retry limits
  const maxRetries = configRef.current.retry?.maxRetries ?? Infinity;

  // Stream on mount (and on retry) — local React state only, NO editor.update() during streaming
  useEffect(() => {
    cancelledRef.current = false;
    setContent("");
    setStatus("streaming");
    setErrorMessage("");

    const provider = getAIProvider(editor);
    const config = getAIConfig(editor);
    configRef.current = config;

    if (!provider) {
      setStatus("error");
      setErrorMessage("No AI provider configured");
      return;
    }

    let accumulated = "";

    provider
      .generate({ prompt, context, config: config.generate })
      .then(async (stream) => {
        const reader = stream.getReader();
        readerRef.current = reader;

        while (true) {
          if (cancelledRef.current) {
            reader.cancel();
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          accumulated += value;
          setContent(accumulated);
        }

        if (!cancelledRef.current) {
          setStatus("complete");
        }
      })
      .catch((err: unknown) => {
        if (!cancelledRef.current) {
          const error = err instanceof Error ? err : new Error("Stream failed");
          setStatus("error");
          setErrorMessage(error.message);
          config.onError?.(error);
        }
      });

    return () => {
      cancelledRef.current = true;
      readerRef.current?.cancel();
    };
  }, [editor, prompt, context, retryCount]);

  // Retry: bump the counter to re-trigger the stream effect
  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  // Accept: parse Markdown → replace this node (single editor.update())
  const handleAccept = useCallback(() => {
    configRef.current.onAccept?.(content);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!node) return;

      const lexicalNodes = $parseMarkdownToLexicalNodes(content);

      if (lexicalNodes.length === 0) {
        node.remove();
        return;
      }

      // Replace the AIPreviewNode with the parsed nodes
      // Insert first node in place, then insert remaining after it
      const firstNode = lexicalNodes[0]!;
      node.replace(firstNode);

      let current = firstNode;
      for (let i = 1; i < lexicalNodes.length; i++) {
        current.insertAfter(lexicalNodes[i]!);
        current = lexicalNodes[i]!;
      }
    });
  }, [editor, nodeKey, content]);

  // Discard: remove this node (single editor.update())
  const handleDiscard = useCallback(() => {
    if (status !== "error") {
      configRef.current.onDiscard?.();
    }
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
  }, [editor, nodeKey, status]);

  return (
    <div
      data-testid="ai-preview-node"
      style={{
        position: "relative",
        borderLeft: "3px solid var(--scribex-ai-stream, #3366cc)",
        borderRadius: "0 8px 8px 0",
        padding: "16px 20px",
        margin: "8px 0",
        backgroundColor: "rgba(51, 102, 204, 0.05)",
        fontFamily: "var(--scribex-font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "12px",
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--scribex-ai-stream, #3366cc)",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        <SparkleIcon size={14} weight="fill" />
        <span>{headerLabel}</span>
        {status === "streaming" && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 400,
              color: "var(--scribex-muted-foreground, #94a3b8)",
              textTransform: "none",
              letterSpacing: "0",
            }}
          >
            {streamingLabel}
          </span>
        )}
      </div>

      {/* Content */}
      {status === "error" ? (
        <div
          data-testid="ai-preview-error"
          style={{
            color: "var(--scribex-destructive, #ef4444)",
            fontSize: "14px",
          }}
        >
          {errorMessage || defaultErrorLabel}
        </div>
      ) : (
        <div
          data-testid="ai-preview-content"
          style={{
            fontSize: "15px",
            lineHeight: 1.7,
            color: "var(--scribex-foreground, #0f172a)",
            whiteSpace: "pre-wrap",
          }}
        >
          {content}
          {status === "streaming" && (
            <span
              style={{
                display: "inline-block",
                width: "2px",
                height: "1em",
                marginLeft: "1px",
                backgroundColor: "var(--scribex-ai-stream, #3366cc)",
                animation: "scribex-cursor-blink 1s step-end infinite",
                verticalAlign: "text-bottom",
              }}
            />
          )}
        </div>
      )}

      {/* Action buttons — shown when stream completes or errors */}
      {(status === "complete" || status === "error") && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "14px",
          }}
        >
          {status === "complete" && (
            <button
              type="button"
              data-testid="ai-preview-accept"
              onClick={handleAccept}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                backgroundColor: "var(--scribex-ai-stream, #3366cc)",
                color: "#fff",
                transition: "opacity 0.15s",
              }}
            >
              <CheckIcon size={14} weight="bold" />
              {acceptLabel}
            </button>
          )}
          {status === "error" && retryCount < maxRetries && (
            <button
              type="button"
              data-testid="ai-preview-retry"
              onClick={handleRetry}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                backgroundColor: "var(--scribex-ai-stream, #3366cc)",
                color: "#fff",
                transition: "opacity 0.15s",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  animation: "scribex-retry-spin 0.5s ease-in-out",
                }}
                key={retryCount}
              >
                <ArrowClockwiseIcon size={14} weight="bold" />
              </span>
              {retryLabel}
            </button>
          )}
          <button
            type="button"
            data-testid={
              status === "error" ? "ai-preview-dismiss" : "ai-preview-discard"
            }
            onClick={handleDiscard}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid var(--scribex-border, #e2e8f0)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              backgroundColor: "transparent",
              color: "var(--scribex-muted-foreground, #64748b)",
              transition: "opacity 0.15s",
            }}
          >
            <XIcon size={14} weight="bold" />
            {status === "error" ? dismissLabel : discardLabel}
          </button>
        </div>
      )}

      {/* Animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes scribex-cursor-blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            @keyframes scribex-retry-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `,
        }}
      />
    </div>
  );
}

// ─── Factory Functions ───────────────────────────────────────────────────────

export function $createAIPreviewNode(
  payload: AIPreviewPayload,
): AIPreviewNode {
  return new AIPreviewNode(payload.prompt, payload.context, payload.key);
}

export function $isAIPreviewNode(
  node: LexicalNode | null | undefined,
): node is AIPreviewNode {
  return node instanceof AIPreviewNode;
}

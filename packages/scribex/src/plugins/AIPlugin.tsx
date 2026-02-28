"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// REACT DOM
import { createPortal } from "react-dom";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_LOW,
} from "lexical";

// INTERNAL
import type { AIProvider, AIPluginConfig, AIPromptInputRenderProps } from "../types";
import {
  registerAIProvider,
  unregisterAIProvider,
} from "./aiProviderRegistry";
import {
  INSERT_AI_PREVIEW_COMMAND,
  OPEN_AI_PROMPT_COMMAND,
} from "../commands";
import { $createAIPreviewNode } from "../nodes/AIPreviewNode";
import { serializeNodesToMarkdown } from "../utils/markdown";

// PHOSPHOR
import { PaperPlaneRightIcon } from "@phosphor-icons/react";

interface AIPluginProps {
  /** The AI provider that supplies streaming text generation. */
  provider: AIProvider;
  /**
   * Optional configuration for the AI integration.
   * Controls model parameters, UI labels, retry behaviour, context window,
   * error handling, analytics callbacks, and custom prompt input rendering.
   */
  config?: AIPluginConfig;
}

export function AIPlugin({ provider, config = {} }: AIPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [promptPosition, setPromptPosition] = useState({ top: 0, left: 0 });
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Configurable context window size (default: 3 blocks)
  const contextWindowSize = config.contextWindowSize ?? 3;

  // Portal container
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  // Register provider + config in the WeakMap registry
  useEffect(() => {
    registerAIProvider(editor, provider, config);
    return () => {
      unregisterAIProvider(editor);
    };
  }, [editor, provider, config]);

  // Handle OPEN_AI_PROMPT_COMMAND — show the prompt input
  useEffect(() => {
    return editor.registerCommand(
      OPEN_AI_PROMPT_COMMAND,
      () => {
        // Get cursor position for popover anchoring — same line as trigger
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setPromptPosition({
            top: rect.top,
            left: rect.left,
          });
        }

        setIsPromptOpen(true);

        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, config.renderPrompt]);

  // Handle INSERT_AI_PREVIEW_COMMAND — insert the AIPreviewNode
  useEffect(() => {
    return editor.registerCommand(
      INSERT_AI_PREVIEW_COMMAND,
      (payload) => {
        // Build context from surrounding nodes
        let contextMarkdown = "";
        editor.read(() => {
          const root = $getRoot();
          const children = root.getChildren();
          const contextNodes = children.slice(-contextWindowSize);
          contextMarkdown = serializeNodesToMarkdown(contextNodes);
        });

        // Insert AIPreviewNode into the AST — replace the current block if empty
        editor.update(() => {
          const selection = $getSelection();
          let targetBlock: import("lexical").LexicalNode | null = null;

          if ($isRangeSelection(selection)) {
            let node: import("lexical").LexicalNode =
              selection.anchor.getNode();
            while (!$isRootNode(node)) {
              const parent = node.getParent();
              if (!parent || $isRootNode(parent)) {
                if (parent) targetBlock = node;
                break;
              }
              node = parent;
            }
          }

          const aiNode = $createAIPreviewNode({
            prompt: payload.prompt,
            context: contextMarkdown,
          });

          if (targetBlock && !$isRootNode(targetBlock)) {
            // If the current block is empty, replace it with the AI node
            const textContent = targetBlock.getTextContent();
            if (textContent.trim() === "") {
              targetBlock.replace(aiNode);
            } else {
              targetBlock.insertAfter(aiNode);
            }
          } else {
            const root = $getRoot();
            root.append(aiNode);
          }
        });

        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, contextWindowSize]);

  // Submit prompt
  const handleSubmit = useCallback(
    (promptText: string) => {
      if (!promptText.trim()) return;

      setIsPromptOpen(false);
      editor.dispatchCommand(INSERT_AI_PREVIEW_COMMAND, {
        prompt: promptText.trim(),
      });
    },
    [editor],
  );

  // Close prompt
  const handleClose = useCallback(() => {
    setIsPromptOpen(false);
    editor.focus();
  }, [editor]);

  if (!portalContainer) return null;

  // Build the prompt input render props
  const promptRenderProps: AIPromptInputRenderProps = {
    position: promptPosition,
    onSubmit: handleSubmit,
    onClose: handleClose,
  };

  return (
    <>
      {isPromptOpen &&
        createPortal(
          config.renderPrompt ? (
            config.renderPrompt(promptRenderProps)
          ) : (
            <AIPromptInput
              ref={inputRef}
              position={promptPosition}
              onSubmit={handleSubmit}
              onClose={handleClose}
            />
          ),
          portalContainer,
        )}
    </>
  );
}

// ─── Prompt Input ────────────────────────────────────────────────────────────

import { forwardRef } from "react";

interface AIPromptInputProps {
  position: { top: number; left: number };
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

const AIPromptInput = forwardRef<HTMLInputElement, AIPromptInputProps>(
  function AIPromptInput({ position, onSubmit, onClose }, ref) {
    const [value, setValue] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    // Close on click outside — deferred to avoid catching the click that opened the prompt
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          onClose();
        }
      };

      // Defer registration to the next frame so the opening click doesn't
      // immediately trigger the outside-click handler
      const raf = requestAnimationFrame(() => {
        document.addEventListener("mousedown", handleClickOutside);
      });
      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [onClose]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Stop propagation on ALL keys to prevent Lexical from intercepting
      // arrow keys, shift+arrow selections, etc.
      e.stopPropagation();

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit(value);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    return (
      <div
        ref={containerRef}
        data-testid="ai-prompt-input"
        style={{
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 8px 6px 14px",
          borderRadius: "12px",
          border: "1px solid rgba(51, 102, 204, 0.2)",
          backgroundColor: "var(--scribex-popover-bg)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow: "var(--scribex-popover-shadow)",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
          animation: "scribex-prompt-enter 0.2s ease-out",
          minWidth: "320px",
        }}
      >
        <input
          ref={(el) => {
            if (el) el.focus();
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI to write..."
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "14px",
            color: "var(--scribex-foreground, #0f172a)",
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          data-testid="ai-prompt-submit"
          onClick={() => onSubmit(value)}
          disabled={!value.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            border: "none",
            cursor: value.trim() ? "pointer" : "default",
            backgroundColor: value.trim()
              ? "var(--scribex-ai-stream, #3366cc)"
              : "rgba(51, 102, 204, 0.15)",
            color: value.trim() ? "var(--scribex-accent-foreground, #fff)" : "rgba(51, 102, 204, 0.35)",
            transition: "background-color 0.15s, color 0.15s",
          }}
        >
          <PaperPlaneRightIcon size={14} weight="fill" />
        </button>

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes scribex-prompt-enter {
                from {
                  opacity: 0;
                  transform: translateY(-4px) scale(0.98);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
            `,
          }}
        />
      </div>
    );
  },
);

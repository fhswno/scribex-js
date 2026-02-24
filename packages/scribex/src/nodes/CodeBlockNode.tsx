"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";
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

// PHOSPHOR
import { CopyIcon, CheckIcon } from "@phosphor-icons/react";

// ─── Constants ──────────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "css",
  "html",
  "json",
  "bash",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  "sql",
  "markdown",
  "yaml",
  "text",
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CodeBlockPayload {
  code: string;
  language: string;
  key?: NodeKey;
  autoFocus?: boolean;
}

export type SerializedCodeBlockNode = Spread<
  {
    code: string;
    language: string;
  },
  SerializedLexicalNode
>;

// ─── Node Class ─────────────────────────────────────────────────────────────

export class CodeBlockNode extends DecoratorNode<ReactElement> {
  __code: string;
  __language: string;
  __autoFocus: boolean;

  static getType(): string {
    return "code-block";
  }

  static clone(node: CodeBlockNode): CodeBlockNode {
    const clone = new CodeBlockNode(node.__code, node.__language, node.__key);
    clone.__autoFocus = node.__autoFocus;
    return clone;
  }

  constructor(code: string, language: string, key?: NodeKey) {
    super(key);
    this.__code = code;
    this.__language = language;
    this.__autoFocus = false;
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
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = this.__code;
    if (this.__language && this.__language !== "text") {
      code.className = `language-${this.__language}`;
    }
    pre.appendChild(code);
    return { element: pre };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      pre: () => ({
        conversion: convertPreElement,
        priority: 0,
      }),
    };
  }

  static importJSON(serialized: SerializedCodeBlockNode): CodeBlockNode {
    return $createCodeBlockNode({
      code: serialized.code,
      language: serialized.language,
    });
  }

  exportJSON(): SerializedCodeBlockNode {
    return {
      ...super.exportJSON(),
      code: this.__code,
      language: this.__language,
      type: "code-block",
      version: 1,
    };
  }

  getCode(): string {
    return this.__code;
  }

  getLanguage(): string {
    return this.__language;
  }

  decorate(): ReactElement {
    return (
      <CodeBlockComponent
        code={this.__code}
        language={this.__language}
        nodeKey={this.getKey()}
        autoFocus={this.__autoFocus}
      />
    );
  }
}

// ─── DOM Conversion ─────────────────────────────────────────────────────────

function convertPreElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLPreElement) {
    const codeEl = domNode.querySelector("code");
    const code = codeEl?.textContent ?? domNode.textContent ?? "";
    let language = "text";
    const className = codeEl?.className ?? "";
    const langMatch = className.match(/language-(\w+)/);
    if (langMatch?.[1]) {
      language = langMatch[1];
    }
    const node = $createCodeBlockNode({ code, language });
    return { node };
  }
  return null;
}

// ─── React Component ────────────────────────────────────────────────────────

function CodeBlockComponent({
  code,
  language,
  nodeKey,
  autoFocus,
}: {
  code: string;
  language: string;
  nodeKey: NodeKey;
  autoFocus: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localCode, setLocalCode] = useState(code);
  const [localLanguage, setLocalLanguage] = useState(language);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(autoFocus);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAutoFocusRef = useRef(false);

  // Auto-focus the textarea when the node is freshly created
  useEffect(() => {
    if (autoFocus && !didAutoFocusRef.current && textareaRef.current) {
      didAutoFocusRef.current = true;
      textareaRef.current.focus();
      // Clear the autoFocus flag on the node so it doesn't re-focus on re-render
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && node instanceof CodeBlockNode) {
          const writable = node.getWritable();
          writable.__autoFocus = false;
        }
      });
    }
  }, [autoFocus, editor, nodeKey]);

  // Sync from node props when they change externally
  useEffect(() => {
    setLocalCode(code);
  }, [code]);

  useEffect(() => {
    setLocalLanguage(language);
  }, [language]);

  // Handle click to select/edit this node
  useEffect(() => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        if (containerRef.current?.contains(event.target as Node)) {
          // If clicking inside the textarea or controls, don't select the node
          const target = event.target as HTMLElement;
          if (
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.tagName === "BUTTON" ||
            target.closest("select") ||
            target.closest("button")
          ) {
            return false;
          }
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

  // Handle Delete/Backspace to remove when selected (not editing)
  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && !isEditing) {
        event.preventDefault();
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node) {
            node.remove();
          }
        });
        return true;
      }
      return false;
    },
    [editor, isSelected, isEditing, nodeKey],
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

  // Debounced code update to Lexical
  const updateNodeCode = useCallback(
    (newCode: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node && node instanceof CodeBlockNode) {
            const writable = node.getWritable();
            writable.__code = newCode;
          }
        });
      }, 300);
    },
    [editor, nodeKey],
  );

  // Handle code change
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newCode = e.target.value;
      setLocalCode(newCode);
      updateNodeCode(newCode);
    },
    [updateNodeCode],
  );

  // Handle language change
  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLanguage = e.target.value;
      setLocalLanguage(newLanguage);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && node instanceof CodeBlockNode) {
          const writable = node.getWritable();
          writable.__language = newLanguage;
        }
      });
    },
    [editor, nodeKey],
  );

  // Build HTML for clipboard — preserves formatting when pasted into another editor
  const buildClipboardHtml = useCallback(
    (text: string) => {
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const langClass =
        localLanguage && localLanguage !== "text"
          ? ` class="language-${localLanguage}"`
          : "";
      return `<pre><code${langClass}>${escaped}</code></pre>`;
    },
    [localLanguage],
  );

  // Copy button handler
  const handleCopy = useCallback(() => {
    const html = buildClipboardHtml(localCode);
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([localCode], { type: "text/plain" });
    navigator.clipboard
      .write([new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })])
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }, [localCode, buildClipboardHtml]);

  // Textarea copy/cut — write HTML alongside plain text so paste recreates a code block
  const handleTextareaCopy = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd);
      const text = selected || localCode;

      e.preventDefault();
      e.clipboardData.setData("text/plain", text);
      e.clipboardData.setData("text/html", buildClipboardHtml(text));
    },
    [localCode, buildClipboardHtml],
  );

  const handleTextareaCut = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd);
      const text = selected || localCode;

      e.preventDefault();
      e.clipboardData.setData("text/plain", text);
      e.clipboardData.setData("text/html", buildClipboardHtml(text));

      // Remove the selected text
      if (selected) {
        const before = ta.value.substring(0, ta.selectionStart);
        const after = ta.value.substring(ta.selectionEnd);
        const newCode = before + after;
        setLocalCode(newCode);
        updateNodeCode(newCode);
      } else {
        setLocalCode("");
        updateNodeCode("");
      }
    },
    [localCode, buildClipboardHtml, updateNodeCode],
  );

  // Fetch Shiki highlighting (debounced)
  useEffect(() => {
    if (!localCode.trim()) {
      setHighlightedHtml(null);
      return;
    }

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      fetch("/api/editor/highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: localCode, language: localLanguage }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Highlight failed");
          return res.json();
        })
        .then((data: { html: string }) => {
          setHighlightedHtml(data.html);
        })
        .catch(() => {
          // Silently fall back to raw code display
          setHighlightedHtml(null);
        });
    }, 500);

    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, [localCode, localLanguage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      const ta = textareaRef.current;
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [localCode, isEditing]);

  return (
    <div
      ref={containerRef}
      data-testid="code-block-node"
      style={{
        position: "relative",
        borderRadius: "var(--scribex-radius, 0.5rem)",
        backgroundColor: "var(--scribex-muted, #f1f5f9)",
        margin: "0.5em 0",
        overflow: "hidden",
        outline: isSelected
          ? "2px solid var(--scribex-ring, #3b82f6)"
          : "none",
        outlineOffset: "2px",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: "1px solid var(--scribex-border, #e2e8f0)",
          fontSize: "12px",
        }}
      >
        {/* Language selector */}
        <select
          data-testid="code-block-language"
          value={localLanguage}
          onChange={handleLanguageChange}
          style={{
            backgroundColor: "transparent",
            border: "none",
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--scribex-muted-foreground, #64748b)",
            cursor: "pointer",
            outline: "none",
            padding: "2px 4px",
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>

        {/* Copy button */}
        <button
          type="button"
          data-testid="code-block-copy"
          onClick={handleCopy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 8px",
            borderRadius: "6px",
            border: "none",
            fontSize: "11px",
            fontWeight: 500,
            cursor: "pointer",
            backgroundColor: "transparent",
            color: "var(--scribex-muted-foreground, #64748b)",
            transition: "background-color 80ms ease",
          }}
        >
          {copied ? (
            <>
              <CheckIcon size={12} weight="bold" />
              Copied
            </>
          ) : (
            <>
              <CopyIcon size={12} />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code area */}
      <div
        style={{
          position: "relative",
          minHeight: "40px",
        }}
      >
        {/* Highlighted output (shown when not editing and highlight is available) */}
        {!isEditing && highlightedHtml ? (
          <div
            data-testid="code-block-highlighted"
            onClick={() => {
              setIsEditing(true);
              // Focus textarea after it renders
              setTimeout(() => textareaRef.current?.focus(), 0);
            }}
            style={{
              padding: "12px 16px",
              cursor: "text",
              overflow: "auto",
            }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : null}

        {/* Textarea (always present when editing, or when no highlight) */}
        {isEditing || !highlightedHtml ? (
          <textarea
            ref={textareaRef}
            data-testid="code-block-textarea"
            value={localCode}
            onChange={handleCodeChange}
            onCopy={handleTextareaCopy}
            onCut={handleTextareaCut}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
            placeholder="Enter code..."
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            style={{
              display: "block",
              width: "100%",
              padding: "12px 16px",
              fontFamily:
                'var(--scribex-font-mono, ui-monospace, "SFMono-Regular", monospace)',
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--scribex-foreground, #0f172a)",
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              overflow: "hidden",
              whiteSpace: "pre",
              tabSize: 2,
              minHeight: "40px",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Factory Functions ──────────────────────────────────────────────────────

export function $createCodeBlockNode(payload: CodeBlockPayload): CodeBlockNode {
  const node = new CodeBlockNode(payload.code, payload.language, payload.key);
  if (payload.autoFocus) {
    node.__autoFocus = true;
  }
  return node;
}

export function $isCodeBlockNode(
  node: LexicalNode | null | undefined,
): node is CodeBlockNode {
  return node instanceof CodeBlockNode;
}

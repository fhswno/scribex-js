"use client";

// REACT
import { useEffect } from "react";

// LEXICAL
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";

// NODES
import { ALL_NODES } from "../nodes";

// THEME
import { scribexTheme } from "../theme";

interface EditorRootProps {
  /** Unique namespace — required for multi-editor isolation. See Section 8. */
  namespace: string;
  /** Initial serialized Lexical JSON state. Pass null for a blank editor. */
  initialState?: string | null;
  children?: React.ReactNode;
  className?: string;
  /** Document-level text direction. Omit for per-paragraph auto-detection (default). */
  dir?: "ltr" | "rtl" | "auto";
  /** Customizable placeholder text. Default: "Start writing..." */
  placeholder?: string;
  /** Read-only mode. Default: true (editable). */
  editable?: boolean;
  /** Whether the editor auto-focuses on mount. Default: true. */
  autoFocus?: boolean;
  /** Custom error handler for Lexical errors. Default: console.error + throw. */
  onError?: (error: Error) => void;
}

/** Sets the root node direction on mount when an explicit dir is provided. */
function SetInitialDirection({ dir }: { dir: "ltr" | "rtl" }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.update(() => {
      $getRoot().setDirection(dir);
    });
    // Only on mount — do not override per-block directions on re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

const defaultOnError = (error: Error) => {
  console.error("[Scribex] Lexical error:", error);
  throw error;
};

export function EditorRoot({
  namespace,
  initialState,
  children,
  className,
  dir,
  placeholder = "Start writing...",
  editable = true,
  autoFocus = true,
  onError = defaultOnError,
}: EditorRootProps) {
  const initialConfig = {
    namespace,
    nodes: ALL_NODES,
    theme: scribexTheme,
    editorState: initialState ?? undefined,
    editable,
    onError,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={className} dir={dir} data-scribex-root data-namespace={namespace}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              aria-label="Editor content"
              className="scribex-content-editable focus:outline-none"
            />
          }
          placeholder={
            <div className="scribex-placeholder">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        {autoFocus && <AutoFocusPlugin />}
        {dir && dir !== "auto" && <SetInitialDirection dir={dir} />}
        {children}
      </div>
    </LexicalComposer>
  );
}

"use client";

// LEXICAL
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";

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
}

export function EditorRoot({
  namespace,
  initialState,
  children,
  className,
}: EditorRootProps) {
  const initialConfig = {
    namespace,
    nodes: ALL_NODES,
    theme: scribexTheme,
    editorState: initialState ?? undefined,
    onError: (error: Error) => {
      console.error("[Scribex] Lexical error:", error);
      throw error;
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={className} data-scribex-root data-namespace={namespace}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              aria-label="Editor content"
              className="scribex-content-editable focus:outline-none"
            />
          }
          placeholder={
            <div className="scribex-placeholder text-scribex-muted-foreground pointer-events-none absolute">
              Start writing...
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <AutoFocusPlugin />
        {children}
      </div>
    </LexicalComposer>
  );
}

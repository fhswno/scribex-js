'use client';

// REACT
import { useEffect, useRef, useState } from 'react';

// LEXICAL
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface UseEditorStateOptions {
  /**
   * Debounce delay in milliseconds. Do not set below 200ms.
   * High-frequency editor.update() calls on every keystroke will
   * degrade performance on large documents.
   */
  debounceMs?: number;
  onChange?: (serializedState: string) => void;
}

export function useEditorState({
  debounceMs = 300,
  onChange,
}: UseEditorStateOptions = {}) {
  const [editor] = useLexicalComposerContext();
  const [serializedState, setSerializedState] = useState<string>('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    // Keep a ref to the latest editorState so we only serialize once when
    // the debounce fires, using the most recent state (not every intermediate one).
    let latestEditorState: import('lexical').EditorState | null = null;

    const unregister = editor.registerUpdateListener(({ editorState }) => {
      latestEditorState = editorState;
      if (timeout) clearTimeout(timeout);

      timeout = setTimeout(() => {
        if (!latestEditorState) return;
        const json = JSON.stringify(latestEditorState.toJSON());
        latestEditorState = null;
        // Only trigger React re-render if no onChange callback is handling it
        if (!onChangeRef.current) {
          setSerializedState(json);
        }
        onChangeRef.current?.(json);
      }, debounceMs);
    });

    return () => {
      unregister();
      if (timeout) clearTimeout(timeout);
    };
  }, [editor, debounceMs]);

  return { serializedState };
}

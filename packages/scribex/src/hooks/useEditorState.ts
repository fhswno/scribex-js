'use client';

// REACT
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return editor.registerUpdateListener(({ editorState }) => {
      if (timeout) clearTimeout(timeout);

      timeout = setTimeout(() => {
        const json = JSON.stringify(editorState.toJSON());
        setSerializedState(json);
        onChange?.(json);
      }, debounceMs);
    });
  }, [editor, debounceMs, onChange]);

  return { serializedState };
}

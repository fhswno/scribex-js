'use client';

import { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';

interface WordCountResult {
  words: number;
  characters: number;
}

export function useWordCount(debounceMs = 300): WordCountResult {
  const [editor] = useLexicalComposerContext();
  const [counts, setCounts] = useState<WordCountResult>({ words: 0, characters: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        editorState.read(() => {
          const text = $getRoot().getTextContent();
          const characters = text.length;
          const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
          setCounts({ words, characters });
        });
      }, debounceMs);
    });

    return () => {
      unregister();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [editor, debounceMs]);

  return counts;
}

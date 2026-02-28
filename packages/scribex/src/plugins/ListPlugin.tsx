"use client";

// REACT
import { useEffect } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { registerList } from "@lexical/list";

/**
 * Registers @lexical/list behaviour: Enter on an empty list item exits the list,
 * Tab/Shift-Tab for indent/outdent, and other list integrity transforms.
 */
export function ListPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerList(editor);
  }, [editor]);

  return null;
}

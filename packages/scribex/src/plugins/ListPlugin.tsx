"use client";

// REACT
import { useEffect } from "react";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { registerList, registerCheckList } from "@lexical/list";

/**
 * Registers @lexical/list behaviour: Enter on an empty list item exits the list,
 * Tab/Shift-Tab for indent/outdent, and other list integrity transforms.
 * Also registers check list behaviour: click/spacebar to toggle checkbox state.
 */
export function ListPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const unregisterList = registerList(editor);
    const unregisterCheckList = registerCheckList(editor);
    return () => {
      unregisterList();
      unregisterCheckList();
    };
  }, [editor]);

  return null;
}

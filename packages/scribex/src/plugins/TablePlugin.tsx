"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_LOW } from "lexical";
import {
  $createTableNodeWithDimensions,
  registerTablePlugin,
  registerTableSelectionObserver,
  registerTableCellUnmergeTransform,
} from "@lexical/table";
import { $getSelection, $isRangeSelection } from "lexical";

import { INSERT_TABLE_COMMAND_SCRIBEX } from "../commands";

interface TablePluginProps {
  hasCellMerge?: boolean;
  hasCellBackgroundColor?: boolean;
  hasTabHandler?: boolean;
}

export function TablePlugin({
  hasCellMerge = true,
  hasTabHandler = true,
}: TablePluginProps) {
  const [editor] = useLexicalComposerContext();

  // Register core table plugin (integrity transforms + built-in commands)
  useEffect(() => {
    return registerTablePlugin(editor);
  }, [editor]);

  // Register table selection observer (mouse/keyboard cell selection)
  useEffect(() => {
    return registerTableSelectionObserver(editor, hasTabHandler);
  }, [editor, hasTabHandler]);

  // If merged cells are disabled, register the unmerge transform
  useEffect(() => {
    if (!hasCellMerge) {
      return registerTableCellUnmergeTransform(editor);
    }
  }, [editor, hasCellMerge]);

  // Handle INSERT_TABLE_COMMAND_SCRIBEX
  useEffect(() => {
    return editor.registerCommand(
      INSERT_TABLE_COMMAND_SCRIBEX,
      (payload: { rows: number; columns: number }) => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const tableNode = $createTableNodeWithDimensions(
            payload.rows,
            payload.columns,
            false,
          );

          const focusNode = selection.focus.getNode();
          const topLevelNode = focusNode.getTopLevelElement();
          if (topLevelNode) {
            topLevelNode.insertAfter(tableNode);
            // Remove the current node if it's an empty paragraph
            if (
              topLevelNode.getTextContent().trim() === "" &&
              topLevelNode.getType() === "paragraph"
            ) {
              topLevelNode.remove();
            }
          }
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}

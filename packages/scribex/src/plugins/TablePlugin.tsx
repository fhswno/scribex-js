"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from "lexical";
import {
  $createTableNodeWithDimensions,
  $isTableNode,
  $isTableRowNode,
  $isTableCellNode,
  registerTablePlugin,
  registerTableSelectionObserver,
  registerTableCellUnmergeTransform,
} from "@lexical/table";

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

  useEffect(() => {
    return registerTablePlugin(editor);
  }, [editor]);

  useEffect(() => {
    return registerTableSelectionObserver(editor, hasTabHandler);
  }, [editor, hasTabHandler]);

  useEffect(() => {
    if (!hasCellMerge) {
      return registerTableCellUnmergeTransform(editor);
    }
  }, [editor, hasCellMerge]);

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
            if (
              topLevelNode.getTextContent().trim() === "" &&
              topLevelNode.getType() === "paragraph"
            ) {
              topLevelNode.remove();
            }

            const firstRow = tableNode.getChildren().find($isTableRowNode);
            if (firstRow) {
              const firstCell = firstRow.getChildren().find($isTableCellNode);
              if (firstCell) {
                firstCell.selectStart();
              }
            }
          }
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    const handleDelete = (event: KeyboardEvent) => {
      const selection = $getSelection();
      if (!$isNodeSelection(selection)) return false;

      const nodes = selection.getNodes();
      const tableNode = nodes.find($isTableNode);
      if (!tableNode) return false;

      event.preventDefault();
      const paragraph = $createParagraphNode();
      tableNode.insertBefore(paragraph);
      tableNode.remove();
      paragraph.selectStart();
      return true;
    };

    const unregisterBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      handleDelete,
      COMMAND_PRIORITY_LOW,
    );
    const unregisterDelete = editor.registerCommand(
      KEY_DELETE_COMMAND,
      handleDelete,
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      unregisterBackspace();
      unregisterDelete();
    };
  }, [editor]);

  return null;
}

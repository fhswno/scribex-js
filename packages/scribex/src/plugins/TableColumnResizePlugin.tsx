"use client";

import { useEffect, useRef, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableCellNodeFromLexicalNode,
  $isTableCellNode,
  $isTableNode,
  TableNode,
} from "@lexical/table";
import { $getSelection, $isRangeSelection, $getNearestNodeFromDOMNode } from "lexical";

export function TableColumnResizePlugin() {
  const [editor] = useLexicalComposerContext();
  const resizingRef = useRef<{
    tableNode: TableNode;
    columnIndex: number;
    startX: number;
    startWidth: number;
    colWidths: number[];
  } | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if clicking near the right edge of a cell
      const cell = target.closest("td, th") as HTMLTableCellElement | null;
      if (!cell) return;

      const cellRect = cell.getBoundingClientRect();
      const distFromRight = cellRect.right - e.clientX;

      // Only trigger resize if within 5px of right edge
      if (distFromRight > 5) return;

      e.preventDefault();
      e.stopPropagation();

      const table = cell.closest("table") as HTMLTableElement | null;
      if (!table) return;

      editor.read(() => {
        const lexicalNode = $getNearestNodeFromDOMNode(table);
        if (!lexicalNode || !$isTableNode(lexicalNode)) return;

        const columnIndex = cell.cellIndex;
        const columnCount = (table.rows[0]?.cells.length) ?? 0;

        // Get or initialize column widths
        let colWidths = lexicalNode.getColWidths()
          ? [...lexicalNode.getColWidths()!]
          : Array.from({ length: columnCount }, () => cell.offsetWidth);

        // Ensure colWidths has correct length
        while (colWidths.length < columnCount) {
          colWidths.push(75);
        }

        resizingRef.current = {
          tableNode: lexicalNode,
          columnIndex,
          startX: e.clientX,
          startWidth: colWidths[columnIndex] ?? cell.offsetWidth,
          colWidths,
        };

        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;

      const { columnIndex, startX, startWidth, colWidths } = resizingRef.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(40, startWidth + delta);
      colWidths[columnIndex] = newWidth;

      // Apply visually via DOM for immediate feedback
      const rootEl = editor.getRootElement();
      if (rootEl) {
        const tables = rootEl.querySelectorAll("table");
        for (const table of tables) {
          const colGroup = table.querySelector("colgroup");
          if (colGroup) {
            const cols = colGroup.querySelectorAll("col");
            const col = cols[columnIndex];
            if (col) {
              col.style.width = `${newWidth}px`;
            }
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (!resizingRef.current) return;

      const { colWidths } = resizingRef.current;

      // Commit the new widths to Lexical state (single history entry)
      editor.update(() => {
        if (!resizingRef.current) return;
        const { tableNode } = resizingRef.current;
        // Re-fetch the table node in the write closure
        const latest = tableNode.getLatest();
        if ($isTableNode(latest)) {
          latest.setColWidths(colWidths);
        }
      });

      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    rootElement.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      rootElement.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [editor]);

  return null;
}

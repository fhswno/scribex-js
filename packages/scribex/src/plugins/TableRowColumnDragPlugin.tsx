"use client";

import { useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { createPortal } from "react-dom";
import {
  $getTableNodeFromLexicalNodeOrThrow,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { $getNearestNodeFromDOMNode } from "lexical";

export function TableRowColumnDragPlugin() {
  const [editor] = useLexicalComposerContext();
  const [dragHandle, setDragHandle] = useState<{
    type: "row" | "column";
    top: number;
    left: number;
    tableKey: string;
    index: number;
  } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const draggingRef = useRef<{
    type: "row" | "column";
    tableKey: string;
    sourceIndex: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) return; // Don't update handle while dragging

      const target = e.target as HTMLElement;
      const cell = target.closest("td, th") as HTMLTableCellElement | null;
      if (!cell) {
        setDragHandle(null);
        return;
      }

      const table = cell.closest("table") as HTMLTableElement | null;
      if (!table) {
        setDragHandle(null);
        return;
      }

      const cellRect = cell.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();

      // Show row drag handle on left edge
      const distFromLeft = e.clientX - cellRect.left;
      const distFromTop = e.clientY - cellRect.top;

      editor.read(() => {
        const lexicalNode = $getNearestNodeFromDOMNode(table);
        if (!lexicalNode || !$isTableNode(lexicalNode)) return;

        const tableKey = lexicalNode.getKey();

        if (distFromLeft < 12 && cell.cellIndex === 0) {
          // Row handle on the left side of first column
          const row = cell.closest("tr");
          if (!row) return;
          const rowIndex = Array.from(table.rows).indexOf(row);
          setDragHandle({
            type: "row",
            top: cellRect.top + cellRect.height / 2 - 8,
            left: tableRect.left - 20,
            tableKey,
            index: rowIndex,
          });
        } else if (distFromTop < 12 && cell.closest("tr") === table.rows[0]) {
          // Column handle on top of first row
          setDragHandle({
            type: "column",
            top: tableRect.top - 20,
            left: cellRect.left + cellRect.width / 2 - 8,
            tableKey,
            index: cell.cellIndex,
          });
        } else {
          setDragHandle(null);
        }
      });
    };

    const handleMouseLeave = () => {
      if (!draggingRef.current) {
        setDragHandle(null);
      }
    };

    rootElement.addEventListener("mousemove", handleMouseMove);
    rootElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      rootElement.removeEventListener("mousemove", handleMouseMove);
      rootElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [editor]);

  if (!portalContainer) return null;

  if (!dragHandle) return null;

  const handleDragStart = (e: React.DragEvent) => {
    if (!dragHandle) return;

    draggingRef.current = {
      type: dragHandle.type,
      tableKey: dragHandle.tableKey,
      sourceIndex: dragHandle.index,
    };

    // Set drag image to a small element
    const ghost = document.createElement("div");
    ghost.style.width = "20px";
    ghost.style.height = "20px";
    ghost.style.opacity = "0";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 10, 10);
    setTimeout(() => ghost.remove(), 0);

    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrag = (e: React.DragEvent) => {
    if (!draggingRef.current || e.clientX === 0) return;

    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    // Find the table and show drop indicator
    const tables = rootElement.querySelectorAll("table");
    for (const table of tables) {
      const tableRect = table.getBoundingClientRect();

      if (draggingRef.current.type === "row") {
        // Find the closest row boundary
        for (let i = 0; i <= table.rows.length; i++) {
          const row = table.rows[i] ?? table.rows[table.rows.length - 1];
          if (!row) continue;
          const rowRect = row.getBoundingClientRect();
          const boundary = i < table.rows.length ? rowRect.top : rowRect.bottom;

          if (Math.abs(e.clientY - boundary) < 15) {
            setDropIndicator({
              top: boundary - 1,
              left: tableRect.left,
              width: tableRect.width,
              height: 2,
            });
            return;
          }
        }
      } else {
        // Find the closest column boundary
        const firstRow = table.rows[0];
        if (!firstRow) continue;
        for (let i = 0; i <= firstRow.cells.length; i++) {
          const cell = firstRow.cells[i] ?? firstRow.cells[firstRow.cells.length - 1];
          if (!cell) continue;
          const cellRect = cell.getBoundingClientRect();
          const boundary = i < firstRow.cells.length ? cellRect.left : cellRect.right;

          if (Math.abs(e.clientX - boundary) < 15) {
            setDropIndicator({
              top: tableRect.top,
              left: boundary - 1,
              width: 2,
              height: tableRect.height,
            });
            return;
          }
        }
      }
    }
    setDropIndicator(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (!draggingRef.current) return;

    const { type, tableKey, sourceIndex } = draggingRef.current;
    const rootElement = editor.getRootElement();

    if (rootElement) {
      // Determine target index from drop position
      editor.update(() => {
        const tables = rootElement.querySelectorAll("table");
        for (const table of tables) {
          const lexicalNode = $getNearestNodeFromDOMNode(table);
          if (!lexicalNode || !$isTableNode(lexicalNode)) continue;
          if (lexicalNode.getKey() !== tableKey) continue;

          if (type === "row") {
            let targetIndex = -1;
            for (let i = 0; i <= table.rows.length; i++) {
              const row = table.rows[i] ?? table.rows[table.rows.length - 1];
              if (!row) continue;
              const rowRect = row.getBoundingClientRect();
              const boundary = i < table.rows.length ? rowRect.top : rowRect.bottom;
              if (Math.abs(e.clientY - boundary) < 15) {
                targetIndex = i;
                break;
              }
            }

            if (targetIndex >= 0 && targetIndex !== sourceIndex && targetIndex !== sourceIndex + 1) {
              const rows = lexicalNode.getChildren().filter((c) => $isTableRowNode(c)) as TableRowNode[];
              const sourceRow = rows[sourceIndex];
              if (!sourceRow) return;

              // Adjust target after removal
              const adjustedTarget = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
              const targetRow = rows[adjustedTarget];

              if (targetRow && targetRow !== sourceRow) {
                if (targetIndex > sourceIndex) {
                  targetRow.insertAfter(sourceRow);
                } else {
                  targetRow.insertBefore(sourceRow);
                }
              }
            }
          } else {
            // Column reorder
            let targetIndex = -1;
            const firstRow = table.rows[0];
            if (!firstRow) return;

            for (let i = 0; i <= firstRow.cells.length; i++) {
              const cell = firstRow.cells[i] ?? firstRow.cells[firstRow.cells.length - 1];
              if (!cell) continue;
              const cellRect = cell.getBoundingClientRect();
              const boundary = i < firstRow.cells.length ? cellRect.left : cellRect.right;
              if (Math.abs(e.clientX - boundary) < 15) {
                targetIndex = i;
                break;
              }
            }

            if (targetIndex >= 0 && targetIndex !== sourceIndex && targetIndex !== sourceIndex + 1) {
              const rows = lexicalNode.getChildren().filter((c) => $isTableRowNode(c)) as TableRowNode[];
              for (const row of rows) {
                const cells = row.getChildren().filter((c) => $isTableCellNode(c)) as TableCellNode[];
                const sourceCell = cells[sourceIndex];
                if (!sourceCell) continue;

                const adjustedTarget = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
                const targetCell = cells[adjustedTarget];

                if (targetCell && targetCell !== sourceCell) {
                  if (targetIndex > sourceIndex) {
                    targetCell.insertAfter(sourceCell);
                  } else {
                    targetCell.insertBefore(sourceCell);
                  }
                }
              }

              // Also reorder colWidths if set
              const colWidths = lexicalNode.getColWidths();
              if (colWidths) {
                const newWidths = [...colWidths];
                const [moved] = newWidths.splice(sourceIndex, 1);
                if (moved !== undefined) {
                  const insertAt = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
                  newWidths.splice(insertAt, 0, moved);
                  lexicalNode.setColWidths(newWidths);
                }
              }
            }
          }
        }
      });
    }

    draggingRef.current = null;
    setDragHandle(null);
    setDropIndicator(null);
  };

  return createPortal(
    <>
      {/* Drag handle */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        data-testid={`table-drag-handle-${dragHandle.type}`}
        style={{
          position: "fixed",
          zIndex: 50,
          top: `${dragHandle.top}px`,
          left: `${dragHandle.left}px`,
          width: "16px",
          height: "16px",
          borderRadius: "3px",
          backgroundColor: "rgba(0, 0, 0, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: dragHandle.type === "row" ? "grab" : "grab",
          fontSize: "10px",
          color: "rgba(0, 0, 0, 0.35)",
          userSelect: "none",
        }}
      >
        {dragHandle.type === "row" ? "\u2261" : "\u2016"}
      </div>

      {/* Drop indicator */}
      {dropIndicator && (
        <div
          data-testid="table-drop-indicator"
          style={{
            position: "fixed",
            zIndex: 51,
            top: `${dropIndicator.top}px`,
            left: `${dropIndicator.left}px`,
            width: `${dropIndicator.width}px`,
            height: `${dropIndicator.height}px`,
            backgroundColor: "var(--scribex-accent, #007AFF)",
            borderRadius: "1px",
            pointerEvents: "none",
          }}
        />
      )}
    </>,
    portalContainer,
  );
}

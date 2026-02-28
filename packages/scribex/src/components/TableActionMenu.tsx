"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { createPortal } from "react-dom";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import {
  $getTableCellNodeFromLexicalNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $insertTableRowAtSelection,
  $insertTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $deleteTableColumnAtSelection,
  $mergeCells,
  $unmergeCell,
  $isTableCellNode,
  $isTableSelection,
  TableCellNode,
} from "@lexical/table";

import type { ColorPalette } from "../data/color-palette";
import { DEFAULT_COLOR_PALETTE } from "../data/color-palette";

// Cell background colors — derived from highlight palette
const CELL_BG_COLORS = [
  { label: "Default", value: "", swatch: "transparent" },
  { label: "Gray", value: "var(--scribex-cell-bg-gray)", swatch: "#f1f1ef" },
  { label: "Brown", value: "var(--scribex-cell-bg-brown)", swatch: "#f4f0ee" },
  { label: "Orange", value: "var(--scribex-cell-bg-orange)", swatch: "#fbecdd" },
  { label: "Yellow", value: "var(--scribex-cell-bg-yellow)", swatch: "#fbf3db" },
  { label: "Green", value: "var(--scribex-cell-bg-green)", swatch: "#edf3ec" },
  { label: "Blue", value: "var(--scribex-cell-bg-blue)", swatch: "#e7f3f8" },
  { label: "Purple", value: "var(--scribex-cell-bg-purple)", swatch: "#f4f0f7" },
  { label: "Pink", value: "var(--scribex-cell-bg-pink)", swatch: "#f9f0f5" },
  { label: "Red", value: "var(--scribex-cell-bg-red)", swatch: "#fdebec" },
];

type MenuAction =
  | "insert-row-above"
  | "insert-row-below"
  | "insert-col-left"
  | "insert-col-right"
  | "delete-row"
  | "delete-col"
  | "merge-cells"
  | "unmerge-cell"
  | "delete-table";

interface MenuItem {
  id: MenuAction | "cell-color";
  label: string;
  danger?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "insert-row-above", label: "Insert row above" },
  { id: "insert-row-below", label: "Insert row below" },
  { id: "insert-col-left", label: "Insert column left" },
  { id: "insert-col-right", label: "Insert column right" },
  { id: "delete-row", label: "Delete row" },
  { id: "delete-col", label: "Delete column" },
  { id: "merge-cells", label: "Merge cells" },
  { id: "unmerge-cell", label: "Unmerge cell" },
  { id: "cell-color", label: "Cell background" },
  { id: "delete-table", label: "Delete table", danger: true },
];

export function TableActionMenu() {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColorSubmenu, setShowColorSubmenu] = useState(false);
  const [currentCellBg, setCurrentCellBg] = useState<string | null>(null);
  const [hasTableSelection, setHasTableSelection] = useState(false);
  const [canUnmerge, setCanUnmerge] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  // Right-click on table cell to open menu
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleContextMenu = (e: MouseEvent) => {
      editor.read(() => {
        const selection = $getSelection();
        if (!selection) return;

        // Check if we're in a table cell
        let cellNode: TableCellNode | null = null;

        if ($isRangeSelection(selection)) {
          cellNode = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
        } else if ($isTableSelection(selection)) {
          const nodes = selection.getNodes();
          const firstCell = nodes.find((n) => $isTableCellNode(n));
          cellNode = firstCell ? (firstCell as TableCellNode) : null;
          setHasTableSelection(true);
        }

        if (!cellNode) return;

        e.preventDefault();
        e.stopPropagation();

        setCurrentCellBg(cellNode.getBackgroundColor());
        setCanUnmerge(cellNode.getColSpan() > 1 || cellNode.getRowSpan() > 1);

        if ($isTableSelection(selection)) {
          setHasTableSelection(true);
        } else {
          setHasTableSelection(false);
        }

        setPosition({ top: e.clientY, left: e.clientX });
        setIsOpen(true);
        setShowColorSubmenu(false);
      });
    };

    rootElement.addEventListener("contextmenu", handleContextMenu);
    return () => rootElement.removeEventListener("contextmenu", handleContextMenu);
  }, [editor]);

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = useCallback(
    (action: MenuAction) => {
      setIsOpen(false);

      editor.update(() => {
        switch (action) {
          case "insert-row-above":
            $insertTableRowAtSelection(false);
            break;
          case "insert-row-below":
            $insertTableRowAtSelection(true);
            break;
          case "insert-col-left":
            $insertTableColumnAtSelection(false);
            break;
          case "insert-col-right":
            $insertTableColumnAtSelection(true);
            break;
          case "delete-row":
            $deleteTableRowAtSelection();
            break;
          case "delete-col":
            $deleteTableColumnAtSelection();
            break;
          case "merge-cells": {
            const selection = $getSelection();
            if ($isTableSelection(selection)) {
              const nodes = selection.getNodes();
              const cells = nodes.filter((n): n is TableCellNode =>
                $isTableCellNode(n),
              );
              if (cells.length > 1) {
                $mergeCells(cells);
              }
            }
            break;
          }
          case "unmerge-cell":
            $unmergeCell();
            break;
          case "delete-table": {
            const selection = $getSelection();
            if (!selection) break;
            let cellNode: TableCellNode | null = null;
            if ($isRangeSelection(selection)) {
              cellNode = $getTableCellNodeFromLexicalNode(
                selection.anchor.getNode(),
              );
            } else if ($isTableSelection(selection)) {
              const nodes = selection.getNodes();
              const firstCell = nodes.find((n) => $isTableCellNode(n));
              cellNode = firstCell ? (firstCell as TableCellNode) : null;
            }
            if (cellNode) {
              const tableNode = $getTableNodeFromLexicalNodeOrThrow(cellNode);
              tableNode.remove();
            }
            break;
          }
        }
      });
    },
    [editor],
  );

  const handleCellColor = useCallback(
    (color: string) => {
      setIsOpen(false);

      editor.update(() => {
        const selection = $getSelection();
        if (!selection) return;

        const setCellBg = (cell: TableCellNode) => {
          cell.setBackgroundColor(color || null);
        };

        if ($isTableSelection(selection)) {
          const nodes = selection.getNodes();
          for (const node of nodes) {
            if ($isTableCellNode(node)) {
              setCellBg(node);
            }
          }
        } else if ($isRangeSelection(selection)) {
          const cellNode = $getTableCellNodeFromLexicalNode(
            selection.anchor.getNode(),
          );
          if (cellNode) {
            setCellBg(cellNode);
          }
        }
      });
    },
    [editor],
  );

  if (!isOpen || !portalContainer) return null;

  return createPortal(
    <div
      ref={menuRef}
      data-testid="table-action-menu"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        zIndex: 100,
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: "180px",
        borderRadius: "10px",
        border: "1px solid var(--scribex-popover-border)",
        backgroundColor: "var(--scribex-popover-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "var(--scribex-popover-shadow)",
        padding: "4px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {MENU_ITEMS.map((item) => {
        // Hide merge when no table selection
        if (item.id === "merge-cells" && !hasTableSelection) return null;
        // Hide unmerge when cell isn't merged
        if (item.id === "unmerge-cell" && !canUnmerge) return null;

        if (item.id === "cell-color") {
          return (
            <div key={item.id} style={{ position: "relative" }}>
              <button
                type="button"
                data-testid="table-action-cell-color"
                onMouseEnter={() => setShowColorSubmenu(true)}
                onClick={() => setShowColorSubmenu((prev) => !prev)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "default",
                  backgroundColor: "transparent",
                  fontSize: "13px",
                  color: "var(--scribex-foreground, #1d1d1f)",
                }}
              >
                <span>{item.label}</span>
                <span style={{ fontSize: "10px", color: "var(--scribex-text-tertiary)" }}>
                  {"\u25B6"}
                </span>
              </button>

              {showColorSubmenu && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "100%",
                    marginLeft: "4px",
                    borderRadius: "10px",
                    border: "1px solid var(--scribex-popover-border)",
                    backgroundColor: "var(--scribex-popover-bg)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    boxShadow: "var(--scribex-popover-shadow)",
                    padding: "6px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "2px",
                    width: "140px",
                  }}
                >
                  {CELL_BG_COLORS.map((color) => (
                    <button
                      key={color.label}
                      type="button"
                      title={color.label}
                      data-testid={`table-cell-color-${color.label.toLowerCase()}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCellColor(color.value);
                      }}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        border:
                          currentCellBg === color.value ||
                          (!currentCellBg && color.value === "")
                            ? "2px solid var(--scribex-accent, #007AFF)"
                            : "1px solid var(--scribex-popover-border)",
                        cursor: "pointer",
                        backgroundColor:
                          color.swatch === "transparent"
                            ? "transparent"
                            : color.swatch,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {color.swatch === "transparent" && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--scribex-text-tertiary)",
                          }}
                        >
                          {"\u2205"}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        // Separator before delete table
        const showSep = item.id === "delete-table";

        return (
          <div key={item.id}>
            {showSep && (
              <div
                style={{
                  height: "0.5px",
                  backgroundColor: "var(--scribex-separator)",
                  margin: "3px 6px",
                }}
              />
            )}
            <button
              type="button"
              data-testid={`table-action-${item.id}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleAction(item.id as MenuAction);
              }}
              onMouseEnter={() => setShowColorSubmenu(false)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "none",
                cursor: "default",
                backgroundColor: "transparent",
                fontSize: "13px",
                color: item.danger
                  ? "var(--scribex-destructive, #e03e3e)"
                  : "var(--scribex-foreground, #1d1d1f)",
              }}
            >
              {item.label}
            </button>
          </div>
        );
      })}
    </div>,
    portalContainer,
  );
}

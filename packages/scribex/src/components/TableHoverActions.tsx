"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { createPortal } from "react-dom";
import {
  $createNodeSelection,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $setSelection,
} from "lexical";
import {
  $isTableNode,
  $isTableRowNode,
  $isTableCellNode,
  $insertTableRowAtSelection,
  $insertTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $deleteTableColumnAtSelection,
} from "@lexical/table";

// ─── Types ──────────────────────────────────────────────────────────────────

type MenuType = "row" | "column";

interface MenuState {
  type: MenuType;
  top: number;
  left: number;
  /** Row or column index the menu targets */
  index: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TableHoverActions() {
  const [editor] = useLexicalComposerContext();
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  // Refs for the currently hovered table
  const activeTableRef = useRef<HTMLTableElement | null>(null);
  const activeTableKeyRef = useRef<string | null>(null);

  // Refs for overlay containers (imperative positioning)
  const rowHandlesRef = useRef<HTMLDivElement>(null);
  const colHandlesRef = useRef<HTMLDivElement>(null);
  const addRowBtnRef = useRef<HTMLDivElement>(null);
  const addColBtnRef = useRef<HTMLDivElement>(null);
  const tableGripRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const resizeGuideRef = useRef<HTMLDivElement>(null);

  // Resize drag state
  const resizingRef = useRef<{
    columnIndex: number;
    startX: number;
    startWidth: number;
    colWidths: number[];
    tableElement: HTMLTableElement;
    tableNodeKey: string;
  } | null>(null);

  // Touch device check
  const isTouchRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    isTouchRef.current = window.matchMedia("(pointer: coarse)").matches;
    setPortalContainer(document.body);
  }, []);

  // ─── Hide all overlays ──────────────────────────────────────────────────

  const hideAll = useCallback(() => {
    const els = [
      rowHandlesRef.current,
      colHandlesRef.current,
      addRowBtnRef.current,
      addColBtnRef.current,
      tableGripRef.current,
      resizeHandleRef.current,
    ];
    for (const el of els) {
      if (el) el.style.visibility = "hidden";
    }
  }, []);

  // ─── Get column widths from table DOM ───────────────────────────────────

  const getColumnWidths = useCallback((table: HTMLTableElement): number[] => {
    const firstRow = table.rows[0];
    if (!firstRow) return [];
    const widths: number[] = [];
    for (let i = 0; i < firstRow.cells.length; i++) {
      widths.push(firstRow.cells[i]!.offsetWidth);
    }
    return widths;
  }, []);

  // ─── Select a specific cell in the active table ───────────────────────

  const selectCell = useCallback(
    (rowIndex: number, colIndex: number) => {
      const key = activeTableKeyRef.current;
      if (!key) return;

      editor.update(() => {
        const tableNode = $getNodeByKey(key);
        if (!tableNode || !$isTableNode(tableNode)) return;
        const rows = tableNode.getChildren().filter($isTableRowNode);
        const row = rows[rowIndex];
        if (!row) return;
        const cells = row.getChildren().filter($isTableCellNode);
        const cell = cells[colIndex];
        if (!cell) return;
        cell.selectEnd();
      });
    },
    [editor],
  );

  // ─── Insert row at index ────────────────────────────────────────────────

  const insertRowAt = useCallback(
    (rowIndex: number, after: boolean) => {
      const key = activeTableKeyRef.current;
      if (!key) return;

      editor.update(() => {
        const tableNode = $getNodeByKey(key);
        if (!tableNode || !$isTableNode(tableNode)) return;

        const rows = tableNode.getChildren().filter($isTableRowNode);
        const targetRow = rows[rowIndex];
        if (!targetRow) return;
        const cells = targetRow.getChildren().filter($isTableCellNode);
        const cell = cells[0];
        if (!cell) return;

        cell.selectEnd();
        $insertTableRowAtSelection(after);
      });
      editor.focus();
    },
    [editor],
  );

  // ─── Insert column at index ─────────────────────────────────────────────

  const insertColAt = useCallback(
    (colIndex: number, after: boolean) => {
      const key = activeTableKeyRef.current;
      if (!key) return;

      editor.update(() => {
        const tableNode = $getNodeByKey(key);
        if (!tableNode || !$isTableNode(tableNode)) return;

        const rows = tableNode.getChildren().filter($isTableRowNode);
        const firstRow = rows[0];
        if (!firstRow) return;
        const cells = firstRow.getChildren().filter($isTableCellNode);
        const cell = cells[colIndex];
        if (!cell) return;

        cell.selectEnd();
        $insertTableColumnAtSelection(after);
      });
      editor.focus();
    },
    [editor],
  );

  // ─── Delete row at index ──────────────────────────────────────────────

  const deleteRowAt = useCallback(
    (rowIndex: number) => {
      const key = activeTableKeyRef.current;
      if (!key) return;

      editor.update(() => {
        const tableNode = $getNodeByKey(key);
        if (!tableNode || !$isTableNode(tableNode)) return;

        const rows = tableNode.getChildren().filter($isTableRowNode);
        // Don't delete the last remaining row
        if (rows.length <= 1) return;

        const targetRow = rows[rowIndex];
        if (!targetRow) return;
        const cells = targetRow.getChildren().filter($isTableCellNode);
        const cell = cells[0];
        if (!cell) return;

        cell.selectEnd();
        $deleteTableRowAtSelection();
      });
      editor.focus();
    },
    [editor],
  );

  // ─── Delete column at index ───────────────────────────────────────────

  const deleteColAt = useCallback(
    (colIndex: number) => {
      const key = activeTableKeyRef.current;
      if (!key) return;

      editor.update(() => {
        const tableNode = $getNodeByKey(key);
        if (!tableNode || !$isTableNode(tableNode)) return;

        const rows = tableNode.getChildren().filter($isTableRowNode);
        const firstRow = rows[0];
        if (!firstRow) return;
        const cells = firstRow.getChildren().filter($isTableCellNode);
        // Don't delete the last remaining column
        if (cells.length <= 1) return;

        const cell = cells[colIndex];
        if (!cell) return;

        cell.selectEnd();
        $deleteTableColumnAtSelection();
      });
      editor.focus();
    },
    [editor],
  );

  // ─── Select table (NodeSelection) ──────────────────────────────────────

  const selectTable = useCallback(() => {
    const key = activeTableKeyRef.current;
    if (!key) return;

    editor.update(() => {
      const nodeSelection = $createNodeSelection();
      nodeSelection.add(key);
      $setSelection(nodeSelection);
    });
    editor.focus();
  }, [editor]);

  // ─── Build row/column handle elements ─────────────────────────────────

  const buildRowHandles = useCallback(
    (tableEl: HTMLTableElement, tableRect: DOMRect) => {
      const container = rowHandlesRef.current;
      if (!container) return;

      container.style.visibility = "visible";

      // Build handle elements for each row
      const handles: string[] = [];
      for (let i = 0; i < tableEl.rows.length; i++) {
        const row = tableEl.rows[i]!;
        const rowRect = row.getBoundingClientRect();
        handles.push(
          `<div data-row-handle="${i}" style="
            position:fixed;
            top:${rowRect.top}px;
            left:${tableRect.left - 28}px;
            width:22px;
            height:${rowRect.height}px;
            display:flex;
            align-items:center;
            justify-content:center;
            cursor:pointer;
            border-radius:4px;
            color:rgba(0,0,0,0.2);
            transition:background-color 100ms, color 100ms;
          ">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect x="0" y="1" width="10" height="2" rx="1"/>
              <rect x="0" y="5" width="10" height="2" rx="1"/>
            </svg>
          </div>`,
        );
      }
      container.innerHTML = handles.join("");

      // Attach event listeners
      const handleEls = container.querySelectorAll("[data-row-handle]");
      handleEls.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.addEventListener("mouseenter", () => {
          htmlEl.style.backgroundColor = "rgba(0, 0, 0, 0.06)";
          htmlEl.style.color = "rgba(0, 0, 0, 0.5)";
        });
        htmlEl.addEventListener("mouseleave", () => {
          htmlEl.style.backgroundColor = "transparent";
          htmlEl.style.color = "rgba(0, 0, 0, 0.2)";
        });
        htmlEl.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(htmlEl.dataset.rowHandle ?? "0", 10);
          const rect = htmlEl.getBoundingClientRect();
          setMenu({
            type: "row",
            top: rect.top,
            left: rect.left - 4,
            index: idx,
          });
        });
      });
    },
    [],
  );

  const buildColHandles = useCallback(
    (tableEl: HTMLTableElement, tableRect: DOMRect) => {
      const container = colHandlesRef.current;
      if (!container) return;

      container.style.visibility = "visible";

      const firstRow = tableEl.rows[0];
      if (!firstRow) return;

      const handles: string[] = [];
      for (let i = 0; i < firstRow.cells.length; i++) {
        const cell = firstRow.cells[i]!;
        const cellRect = cell.getBoundingClientRect();
        handles.push(
          `<div data-col-handle="${i}" style="
            position:fixed;
            top:${tableRect.top - 24}px;
            left:${cellRect.left}px;
            width:${cellRect.width}px;
            height:20px;
            display:flex;
            align-items:center;
            justify-content:center;
            cursor:pointer;
            border-radius:4px;
            color:rgba(0,0,0,0.2);
            transition:background-color 100ms, color 100ms;
          ">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect x="1" y="0" width="2" height="10" rx="1"/>
              <rect x="5" y="0" width="2" height="10" rx="1"/>
            </svg>
          </div>`,
        );
      }
      container.innerHTML = handles.join("");

      // Attach event listeners
      const handleEls = container.querySelectorAll("[data-col-handle]");
      handleEls.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.addEventListener("mouseenter", () => {
          htmlEl.style.backgroundColor = "rgba(0, 0, 0, 0.06)";
          htmlEl.style.color = "rgba(0, 0, 0, 0.5)";
        });
        htmlEl.addEventListener("mouseleave", () => {
          htmlEl.style.backgroundColor = "transparent";
          htmlEl.style.color = "rgba(0, 0, 0, 0.2)";
        });
        htmlEl.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(htmlEl.dataset.colHandle ?? "0", 10);
          const rect = htmlEl.getBoundingClientRect();
          setMenu({
            type: "column",
            top: rect.top - 4,
            left: rect.left,
            index: idx,
          });
        });
      });
    },
    [],
  );

  // ─── Mousemove: detect hovered table & position overlays ────────────────

  useEffect(() => {
    if (isTouchRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Don't reposition during resize drag
      if (resizingRef.current) return;

      const target = e.target as HTMLElement;

      // Check if we're hovering a portal element (our own UI)
      if (target.closest("[data-table-hover-actions]")) return;

      const tableEl = target.closest("table") as HTMLTableElement | null;

      if (!tableEl) {
        // Check if mouse is near the currently active table (for edge buttons)
        const active = activeTableRef.current;
        if (active) {
          const r = active.getBoundingClientRect();
          const margin = 40;
          if (
            e.clientX >= r.left - margin &&
            e.clientX <= r.right + margin &&
            e.clientY >= r.top - margin &&
            e.clientY <= r.bottom + margin
          ) {
            return;
          }
        }
        activeTableRef.current = null;
        activeTableKeyRef.current = null;
        setMenu(null);
        hideAll();
        return;
      }

      // Resolve Lexical TableNode
      let tableKey: string | null = null;
      editor.read(() => {
        const lexNode = $getNearestNodeFromDOMNode(tableEl);
        if (lexNode && $isTableNode(lexNode)) {
          tableKey = lexNode.getKey();
        } else {
          const parent = tableEl.parentElement;
          if (parent) {
            const parentNode = $getNearestNodeFromDOMNode(parent);
            if (parentNode && $isTableNode(parentNode)) {
              tableKey = parentNode.getKey();
            }
          }
        }
      });

      if (!tableKey) {
        hideAll();
        return;
      }

      // If it's the same table, just update resize handle position
      if (activeTableRef.current === tableEl) {
        const r = tableEl.getBoundingClientRect();
        positionResizeHandle(e, tableEl, r);
        return;
      }

      activeTableRef.current = tableEl;
      activeTableKeyRef.current = tableKey;

      const r = tableEl.getBoundingClientRect();

      // Build row handles (left side)
      buildRowHandles(tableEl, r);

      // Build column handles (top side)
      buildColHandles(tableEl, r);

      // Position "+" row button (bottom edge)
      if (addRowBtnRef.current) {
        const btn = addRowBtnRef.current;
        btn.style.visibility = "visible";
        btn.style.top = `${r.bottom + 2}px`;
        btn.style.left = `${r.left}px`;
        btn.style.width = `${r.width}px`;
      }

      // Position "+" column button (right edge)
      if (addColBtnRef.current) {
        const btn = addColBtnRef.current;
        btn.style.visibility = "visible";
        btn.style.top = `${r.top}px`;
        btn.style.left = `${r.right + 2}px`;
        btn.style.height = `${r.height}px`;
      }

      // Position table grip (top-left corner)
      if (tableGripRef.current) {
        const grip = tableGripRef.current;
        grip.style.visibility = "visible";
        grip.style.top = `${r.top - 26}px`;
        grip.style.left = `${r.left - 28}px`;
      }

      // Position resize handle near column borders
      positionResizeHandle(e, tableEl, r);
    };

    const positionResizeHandle = (
      e: MouseEvent,
      tableEl: HTMLTableElement,
      r: DOMRect,
    ) => {
      const handle = resizeHandleRef.current;
      if (!handle) return;

      const firstRow = tableEl.rows[0];
      if (!firstRow) return;

      for (let i = 0; i < firstRow.cells.length - 1; i++) {
        const cell = firstRow.cells[i]!;
        const cellRect = cell.getBoundingClientRect();
        const borderX = cellRect.right;

        if (Math.abs(e.clientX - borderX) < 12) {
          handle.style.visibility = "visible";
          handle.style.top = `${r.top}px`;
          handle.style.left = `${borderX - 2}px`;
          handle.style.height = `${r.height}px`;
          handle.dataset.columnIndex = String(i);
          return;
        }
      }

      handle.style.visibility = "hidden";
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [editor, hideAll, buildRowHandles, buildColHandles]);

  // ─── Column resize drag lifecycle ───────────────────────────────────────

  useEffect(() => {
    if (isTouchRef.current) return;

    const handle = resizeHandleRef.current;
    if (!handle) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const tableEl = activeTableRef.current;
      const tableKey = activeTableKeyRef.current;
      if (!tableEl || !tableKey) return;

      const colIndex = parseInt(handle.dataset.columnIndex ?? "0", 10);
      const colWidths = getColumnWidths(tableEl);
      const startWidth = colWidths[colIndex] ?? 0;

      resizingRef.current = {
        columnIndex: colIndex,
        startX: e.clientX,
        startWidth,
        colWidths: [...colWidths],
        tableElement: tableEl,
        tableNodeKey: tableKey,
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      if (resizeGuideRef.current) {
        const r = tableEl.getBoundingClientRect();
        const guide = resizeGuideRef.current;
        guide.style.visibility = "visible";
        guide.style.top = `${r.top}px`;
        guide.style.height = `${r.height}px`;
        guide.style.left = `${e.clientX}px`;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;

      const { columnIndex, startX, startWidth, colWidths, tableElement } =
        resizingRef.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(40, startWidth + delta);
      colWidths[columnIndex] = newWidth;

      const cols = tableElement.querySelectorAll("colgroup col");
      const col = cols[columnIndex] as HTMLElement | undefined;
      if (col) {
        col.style.width = `${newWidth}px`;
      }

      if (resizeGuideRef.current) {
        resizeGuideRef.current.style.left = `${e.clientX}px`;
      }
    };

    const onMouseUp = () => {
      if (!resizingRef.current) return;

      const { colWidths, tableNodeKey } = resizingRef.current;

      editor.update(() => {
        const tableNode = $getNodeByKey(tableNodeKey);
        if (tableNode && $isTableNode(tableNode)) {
          tableNode.getLatest().setColWidths(colWidths);
        }
      });

      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (resizeGuideRef.current) {
        resizeGuideRef.current.style.visibility = "hidden";
      }

      // Force re-render handles since column widths changed
      const tableEl = activeTableRef.current;
      if (tableEl) {
        const r = tableEl.getBoundingClientRect();
        buildColHandles(tableEl, r);
      }
    };

    handle.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      handle.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [editor, getColumnWidths, portalContainer, buildColHandles]);

  // ─── Close menu on outside click or Escape ────────────────────────────

  useEffect(() => {
    if (!menu) return;

    const handleClick = (e: MouseEvent) => {
      const menuEl = document.querySelector("[data-table-menu-popover]");
      if (menuEl && !menuEl.contains(e.target as Node)) {
        setMenu(null);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menu]);

  // ─── Don't render on touch or without portal ────────────────────────────

  if (!portalContainer || isTouchRef.current) return null;

  // ─── Menu action handler ──────────────────────────────────────────────

  const handleMenuAction = (action: string) => {
    if (!menu) return;
    const { type, index } = menu;
    setMenu(null);

    switch (action) {
      case "insert-above":
        insertRowAt(index, false);
        break;
      case "insert-below":
        insertRowAt(index, true);
        break;
      case "delete-row":
        deleteRowAt(index);
        break;
      case "insert-left":
        insertColAt(index, false);
        break;
      case "insert-right":
        insertColAt(index, true);
        break;
      case "delete-col":
        deleteColAt(index);
        break;
    }
  };

  // ─── Shared styles ──────────────────────────────────────────────────────

  const edgeButtonBase: React.CSSProperties = {
    position: "fixed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 45,
    visibility: "hidden" as const,
    borderRadius: "4px",
    border: "1px dashed rgba(0, 0, 0, 0.1)",
    backgroundColor: "transparent",
    color: "rgba(0, 0, 0, 0.2)",
    fontSize: "15px",
    fontWeight: 600,
    transition: "background-color 120ms, color 120ms, border-color 120ms",
  };

  const menuItemStyle: React.CSSProperties = {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    borderRadius: "5px",
    border: "none",
    cursor: "default",
    backgroundColor: "transparent",
    fontSize: "13px",
    color: "rgba(0, 0, 0, 0.7)",
  };

  const menuPopoverStyle: React.CSSProperties = {
    position: "fixed",
    minWidth: "160px",
    borderRadius: "8px",
    border: "1px solid rgba(0, 0, 0, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    boxShadow:
      "0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)",
    padding: "4px",
    zIndex: 100,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  };

  const MenuButton = ({
    label,
    action,
    destructive,
  }: {
    label: string;
    action: string;
    destructive?: boolean;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        handleMenuAction(action);
      }}
      style={{
        ...menuItemStyle,
        ...(destructive ? { color: "var(--scribex-destructive, #e03e3e)" } : {}),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {label}
    </button>
  );

  const Separator = () => (
    <div
      style={{
        height: "1px",
        backgroundColor: "rgba(0, 0, 0, 0.06)",
        margin: "3px 4px",
      }}
    />
  );

  return createPortal(
    <div data-table-hover-actions>
      {/* ── Row handles container ───────────────────────────────── */}
      <div ref={rowHandlesRef} style={{ visibility: "hidden" }} />

      {/* ── Column handles container ────────────────────────────── */}
      <div ref={colHandlesRef} style={{ visibility: "hidden" }} />

      {/* ── Column resize handle ──────────────────────────────────── */}
      <div
        ref={resizeHandleRef}
        style={{
          position: "fixed",
          width: "6px",
          cursor: "col-resize",
          zIndex: 47,
          visibility: "hidden",
          backgroundColor: "transparent",
          transition: "background-color 100ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.backgroundColor =
            "var(--scribex-accent, #007AFF)";
        }}
        onMouseLeave={(e) => {
          if (!resizingRef.current) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor =
              "transparent";
          }
        }}
      />

      {/* ── Resize guide line ─────────────────────────────────────── */}
      <div
        ref={resizeGuideRef}
        style={{
          position: "fixed",
          width: "1px",
          backgroundColor: "var(--scribex-accent, #007AFF)",
          opacity: 0.5,
          zIndex: 48,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      />

      {/* ── "+ Row" button (bottom edge) ──────────────────────────── */}
      <div
        ref={addRowBtnRef}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const table = activeTableRef.current;
          if (!table) return;
          const lastRowIdx = table.rows.length - 1;
          if (lastRowIdx >= 0) insertRowAt(lastRowIdx, true);
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.backgroundColor = "var(--scribex-muted, #f1f5f9)";
          el.style.color = "var(--scribex-accent, #007AFF)";
          el.style.borderColor = "var(--scribex-accent, #007AFF)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.backgroundColor = "transparent";
          el.style.color = "rgba(0, 0, 0, 0.2)";
          el.style.borderColor = "rgba(0, 0, 0, 0.1)";
        }}
        style={{
          ...edgeButtonBase,
          height: "20px",
        }}
      >
        +
      </div>

      {/* ── "+ Column" button (right edge) ────────────────────────── */}
      <div
        ref={addColBtnRef}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const table = activeTableRef.current;
          if (!table) return;
          const firstRow = table.rows[0];
          if (!firstRow) return;
          const lastColIdx = firstRow.cells.length - 1;
          if (lastColIdx >= 0) insertColAt(lastColIdx, true);
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.backgroundColor = "var(--scribex-muted, #f1f5f9)";
          el.style.color = "var(--scribex-accent, #007AFF)";
          el.style.borderColor = "var(--scribex-accent, #007AFF)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.backgroundColor = "transparent";
          el.style.color = "rgba(0, 0, 0, 0.2)";
          el.style.borderColor = "rgba(0, 0, 0, 0.1)";
        }}
        style={{
          ...edgeButtonBase,
          width: "20px",
        }}
      >
        +
      </div>

      {/* ── Table grip handle (top-left corner) — click to select ── */}
      <div
        ref={tableGripRef}
        title="Click to select table, then press Delete to remove"
        onMouseDown={(e) => {
          e.preventDefault();
          selectTable();
        }}
        style={{
          position: "fixed",
          width: "22px",
          height: "22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "4px",
          cursor: "pointer",
          color: "rgba(0, 0, 0, 0.25)",
          backgroundColor: "transparent",
          zIndex: 46,
          visibility: "hidden",
          transition: "background-color 100ms, color 100ms",
          fontSize: "14px",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.backgroundColor = "rgba(0, 0, 0, 0.06)";
          el.style.color = "rgba(0, 0, 0, 0.5)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.backgroundColor = "transparent";
          el.style.color = "rgba(0, 0, 0, 0.25)";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.2" />
          <circle cx="10" cy="3" r="1.2" />
          <circle cx="4" cy="7" r="1.2" />
          <circle cx="10" cy="7" r="1.2" />
          <circle cx="4" cy="11" r="1.2" />
          <circle cx="10" cy="11" r="1.2" />
        </svg>
      </div>

      {/* ── Context menu popover ────────────────────────────────── */}
      {menu && (
        <div
          data-table-hover-actions
          data-table-menu-popover
          onMouseDown={(e) => e.preventDefault()}
          style={{
            ...menuPopoverStyle,
            top: `${menu.top}px`,
            left:
              menu.type === "column"
                ? `${menu.left}px`
                : menu.type === "row"
                  ? `${menu.left - 164}px`
                  : `${menu.left}px`,
          }}
        >
          {menu.type === "row" && (
            <>
              <MenuButton label="Insert row above" action="insert-above" />
              <MenuButton label="Insert row below" action="insert-below" />
              <Separator />
              <MenuButton label="Delete row" action="delete-row" destructive />
            </>
          )}
          {menu.type === "column" && (
            <>
              <MenuButton label="Insert column left" action="insert-left" />
              <MenuButton label="Insert column right" action="insert-right" />
              <Separator />
              <MenuButton label="Delete column" action="delete-col" destructive />
            </>
          )}
        </div>
      )}
    </div>,
    portalContainer,
  );
}

"use client";

// REACT
import { useCallback, useEffect, useRef, useState } from "react";

// REACT DOM
import { createPortal } from "react-dom";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from "lexical";

// INTERNAL
import { OPEN_LINK_INPUT_COMMAND } from "../commands";

// LEXICAL LINK
import {
  $isLinkNode,
  $toggleLink,
  TOGGLE_LINK_COMMAND,
  LinkNode,
} from "@lexical/link";

// PHOSPHOR ICONS
import {
  LinkIcon,
  PencilSimpleIcon,
  TrashIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LinkInputRenderProps {
  initialUrl: string;
  onSubmit: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export interface LinkPreviewRenderProps {
  url: string;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export interface LinkPluginConfig {
  /** Custom render for the link input popover. */
  renderLinkInput?: (props: LinkInputRenderProps) => React.ReactNode;
  /** Custom render for the link preview popover. */
  renderLinkPreview?: (props: LinkPreviewRenderProps) => React.ReactNode;
  /** Validate URL before applying (default: basic URL validation). */
  validateUrl?: (url: string) => boolean;
  /** Link target behavior (default: "_blank"). */
  target?: string;
  /** Link rel attribute (default: "noopener noreferrer"). */
  rel?: string;
}

// ─── Plugin Component ───────────────────────────────────────────────────────

export function LinkPlugin({ config = {} }: { config?: LinkPluginConfig } = {}) {
  const [editor] = useLexicalComposerContext();
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const [showInput, setShowInput] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [inputPosition, setInputPosition] = useState({ top: 0, left: 0 });
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const [currentUrl, setCurrentUrl] = useState("");
  const [editingUrl, setEditingUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const target = config.target ?? "_blank";
  const rel = config.rel ?? "noopener noreferrer";

  const validateUrl =
    config.validateUrl ??
    ((url: string) => {
      try {
        // Allow URLs with or without protocol
        const withProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`;
        new URL(withProtocol);
        return true;
      } catch {
        return false;
      }
    });

  // Portal container
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  // Register TOGGLE_LINK_COMMAND handler (required for $toggleLink to work)
  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_LINK_COMMAND,
      (payload) => {
        if (payload === null) {
          $toggleLink(null);
        } else if (typeof payload === "string") {
          $toggleLink(payload, { target, rel });
        } else {
          $toggleLink(payload.url, {
            target: payload.target ?? target,
            rel: payload.rel ?? rel,
            title: payload.title ?? null,
          });
        }
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, target, rel]);

  // Get the position of the current selection
  const getSelectionPosition = useCallback(() => {
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0) {
      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      return {
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
      };
    }
    return { top: 0, left: 0 };
  }, []);

  // Find if cursor is inside a LinkNode
  const findLinkNode = useCallback((): LinkNode | null => {
    let linkNode: LinkNode | null = null;
    editor.read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const node = selection.anchor.getNode();
      const parent = node.getParent();
      if ($isLinkNode(parent)) {
        linkNode = parent;
      } else if ($isLinkNode(node)) {
        linkNode = node;
      }
    });
    return linkNode;
  }, [editor]);

  // Open link input popover
  const openInput = useCallback(
    (initialUrl = "") => {
      setEditingUrl(initialUrl);
      setInputPosition(getSelectionPosition());
      setShowPreview(false);
      setShowInput(true);

      // Focus input after render (only for built-in input)
      if (!config.renderLinkInput) {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
      }
    },
    [getSelectionPosition, config.renderLinkInput],
  );

  // Close everything
  const closeAll = useCallback(() => {
    setShowInput(false);
    setShowPreview(false);
    setCurrentUrl("");
    setEditingUrl("");
    editor.focus();
  }, [editor]);

  // Submit a link URL
  const submitLink = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        closeAll();
        return;
      }

      // Add protocol if missing
      const finalUrl = trimmed.match(/^https?:\/\//)
        ? trimmed
        : `https://${trimmed}`;

      if (!validateUrl(finalUrl)) {
        closeAll();
        return;
      }

      editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
        url: finalUrl,
        target,
        rel,
      });
      closeAll();
    },
    [editor, validateUrl, target, rel, closeAll],
  );

  // Remove link
  const removeLink = useCallback(() => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    closeAll();
  }, [editor, closeAll]);

  // Shared logic for opening the link input
  const triggerLinkInput = useCallback(() => {
    const linkNode = findLinkNode();
    if (linkNode) {
      openInput(linkNode.getURL());
    } else {
      let hasSelection = false;
      editor.read(() => {
        const selection = $getSelection();
        if (
          $isRangeSelection(selection) &&
          !selection.isCollapsed()
        ) {
          hasSelection = true;
        }
      });

      if (hasSelection) {
        openInput();
      }
    }
  }, [editor, findLinkNode, openInput]);

  // Double-click on a link opens it in a new tab
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleDblClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor || !rootElement.contains(anchor)) return;

      const href = anchor.getAttribute("href");
      if (href) {
        event.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
      }
    };

    rootElement.addEventListener("dblclick", handleDblClick);
    return () => rootElement.removeEventListener("dblclick", handleDblClick);
  }, [editor]);

  // Cmd+K shortcut — listen on document for reliable interception
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        // Only handle if our editor has focus
        const rootElement = editor.getRootElement();
        if (!rootElement) return;
        const activeElement = document.activeElement;
        if (!rootElement.contains(activeElement) && activeElement !== rootElement) return;

        event.preventDefault();
        event.stopPropagation();
        triggerLinkInput();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    // Signal that the link plugin's keyboard handler is ready
    const rootElement = editor.getRootElement();
    if (rootElement) {
      rootElement.setAttribute("data-link-plugin-ready", "true");
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      const el = editor.getRootElement();
      if (el) {
        el.removeAttribute("data-link-plugin-ready");
      }
    };
  }, [editor, triggerLinkInput]);

  // Listen for OPEN_LINK_INPUT_COMMAND (from FloatingToolbar link button)
  useEffect(() => {
    return editor.registerCommand(
      OPEN_LINK_INPUT_COMMAND,
      () => {
        triggerLinkInput();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, triggerLinkInput]);

  // Detect cursor inside link for preview popover
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        // Don't show preview if input is open
        if (showInput) return false;

        const linkNode = findLinkNode();
        if (linkNode) {
          setCurrentUrl(linkNode.getURL());
          setPreviewPosition(getSelectionPosition());
          setShowPreview(true);
        } else {
          if (showPreview) {
            setShowPreview(false);
            setCurrentUrl("");
          }
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, findLinkNode, getSelectionPosition, showInput, showPreview]);

  if (!portalContainer) return null;

  // ─── Link Input Popover ─────────────────────────────────────────────────

  const inputRenderProps: LinkInputRenderProps = {
    initialUrl: editingUrl,
    onSubmit: submitLink,
    onRemove: removeLink,
    onClose: closeAll,
    position: inputPosition,
  };

  const inputPopover = showInput
    ? createPortal(
        config.renderLinkInput ? (
          config.renderLinkInput(inputRenderProps)
        ) : (
          <LinkInputPopover
            ref={inputRef}
            {...inputRenderProps}
          />
        ),
        portalContainer,
      )
    : null;

  // ─── Link Preview Popover ───────────────────────────────────────────────

  const previewRenderProps: LinkPreviewRenderProps = {
    url: currentUrl,
    onEdit: () => openInput(currentUrl),
    onRemove: removeLink,
    onClose: () => {
      setShowPreview(false);
      setCurrentUrl("");
    },
    position: previewPosition,
  };

  const previewPopover =
    showPreview && !showInput
      ? createPortal(
          config.renderLinkPreview ? (
            config.renderLinkPreview(previewRenderProps)
          ) : (
            <LinkPreviewPopover {...previewRenderProps} />
          ),
          portalContainer,
        )
      : null;

  return (
    <>
      {inputPopover}
      {previewPopover}
    </>
  );
}

// ─── Link Input Popover (built-in) ─────────────────────────────────────────

import { forwardRef } from "react";

const LinkInputPopover = forwardRef<HTMLInputElement, LinkInputRenderProps>(
  function LinkInputPopover(
    { initialUrl, onSubmit, onRemove, onClose, position },
    ref,
  ) {
    const [value, setValue] = useState(initialUrl);
    const containerRef = useRef<HTMLDivElement>(null);
    const isEditing = initialUrl !== "";

    // Initialize value when initialUrl changes
    useEffect(() => {
      setValue(initialUrl);
    }, [initialUrl]);

    // Close on click outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          onClose();
        }
      };

      const raf = requestAnimationFrame(() => {
        document.addEventListener("mousedown", handleClickOutside);
      });
      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [onClose]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit(value);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    return (
      <div
        ref={containerRef}
        data-testid="link-input-popover"
        style={{
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: "translateX(-50%)",
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 8px 6px 12px",
          borderRadius: "12px",
          border: "1px solid var(--scribex-popover-border)",
          backgroundColor: "var(--scribex-popover-bg)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow: "var(--scribex-popover-shadow)",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
          animation: "scribex-link-enter 0.15s ease-out",
          minWidth: "300px",
        }}
      >
        <LinkIcon size={14} style={{ color: "var(--scribex-text-tertiary)", flexShrink: 0 }} />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste or type a link..."
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "13px",
            color: "var(--scribex-foreground, #0f172a)",
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          data-testid="link-input-apply"
          onMouseDown={(e) => {
            e.preventDefault();
            onSubmit(value);
          }}
          disabled={!value.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px 10px",
            borderRadius: "8px",
            border: "none",
            cursor: value.trim() ? "pointer" : "default",
            backgroundColor: value.trim()
              ? "var(--scribex-accent, #007AFF)"
              : "var(--scribex-hover-bg)",
            color: value.trim() ? "var(--scribex-accent-foreground, #fff)" : "var(--scribex-text-tertiary)",
            fontSize: "12px",
            fontWeight: 500,
            fontFamily: "inherit",
            transition: "background-color 0.15s, color 0.15s",
          }}
        >
          {isEditing ? "Update" : "Apply"}
        </button>
        {isEditing && (
          <button
            type="button"
            data-testid="link-input-remove"
            onMouseDown={(e) => {
              e.preventDefault();
              onRemove();
            }}
            title="Remove link"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              backgroundColor: "transparent",
              color: "var(--scribex-destructive, #ef4444)",
              transition: "background-color 0.15s",
            }}
          >
            <TrashIcon size={14} />
          </button>
        )}

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes scribex-link-enter {
                from {
                  opacity: 0;
                  transform: translateX(-50%) translateY(-4px) scale(0.98);
                }
                to {
                  opacity: 1;
                  transform: translateX(-50%) translateY(0) scale(1);
                }
              }
            `,
          }}
        />
      </div>
    );
  },
);

// ─── Link Preview Popover (built-in) ───────────────────────────────────────

function LinkPreviewPopover({
  url,
  onEdit,
  onRemove,
  onClose,
  position,
}: LinkPreviewRenderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClickOutside);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Truncate long URLs for display
  const displayUrl =
    url.length > 40 ? url.slice(0, 37) + "..." : url;

  return (
    <div
      ref={containerRef}
      data-testid="link-preview-popover"
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 6px 5px 12px",
        borderRadius: "10px",
        border: "1px solid var(--scribex-popover-border)",
        backgroundColor: "var(--scribex-popover-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "var(--scribex-popover-shadow)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
        animation: "scribex-link-preview-enter 0.12s ease-out",
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: "12px",
          color: "var(--scribex-accent, #007AFF)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "200px",
        }}
        title={url}
      >
        {displayUrl}
      </a>

      <div
        style={{
          width: "1px",
          height: "16px",
          backgroundColor: "var(--scribex-separator)",
          flexShrink: 0,
        }}
      />

      <button
        type="button"
        data-testid="link-preview-open"
        onMouseDown={(e) => {
          e.preventDefault();
          window.open(url, "_blank", "noopener,noreferrer");
        }}
        title="Open in new tab"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "26px",
          height: "26px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
          backgroundColor: "transparent",
          color: "var(--scribex-icon-secondary)",
        }}
      >
        <ArrowSquareOutIcon size={14} />
      </button>

      <button
        type="button"
        data-testid="link-preview-edit"
        onMouseDown={(e) => {
          e.preventDefault();
          onEdit();
        }}
        title="Edit link"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "26px",
          height: "26px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
          backgroundColor: "transparent",
          color: "var(--scribex-icon-secondary)",
        }}
      >
        <PencilSimpleIcon size={14} />
      </button>

      <button
        type="button"
        data-testid="link-preview-remove"
        onMouseDown={(e) => {
          e.preventDefault();
          onRemove();
        }}
        title="Remove link"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "26px",
          height: "26px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
          backgroundColor: "transparent",
          color: "var(--scribex-destructive, #ef4444)",
        }}
      >
        <TrashIcon size={14} />
      </button>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes scribex-link-preview-enter {
              from {
                opacity: 0;
                transform: translateX(-50%) translateY(-2px);
              }
              to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
              }
            }
          `,
        }}
      />
    </div>
  );
}

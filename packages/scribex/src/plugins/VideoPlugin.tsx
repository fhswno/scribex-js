"use client";

// REACT
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

// REACT DOM
import { createPortal } from "react-dom";

// LEXICAL
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_LOW,
} from "lexical";

// INTERNAL
import type { UploadHandler } from "../types";
import { INSERT_VIDEO_COMMAND, OPEN_VIDEO_INPUT_COMMAND } from "../commands";
import {
  $createLoadingVideoNode,
  $isLoadingVideoNode,
} from "../nodes/LoadingVideoNode";
import { $createVideoNode } from "../nodes/VideoNode";
import { parseVideoEmbed } from "../utils/video-embeds";

// PHOSPHOR
import {
  PaperPlaneRightIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";

// ─── Render prop types ──────────────────────────────────────────────────────

export interface VideoEmbedRenderProps {
  src: string;
  provider: string;
  title: string;
}

export interface VideoFileRenderProps {
  src: string;
  title: string;
}

// ─── Default validation ─────────────────────────────────────────────────────

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_ALLOWED_FORMATS = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

// ─── Plugin Props ───────────────────────────────────────────────────────────

interface VideoPluginProps {
  /** Handler for uploading video files. Same interface as ImagePlugin. Omit to disable file uploads. */
  uploadHandler?: UploadHandler;
  /** Maximum file size in bytes. Default: 50MB. */
  maxFileSize?: number;
  /** Allowed MIME types for upload. Default: mp4, webm, quicktime. */
  allowedFormats?: string[];
  /** Called when a file is rejected (too large or wrong format). */
  onFileRejected?: (file: File, reason: "size" | "format") => void;
}

// ─── Plugin Component ───────────────────────────────────────────────────────

export function VideoPlugin({
  uploadHandler,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedFormats = DEFAULT_ALLOWED_FORMATS,
  onFileRejected,
}: VideoPluginProps = {}) {
  const [editor] = useLexicalComposerContext();
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [inputPosition, setInputPosition] = useState({ top: 0, left: 0 });
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const uploadHandlerRef = useRef(uploadHandler);
  uploadHandlerRef.current = uploadHandler;

  // Portal container
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalContainer(document.body);
  }, []);

  // Validate a file against size and format constraints
  const validateFile = useCallback(
    (file: File): boolean => {
      if (!allowedFormats.some((fmt) => file.type === fmt)) {
        onFileRejected?.(file, "format");
        return false;
      }
      if (file.size > maxFileSize) {
        onFileRejected?.(file, "size");
        return false;
      }
      return true;
    },
    [allowedFormats, maxFileSize, onFileRejected],
  );

  // Handle video file upload (same flow as ImagePlugin)
  const handleVideoUpload = useCallback(
    (file: File) => {
      const handler = uploadHandlerRef.current;
      if (!handler) return;
      if (!validateFile(file)) return;

      const objectURL = URL.createObjectURL(file);
      let loadingNodeKey: string | null = null;

      editor.update(() => {
        const loadingNode = $createLoadingVideoNode(objectURL, file.name);
        loadingNodeKey = loadingNode.getKey();

        const root = $getRoot();
        const selection = $getSelection();
        let targetBlock: import("lexical").LexicalNode | null = null;

        if ($isRangeSelection(selection)) {
          let node: import("lexical").LexicalNode = selection.anchor.getNode();
          while (!$isRootNode(node)) {
            const parent = node.getParent();
            if (!parent || $isRootNode(parent)) {
              if (parent) targetBlock = node;
              break;
            }
            node = parent;
          }
        }

        if (targetBlock && !$isRootNode(targetBlock)) {
          targetBlock.insertAfter(loadingNode);
        } else {
          root.append(loadingNode);
        }
      });

      handler(file)
        .then((remoteURL) => {
          editor.update(() => {
            if (!loadingNodeKey) return;
            const loadingNode = $getNodeByKey(loadingNodeKey);
            if (!loadingNode || !$isLoadingVideoNode(loadingNode)) return;

            const videoNode = $createVideoNode({
              src: remoteURL,
              videoType: "file",
              provider: "upload",
              title: file.name,
            });
            loadingNode.replace(videoNode);
          });
          URL.revokeObjectURL(objectURL);
        })
        .catch(() => {
          editor.update(() => {
            if (!loadingNodeKey) return;
            const loadingNode = $getNodeByKey(loadingNodeKey);
            if (!loadingNode) return;
            loadingNode.remove();
          });
          URL.revokeObjectURL(objectURL);
        });
    },
    [editor, validateFile],
  );

  // Handle video embed URL
  const handleVideoEmbed = useCallback(
    (url: string) => {
      const embedInfo = parseVideoEmbed(url);
      if (!embedInfo) return;

      editor.update(() => {
        const root = $getRoot();
        const selection = $getSelection();
        let targetBlock: import("lexical").LexicalNode | null = null;

        if ($isRangeSelection(selection)) {
          let node: import("lexical").LexicalNode = selection.anchor.getNode();
          while (!$isRootNode(node)) {
            const parent = node.getParent();
            if (!parent || $isRootNode(parent)) {
              if (parent) targetBlock = node;
              break;
            }
            node = parent;
          }
        }

        const videoNode = $createVideoNode({
          src: embedInfo.embedUrl,
          videoType: "embed",
          provider: embedInfo.provider,
          title: url,
        });

        if (targetBlock && !$isRootNode(targetBlock)) {
          // If block is empty, replace it
          const textContent = targetBlock.getTextContent();
          if (textContent.trim() === "") {
            targetBlock.replace(videoNode);
          } else {
            targetBlock.insertAfter(videoNode);
          }
        } else {
          root.append(videoNode);
        }
      });
    },
    [editor],
  );

  // Handle INSERT_VIDEO_COMMAND
  useEffect(() => {
    return editor.registerCommand(
      INSERT_VIDEO_COMMAND,
      (payload) => {
        if ("file" in payload) {
          handleVideoUpload(payload.file);
        } else {
          handleVideoEmbed(payload.url);
        }
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, handleVideoUpload, handleVideoEmbed]);

  // Handle OPEN_VIDEO_INPUT_COMMAND — show the URL input popover
  useEffect(() => {
    return editor.registerCommand(
      OPEN_VIDEO_INPUT_COMMAND,
      () => {
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setInputPosition({ top: rect.top, left: rect.left });
        }
        setIsInputOpen(true);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  // Handle drop events (only if uploadHandler provided)
  useEffect(() => {
    if (!uploadHandler) return;

    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const onDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const videoFiles = Array.from(files).filter((f) =>
        f.type.startsWith("video/"),
      );
      if (videoFiles.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      for (const file of videoFiles) {
        handleVideoUpload(file);
      }
    };

    rootElement.addEventListener("drop", onDrop);
    return () => rootElement.removeEventListener("drop", onDrop);
  }, [editor, uploadHandler, handleVideoUpload]);

  // Handle paste events (only if uploadHandler provided)
  useEffect(() => {
    if (!uploadHandler) return;

    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;

      const videoFiles = Array.from(files).filter((f) =>
        f.type.startsWith("video/"),
      );
      if (videoFiles.length === 0) return;

      e.preventDefault();

      for (const file of videoFiles) {
        handleVideoUpload(file);
      }
    };

    rootElement.addEventListener("paste", onPaste);
    return () => rootElement.removeEventListener("paste", onPaste);
  }, [editor, uploadHandler, handleVideoUpload]);

  // Submit from the URL input
  const handleSubmitUrl = useCallback(
    (url: string) => {
      setIsInputOpen(false);
      editor.dispatchCommand(INSERT_VIDEO_COMMAND, { url });
    },
    [editor],
  );

  // Submit from the file picker
  const handleSubmitFile = useCallback(
    (file: File) => {
      setIsInputOpen(false);
      editor.dispatchCommand(INSERT_VIDEO_COMMAND, { file });
    },
    [editor],
  );

  const handleClose = useCallback(() => {
    setIsInputOpen(false);
    editor.focus();
  }, [editor]);

  if (!portalContainer) return null;

  return (
    <>
      {isInputOpen &&
        createPortal(
          <VideoUrlInput
            position={inputPosition}
            onSubmitUrl={handleSubmitUrl}
            onSubmitFile={uploadHandler ? handleSubmitFile : undefined}
            onClose={handleClose}
            acceptFormats={allowedFormats}
          />,
          portalContainer,
        )}
    </>
  );
}

// ─── Video URL Input Popover ────────────────────────────────────────────────

interface VideoUrlInputProps {
  position: { top: number; left: number };
  onSubmitUrl: (url: string) => void;
  onSubmitFile?: (file: File) => void;
  onClose: () => void;
  acceptFormats: string[];
}

const VideoUrlInput = forwardRef<HTMLInputElement, VideoUrlInputProps>(
  function VideoUrlInput(
    { position, onSubmitUrl, onSubmitFile, onClose, acceptFormats },
    ref,
  ) {
    const [value, setValue] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const fileDialogOpenRef = useRef(false);

    // Close on click outside — skip while file dialog is open
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (fileDialogOpenRef.current) return;
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
        if (value.trim()) {
          onSubmitUrl(value.trim());
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    const openFilePicker = () => {
      if (!onSubmitFile) return;
      fileDialogOpenRef.current = true;

      const input = document.createElement("input");
      input.type = "file";
      input.accept = acceptFormats.join(",");
      input.onchange = () => {
        fileDialogOpenRef.current = false;
        const file = input.files?.[0];
        if (file && onSubmitFile) {
          onSubmitFile(file);
        }
      };
      // Handle cancel (user closes file dialog without selecting)
      window.addEventListener(
        "focus",
        () => {
          // Small delay — the focus event fires before onchange
          setTimeout(() => {
            fileDialogOpenRef.current = false;
          }, 300);
        },
        { once: true },
      );
      input.click();
    };

    return (
      <div
        ref={containerRef}
        data-testid="video-url-input"
        style={{
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 8px 6px 14px",
          borderRadius: "12px",
          border: "1px solid var(--scribex-popover-border, rgba(0,0,0,0.06))",
          backgroundColor: "var(--scribex-popover-bg)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow: "var(--scribex-popover-shadow)",
          fontFamily: "var(--scribex-font-sans, system-ui, sans-serif)",
          animation: "scribex-video-input-enter 0.2s ease-out",
          minWidth: "340px",
        }}
      >
        <input
          ref={(el) => {
            if (el) el.focus();
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste video URL..."
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "14px",
            color: "var(--scribex-foreground, #0f172a)",
            fontFamily: "inherit",
          }}
        />

        {/* Submit URL button */}
        <button
          type="button"
          data-testid="video-url-submit"
          onClick={() => {
            if (value.trim()) onSubmitUrl(value.trim());
          }}
          disabled={!value.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            border: "none",
            cursor: value.trim() ? "pointer" : "default",
            backgroundColor: value.trim()
              ? "var(--scribex-accent, #3b82f6)"
              : "var(--scribex-muted, #f1f5f9)",
            color: value.trim()
              ? "var(--scribex-accent-foreground, #fff)"
              : "var(--scribex-muted-foreground, #94a3b8)",
            transition: "background-color 0.15s, color 0.15s",
            flexShrink: 0,
          }}
        >
          <PaperPlaneRightIcon size={14} weight="fill" />
        </button>

        {/* Upload file button */}
        {onSubmitFile && (
          <button
            type="button"
            data-testid="video-file-upload"
            onClick={openFilePicker}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              backgroundColor: "var(--scribex-muted, #f1f5f9)",
              color: "var(--scribex-muted-foreground, #94a3b8)",
              transition: "background-color 0.15s",
              flexShrink: 0,
            }}
          >
            <UploadSimpleIcon size={14} weight="bold" />
          </button>
        )}

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes scribex-video-input-enter {
                from {
                  opacity: 0;
                  transform: translateY(-4px) scale(0.98);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
            `,
          }}
        />
      </div>
    );
  },
);

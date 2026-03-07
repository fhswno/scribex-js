"use client";

import { useEffect, useRef } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_LOW,
} from "lexical";

import {
  $createLoadingImageNode,
  $isLoadingImageNode,
} from "../nodes/LoadingImageNode";
import { $createImageNode } from "../nodes/ImageNode";

import { INSERT_IMAGE_COMMAND } from "../commands";

import type { UploadHandler } from "../types";

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_FORMATS = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

interface ImagePluginProps {
  uploadHandler: UploadHandler;
  /** Maximum file size in bytes. Default: 10MB. */
  maxFileSize?: number;
  /** Allowed MIME types. Default: jpeg, png, gif, webp, svg+xml. */
  allowedFormats?: string[];
  /** Called when a file is rejected (too large or wrong format). */
  onFileRejected?: (file: File, reason: "size" | "format") => void;
  /** Called when an upload fails. */
  onUploadError?: (file: File, error: unknown) => void;
}

export function ImagePlugin({
  uploadHandler,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedFormats = DEFAULT_ALLOWED_FORMATS,
  onFileRejected,
  onUploadError,
}: ImagePluginProps) {
  const [editor] = useLexicalComposerContext();
  const uploadHandlerRef = useRef(uploadHandler);
  uploadHandlerRef.current = uploadHandler;
  const onUploadErrorRef = useRef(onUploadError);
  onUploadErrorRef.current = onUploadError;

  const validateFile = (file: File): boolean => {
    if (!allowedFormats.some((fmt) => file.type === fmt)) {
      onFileRejected?.(file, "format");
      return false;
    }
    if (file.size > maxFileSize) {
      onFileRejected?.(file, "size");
      return false;
    }
    return true;
  };

  useEffect(() => {
    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      (file: File) => {
        if (!validateFile(file)) return true;
        handleImageUpload(file, editor, uploadHandlerRef.current, onUploadErrorRef.current);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, maxFileSize, allowedFormats, onFileRejected]);

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const onDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (imageFiles.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      for (const file of imageFiles) {
        if (!validateFile(file)) continue;
        handleImageUpload(file, editor, uploadHandlerRef.current, onUploadErrorRef.current);
      }
    };

    rootElement.addEventListener("drop", onDrop);
    return () => rootElement.removeEventListener("drop", onDrop);
  }, [editor, maxFileSize, allowedFormats, onFileRejected]);

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (imageFiles.length === 0) return;

      e.preventDefault();

      for (const file of imageFiles) {
        if (!validateFile(file)) continue;
        handleImageUpload(file, editor, uploadHandlerRef.current, onUploadErrorRef.current);
      }
    };

    rootElement.addEventListener("paste", onPaste);
    return () => rootElement.removeEventListener("paste", onPaste);
  }, [editor, maxFileSize, allowedFormats, onFileRejected]);

  return null;
}

function handleImageUpload(
  file: File,
  editor: ReturnType<typeof useLexicalComposerContext>[0],
  uploadHandler: UploadHandler,
  onUploadError?: (file: File, error: unknown) => void,
) {
  // Step 1: Create objectURL for optimistic preview
  const objectURL = URL.createObjectURL(file);

  // Step 2: Insert LoadingImageNode into the AST
  let loadingNodeKey: string | null = null;

  editor.update(() => {
    const loadingNode = $createLoadingImageNode(objectURL);
    loadingNodeKey = loadingNode.getKey();

    const root = $getRoot();
    const selection = $getSelection();

    // Find the top-level block to insert after
    let targetBlock: import("lexical").LexicalNode | null = null;

    if ($isRangeSelection(selection)) {
      let node: import("lexical").LexicalNode = selection.anchor.getNode();
      // Walk up to find the top-level block (direct child of root)
      while (!$isRootNode(node)) {
        const parent = node.getParent();
        if (!parent || $isRootNode(parent)) {
          // node is a direct child of root (or has no parent)
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

  // Step 3: Call the upload handler
  uploadHandler(file)
    .then((remoteURL) => {
      // Step 4: Replace LoadingImageNode with ImageNode
      try {
        editor.update(() => {
          if (!loadingNodeKey) return;

          const loadingNode = $getNodeByKey(loadingNodeKey);
          if (!loadingNode || !$isLoadingImageNode(loadingNode)) return;

          const imageNode = $createImageNode({
            src: remoteURL,
            altText: file.name,
          });

          loadingNode.replace(imageNode);
        });
      } catch {
        // Editor may have been disposed if component unmounted during upload
      }

      URL.revokeObjectURL(objectURL);
    })
    .catch((error: unknown) => {
      // Step 5: Remove LoadingImageNode on failure
      try {
        editor.update(() => {
          if (!loadingNodeKey) return;

          const loadingNode = $getNodeByKey(loadingNodeKey);
          if (!loadingNode) return;

          loadingNode.remove();
        });
      } catch {
        // Editor may have been disposed if component unmounted during upload
      }

      onUploadError?.(file, error);
      URL.revokeObjectURL(objectURL);
    });
}

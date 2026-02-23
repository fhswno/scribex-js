"use client";

// REACT
import { useEffect, useRef } from "react";

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

// NODES
import {
  $createLoadingImageNode,
  $isLoadingImageNode,
} from "../nodes/LoadingImageNode";
import { $createImageNode } from "../nodes/ImageNode";

// COMMANDS
import { INSERT_IMAGE_COMMAND } from "../commands";

// TYPES
import type { UploadHandler } from "../types";

interface ImagePluginProps {
  uploadHandler: UploadHandler;
}

export function ImagePlugin({ uploadHandler }: ImagePluginProps) {
  const [editor] = useLexicalComposerContext();
  const uploadHandlerRef = useRef(uploadHandler);
  uploadHandlerRef.current = uploadHandler;

  // Register INSERT_IMAGE_COMMAND handler
  useEffect(() => {
    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      (file: File) => {
        handleImageUpload(file, editor, uploadHandlerRef.current);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  // Handle drop events
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
        handleImageUpload(file, editor, uploadHandlerRef.current);
      }
    };

    rootElement.addEventListener("drop", onDrop);
    return () => rootElement.removeEventListener("drop", onDrop);
  }, [editor]);

  // Handle paste events with image files
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
        handleImageUpload(file, editor, uploadHandlerRef.current);
      }
    };

    rootElement.addEventListener("paste", onPaste);
    return () => rootElement.removeEventListener("paste", onPaste);
  }, [editor]);

  return null;
}

function handleImageUpload(
  file: File,
  editor: ReturnType<typeof useLexicalComposerContext>[0],
  uploadHandler: UploadHandler,
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

      URL.revokeObjectURL(objectURL);
    })
    .catch(() => {
      // Step 5: Remove LoadingImageNode on failure
      editor.update(() => {
        if (!loadingNodeKey) return;

        const loadingNode = $getNodeByKey(loadingNodeKey);
        if (!loadingNode) return;

        loadingNode.remove();
      });

      URL.revokeObjectURL(objectURL);
    });
}

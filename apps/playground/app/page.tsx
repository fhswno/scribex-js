"use client";

// SCRIBEX
import {
  EditorRoot,
  FloatingToolbar,
  SlashMenu,
  OverlayPortal,
  InputRulePlugin,
  ImagePlugin,
  useEditorState,
} from "@scribex/core";

// REACT
import { useCallback, useState } from "react";

// TYPES
import type { UploadHandler } from "@scribex/core";

/** Mock upload handler — simulates a 500ms upload and returns a placeholder URL */
const mockUploadHandler: UploadHandler = async (file: File): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Return a data URL from the file for demo purposes
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

function EditorStateDisplay() {
  // States
  const [saved, setSaved] = useState<string>("");

  // Callback - Change
  const handleChange = useCallback((json: string) => {
    setSaved(json);
  }, []);

  // Hook - Editor State
  const { serializedState } = useEditorState({ onChange: handleChange });

  return (
    <pre
      className="mt-4 text-xs overflow-auto max-h-60"
      data-testid="editor-state"
    >
      {serializedState || saved}
    </pre>
  );
}

export default function Page() {
  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Scribex Playground</h1>

      <EditorRoot
        namespace="playground-editor"
        className="relative min-h-50 p-4 border rounded ml-8"
      >
        <FloatingToolbar />
        <InputRulePlugin />
        <SlashMenu />
        <OverlayPortal namespace="playground-editor" />
        <ImagePlugin uploadHandler={mockUploadHandler} />
        <EditorStateDisplay />
      </EditorRoot>

      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4">
          Second Editor (Multi-Editor Test)
        </h2>
        <EditorRoot
          namespace="playground-editor-b"
          className="relative min-h-50 p-4 border rounded ml-8"
        >
          <FloatingToolbar />
          <InputRulePlugin />
          <SlashMenu />
          <OverlayPortal namespace="playground-editor-b" />
          <ImagePlugin uploadHandler={mockUploadHandler} />
          <EditorStateDisplay />
        </EditorRoot>
      </div>
    </main>
  );
}

"use client";

// SCRIBEX
import {
  EditorRoot,
  FloatingToolbar,
  SlashMenu,
  OverlayPortal,
  InputRulePlugin,
  ImagePlugin,
  AIPlugin,
  MentionPlugin,
  $createMentionNode,
  useEditorState,
} from "@scribex/core";

// REACT
import { useCallback, useState } from "react";

// TYPES
import type { UploadHandler, AIProvider, AIPluginConfig, MentionProvider } from "@scribex/core";

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

/**
 * Mistral AI provider — calls the playground's /api/editor/mistral route.
 * The route proxies to the Mistral API and returns a plain text stream.
 */
const mistralProvider: AIProvider = {
  name: "Mistral",
  generate: async ({ prompt, context, config }) => {
    const response = await fetch("/api/editor/mistral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        context,
        ...(config?.temperature != null && { temperature: config.temperature }),
        ...(config?.maxTokens != null && { maxTokens: config.maxTokens }),
        ...(config?.systemPrompt != null && { systemPrompt: config.systemPrompt }),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error((error as { error?: string }).error ?? `HTTP ${response.status}`);
    }

    // Convert the Uint8Array stream to a string stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    return new ReadableStream<string>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(decoder.decode(value, { stream: true }));
      },
    });
  },
};

/**
 * Ollama AI provider — calls the playground's /api/editor/ollama route.
 * The route proxies to a local Ollama instance and returns a plain text stream.
 */
const ollamaProvider: AIProvider = {
  name: "Ollama",
  generate: async ({ prompt, context, config }) => {
    const response = await fetch("/api/editor/ollama", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        context,
        ...(config?.temperature != null && { temperature: config.temperature }),
        ...(config?.maxTokens != null && { maxTokens: config.maxTokens }),
        ...(config?.systemPrompt != null && { systemPrompt: config.systemPrompt }),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error((error as { error?: string }).error ?? `HTTP ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    return new ReadableStream<string>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(decoder.decode(value, { stream: true }));
      },
    });
  },
};

// Default to Ollama for local development (no API key needed)
const aiProvider = ollamaProvider;

/** AI plugin configuration — demonstrates the customization surface */
const aiConfig: AIPluginConfig = {
  // Model-level configuration forwarded to the provider
  generate: {
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: "You are a helpful writing assistant. Respond with well-formatted Markdown. Be concise and direct.",
  },
  // Number of preceding blocks to include as context
  contextWindowSize: 5,
  // Lifecycle callbacks
  onError: (error) => {
    console.warn("[Scribex AI] Generation failed:", error.message);
  },
  onAccept: (content) => {
    console.log("[Scribex AI] Content accepted:", content.slice(0, 80) + "...");
  },
  onDiscard: () => {
    console.log("[Scribex AI] Content discarded");
  },
};

// ─── Mock Mention Providers ──────────────────────────────────────────────────

const MOCK_USERS = [
  { id: "1", label: "Alice", meta: "alice@example.com" },
  { id: "2", label: "Bob", meta: "bob@example.com" },
  { id: "3", label: "Charlie", meta: "charlie@example.com" },
  { id: "4", label: "Diana", meta: "diana@example.com" },
];

const MOCK_TAGS = [
  { id: "t1", label: "feature", meta: "Feature request" },
  { id: "t2", label: "bug", meta: "Bug report" },
  { id: "t3", label: "docs", meta: "Documentation" },
  { id: "t4", label: "design", meta: "Design related" },
];

const userMentionProvider: MentionProvider = {
  trigger: "@",
  onSearch: async (query) => {
    return MOCK_USERS.filter((u) =>
      u.label.toLowerCase().includes(query.toLowerCase()),
    );
  },
  renderItem: (item) => <span>{item.label}</span>,
  onSelect: (item) =>
    $createMentionNode({ id: item.id, label: item.label, trigger: "@" }),
};

const tagMentionProvider: MentionProvider = {
  trigger: "#",
  onSearch: async (query) => {
    return MOCK_TAGS.filter((t) =>
      t.label.toLowerCase().includes(query.toLowerCase()),
    );
  },
  renderItem: (item) => <span>{item.label}</span>,
  onSelect: (item) =>
    $createMentionNode({ id: item.id, label: item.label, trigger: "#" }),
};

const mentionProviders: MentionProvider[] = [
  userMentionProvider,
  tagMentionProvider,
];

// ─── Editor State Display ────────────────────────────────────────────────────

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
        <AIPlugin provider={aiProvider} config={aiConfig} />
        <MentionPlugin providers={mentionProviders} />
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
          <AIPlugin provider={aiProvider} config={aiConfig} />
          <MentionPlugin providers={mentionProviders} />
          <EditorStateDisplay />
        </EditorRoot>
      </div>
    </main>
  );
}

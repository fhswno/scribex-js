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
  PastePlugin,
  MobileToolbar,
  EmojiPickerPlugin,
  LinkPlugin,
  ColorPlugin,
  TablePlugin,
  TableActionMenu,
  TableHoverActions,
  $createMentionNode,
  useEditorState,
  sanitizePastedHTML,
} from "@scribex/core";

// REACT
import { useCallback, useEffect, useState } from "react";

// TYPES
import type {
  UploadHandler,
  AIProvider,
  AIPluginConfig,
  MentionProvider,
} from "@scribex/core";

/** Mock upload handler — simulates a 500ms upload and returns a placeholder URL */
const mockUploadHandler: UploadHandler = async (
  file: File,
): Promise<string> => {
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
        ...(config?.systemPrompt != null && {
          systemPrompt: config.systemPrompt,
        }),
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        (error as { error?: string }).error ?? `HTTP ${response.status}`,
      );
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
        ...(config?.systemPrompt != null && {
          systemPrompt: config.systemPrompt,
        }),
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        (error as { error?: string }).error ?? `HTTP ${response.status}`,
      );
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
    systemPrompt:
      "You are a helpful writing assistant. Respond with well-formatted Markdown. Be concise and direct.",
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

// ─── Hidden State Display (inside EditorRoot — satisfies test selectors) ─────

function HiddenStateDisplay({
  onStateChange,
}: {
  onStateChange: (state: string) => void;
}) {
  const handleChange = useCallback(
    (json: string) => {
      onStateChange(json);
    },
    [onStateChange],
  );

  const { serializedState } = useEditorState({ onChange: handleChange });

  return (
    <pre className="sr-only" data-testid="editor-state">
      {serializedState}
    </pre>
  );
}

// ─── JSON State Panel (outside EditorRoot — visible UI) ──────────────────────

function JsonStatePanel({ state }: { state: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const prettyJson = state
    ? (() => {
        try {
          return JSON.stringify(JSON.parse(state), null, 2);
        } catch {
          return state;
        }
      })()
    : "";

  const sizeKb = state ? (new Blob([state]).size / 1024).toFixed(1) : "0.0";

  const handleCopy = () => {
    if (!prettyJson) return;
    navigator.clipboard.writeText(prettyJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors rounded-lg hover:bg-neutral-100 cursor-pointer"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Editor State
        <span className="text-neutral-400">{sizeKb} KB</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl overflow-hidden bg-[#1e1e1e] border border-neutral-800">
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
            <span className="text-xs font-medium text-neutral-400">JSON</span>
            <button
              onClick={handleCopy}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-2 py-0.5 rounded hover:bg-neutral-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="p-4 text-xs text-neutral-300 font-mono overflow-auto max-h-80 json-panel-scroll leading-relaxed">
            {prettyJson}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Editor Card ─────────────────────────────────────────────────────────────

function EditorCard({
  namespace,
  label,
}: {
  namespace: string;
  label?: string;
}) {
  const [editorState, setEditorState] = useState("");

  return (
    <div>
      {label && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {label}
          </span>
        </div>
      )}
      <div className="rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow bg-white">
        <EditorRoot namespace={namespace} className="relative p-6 min-h-50">
          <FloatingToolbar />
          <InputRulePlugin />
          <SlashMenu />
          <OverlayPortal namespace={namespace} />
          <ImagePlugin uploadHandler={mockUploadHandler} />
          <AIPlugin provider={aiProvider} config={aiConfig} />
          <MentionPlugin providers={mentionProviders} />
          <ColorPlugin />
          <TablePlugin />
          <TableActionMenu />
          <TableHoverActions />
          <PastePlugin />
          <EmojiPickerPlugin />
          <LinkPlugin />
          <MobileToolbar />
          <HiddenStateDisplay onStateChange={setEditorState} />
        </EditorRoot>
      </div>
      <JsonStatePanel state={editorState} />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Page() {
  // Expose sanitizePastedHTML on window for Playwright unit tests
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__scribex_sanitize =
      sanitizePastedHTML;
  }, []);

  return (
    <main className="max-w-4xl mx-auto py-6 px-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 min-w-7 h-7 rounded-lg bg-blue-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-blue-900">
            Scribex Playground
          </h1>
          <span className="text-xs font-mono text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md">
            v0.0.1
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
            Open Source
          </span>
          <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
            Lexical
          </span>
          <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
            Next.js
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 hover:text-neutral-600 transition-colors ml-1"
            aria-label="GitHub"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Primary Editor */}
      <EditorCard namespace="playground-editor" />

      {/* Second Editor */}
      <div className="mt-8">
        <EditorCard
          namespace="playground-editor-b"
          label="Multi-Editor Isolation Test"
        />
      </div>

      {/* Stress Test Editors (c, d, e) — below the fold for multi-editor isolation tests */}
      <div className="mt-8" data-testid="stress-test-editors">
        <div className="mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Stress Test Editors
          </span>
        </div>
        <div className="space-y-6">
          <EditorCard namespace="playground-editor-c" label="Editor C" />
          <EditorCard namespace="playground-editor-d" label="Editor D" />
          <EditorCard namespace="playground-editor-e" label="Editor E" />
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-neutral-400">
        Built with Lexical, Radix UI, and Tailwind CSS
      </p>
    </main>
  );
}

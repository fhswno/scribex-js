"use client";

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
  ListPlugin,
  TablePlugin,
  TableActionMenu,
  TableHoverActions,
  CalloutPlugin,
  VideoPlugin,
  TogglePlugin,
  DirectionPlugin,
  BlockSelectionPlugin,
  $createMentionNode,
  useEditorState,
  sanitizePastedHTML,
  useLexicalComposerContext,
  $getSelection,
  $isRangeSelection,
  TextNode,
} from "@blokhaus/core";

import { useCallback, useEffect, useState } from "react";
import type {
  UploadHandler,
  AIProvider,
  AIPluginConfig,
  MentionProvider,
  SlashMenuItem,
  LexicalEditor,
} from "@blokhaus/core";

/** Mock upload handler — simulates a 500ms upload and returns a blob URL.
 *  In production, this would return a CDN URL from your upload service.
 *  We use blob URLs instead of data URLs to keep the editor state lightweight —
 *  a data URL embeds the entire file as base64, which makes JSON serialization
 *  extremely expensive and causes typing lag. */
const mockUploadHandler: UploadHandler = async (
  file: File,
): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return URL.createObjectURL(file);
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
  generate: {
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt:
      "You are a helpful writing assistant. Respond with well-formatted Markdown. Be concise and direct.",
  },
  contextWindowSize: 5,
  onError: (error) => {
    console.warn("[Blokhaus AI] Generation failed:", error.message);
  },
  onAccept: (content) => {
    console.log("[Blokhaus AI] Content accepted:", content.slice(0, 80) + "...");
  },
  onDiscard: () => {
    console.log("[Blokhaus AI] Content discarded");
  },
};

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

const ThemeIcon = ({ size }: { size?: number }) => {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  return isDark ? (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.36A88,88,0,0,1,65.64,67.09,89,89,0,0,1,96,48.11,104.1,104.1,0,0,0,152,104a104.1,104.1,0,0,0,55.89,56A89,89,0,0,1,188.9,190.36Z" />
    </svg>
  );
};

function createThemeToggleItem(
  toggleTheme: () => void,
  editor: LexicalEditor,
): SlashMenuItem {
  return {
    id: "toggle-theme",
    label: "Toggle Theme",
    description: "Switch between light and dark mode",
    keywords: ["theme", "dark", "light", "mode", "night"],
    icon: ThemeIcon,
    onSelect: () => {
      // Remove the "/" trigger text before toggling
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const anchor = selection.anchor.getNode();
        if (anchor instanceof TextNode) {
          anchor.remove();
        }
      });
      toggleTheme();
    },
  };
}

function EditorPlugins({
  namespace,
  toggleTheme,
}: {
  namespace: string;
  toggleTheme: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const themeItem = createThemeToggleItem(toggleTheme, editor);

  return (
    <>
      <FloatingToolbar />
      <InputRulePlugin />
      <SlashMenu items={[themeItem]} />
      <OverlayPortal namespace={namespace} />
      <ImagePlugin uploadHandler={mockUploadHandler} />
      <AIPlugin provider={aiProvider} config={aiConfig} />
      <MentionPlugin providers={mentionProviders} />
      <ColorPlugin />
      <ListPlugin />
      <TablePlugin />
      <TableActionMenu />
      <TableHoverActions />
      <CalloutPlugin />
      <VideoPlugin uploadHandler={mockUploadHandler} />
      <TogglePlugin />
      <DirectionPlugin />
      <BlockSelectionPlugin />
      <PastePlugin />
      <EmojiPickerPlugin />
      <LinkPlugin />
      <MobileToolbar />
    </>
  );
}

// Satisfies test selectors for state display
function HiddenStateDisplay({
  onStateChange,
}: {
  onStateChange: (state: string) => void;
}) {
  const stateRef = useCallback(
    (node: HTMLPreElement | null) => {
      if (node) {
        node.dataset.ready = "true";
      }
    },
    [],
  );

  const handleChange = useCallback(
    (json: string) => {
      onStateChange(json);
      // Update the DOM directly to avoid React re-rendering the full JSON string
      const el = document.querySelector('[data-testid="editor-state"]');
      if (el) el.textContent = json;
    },
    [onStateChange],
  );

  useEditorState({ onChange: handleChange, debounceMs: 500 });

  return (
    <pre className="sr-only" data-testid="editor-state" ref={stateRef} />
  );
}

function EditorCard({
  namespace,
  label,
  toggleTheme,
}: {
  namespace: string;
  label?: string;
  toggleTheme: () => void;
}) {
  const [editorState, setEditorState] = useState("");
  const [showState, setShowState] = useState(false);

  const prettyJson = editorState
    ? (() => {
        try {
          return JSON.stringify(JSON.parse(editorState), null, 2);
        } catch {
          return editorState;
        }
      })()
    : "";

  return (
    <div>
      {label && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">{label}</span>
        </div>
      )}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <EditorRoot namespace={namespace} className="relative p-4 min-h-32">
          <EditorPlugins namespace={namespace} toggleTheme={toggleTheme} />
          <HiddenStateDisplay onStateChange={setEditorState} />
        </EditorRoot>
      </div>
      {editorState && (
        <button
          onClick={() => setShowState(!showState)}
          className="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
        >
          {showState ? "Hide state" : "Show state"}
        </button>
      )}
      {showState && (
        <pre className="mt-1 p-3 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono bg-neutral-50 dark:bg-neutral-900 rounded-lg overflow-auto max-h-48 leading-relaxed">
          {prettyJson}
        </pre>
      )}
    </div>
  );
}

export default function Page() {
  const [editorState, setEditorState] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDevEditors, setShowDevEditors] = useState(false);
  const [dark, setDark] = useState(false);
  const toggleTheme = useCallback(() => setDark((d) => !d), []);

  // Expose sanitizePastedHTML on window for Playwright unit tests
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__blokhaus_sanitize =
      sanitizePastedHTML;
  }, []);

  // Toggle .dark class on <html> and apply blokhaus tokens
  useEffect(() => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [dark]);

  // Only compute pretty JSON when the panel is visible
  const prettyJson = showJson && editorState
    ? (() => {
        try {
          return JSON.stringify(JSON.parse(editorState), null, 2);
        } catch {
          return editorState;
        }
      })()
    : "";

  // Use string length as a fast size approximation (avoids Blob allocation)
  const sizeKb = editorState
    ? (editorState.length / 1024).toFixed(1)
    : "0.0";

  const handleCopy = () => {
    if (!prettyJson) return;
    navigator.clipboard.writeText(prettyJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 transition-colors">
      <nav className="sticky top-0 z-30 flex h-11 items-center justify-between px-3 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-100 dark:border-neutral-800 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Blokhaus
          </span>
          <span className="text-[11px] text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-[13px] text-neutral-400 dark:text-neutral-500">Playground</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDark((d) => !d)}
            className="flex items-center justify-center w-7 h-7 rounded text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowJson((s) => !s)}
            className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors cursor-pointer ${
              showJson
                ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 1.5C4 .67 3.33 0 2.5 0S1 .67 1 1.5v4c0 .83-.67 1.5-1.5 1.5v1C.83 8 1.5 8.67 1.5 9.5v4c0 .83.67 1.5 1.5 1.5h1v-1H3c-.55 0-1-.45-1-1V9.5C2 8.67 1.33 8 .5 8c.83 0 1.5-.67 1.5-1.5V3c0-.55.45-1 1-1h1V1H4zm8 0c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5v4c0 .83.67 1.5 1.5 1.5v1c-.83 0-1.5.67-1.5 1.5v4c0 .83-.67 1.5-1.5 1.5h-1v-1h1c.55 0 1-.45 1-1V9.5c0-.83.67-1.5 1.5-1.5-.83 0-1.5-.67-1.5-1.5V3c0-.55-.45-1-1-1h-1V1h0z" />
            </svg>
            {sizeKb} KB
          </button>
          <a
            href="https://github.com/fhswno/blokhaus-js"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-7 h-7 rounded text-neutral-300 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            aria-label="GitHub"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-180 px-6 pt-20 pb-48">
        <EditorRoot
          namespace="playground-editor"
          className="relative min-h-[70vh]"
        >
          <EditorPlugins namespace="playground-editor" toggleTheme={toggleTheme} />
          <HiddenStateDisplay onStateChange={setEditorState} />
        </EditorRoot>
      </main>

      <div className="mx-auto max-w-180 px-6 pb-20">
        <div className="border-t border-neutral-100 dark:border-neutral-800 pt-8">
          <button
            onClick={() => setShowDevEditors((d) => !d)}
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors cursor-pointer"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showDevEditors ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            Multi-editor isolation
          </button>

          {showDevEditors && (
            <div className="mt-6 space-y-6">
              <EditorCard namespace="playground-editor-b" label="Editor B" toggleTheme={toggleTheme} />
              <div data-testid="stress-test-editors" className="space-y-6">
                <EditorCard namespace="playground-editor-c" label="Editor C" toggleTheme={toggleTheme} />
                <EditorCard namespace="playground-editor-d" label="Editor D" toggleTheme={toggleTheme} />
                <EditorCard namespace="playground-editor-e" label="Editor E" toggleTheme={toggleTheme} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showJson && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-[#1a1a1a] border-t border-[#2a2a2a] shadow-[0_-4px_32px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between px-4 h-9 border-b border-[#2a2a2a]">
            <span className="text-[11px] font-medium text-neutral-500">
              Editor State
              <span className="ml-2 text-neutral-600">{sizeKb} KB</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="text-[11px] text-neutral-500 hover:text-neutral-300 px-2 py-0.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => setShowJson(false)}
                className="flex items-center justify-center w-6 h-6 text-neutral-500 hover:text-neutral-300 rounded hover:bg-white/5 transition-colors cursor-pointer"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M2 2l6 6M8 2l-6 6" />
                </svg>
              </button>
            </div>
          </div>
          <pre className="p-4 text-[11px] text-neutral-400 font-mono overflow-auto max-h-[35vh] leading-relaxed json-panel-scroll">
            {prettyJson}
          </pre>
        </div>
      )}
    </div>
  );
}

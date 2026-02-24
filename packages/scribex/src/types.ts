import type { LexicalEditor, LexicalNode, TextNode } from 'lexical';

// --- Asset Pipeline (Section 9) ---

export type UploadHandler = (file: File) => Promise<string>;

// --- AI Integration ---

/** Model-level configuration passed to the provider's generate() call. */
export interface AIGenerateConfig {
  /** Sampling temperature (0–2). Lower = more deterministic. Provider-specific. */
  temperature?: number;
  /** Maximum tokens to generate. Provider-specific. */
  maxTokens?: number;
  /** System prompt / persona for the model. */
  systemPrompt?: string;
}

/** Parameters passed to AIProvider.generate(). */
export interface AIGenerateParams {
  /** The user's prompt text. */
  prompt: string;
  /** Surrounding editor content serialized as Markdown. */
  context: string;
  /** Optional model-level configuration. */
  config?: AIGenerateConfig;
}

export interface AIProvider {
  /** Human-readable name (e.g., "Mistral", "Ollama") */
  name: string;
  /**
   * Called with a prompt, surrounding editor context, and optional model config.
   * Must return a ReadableStream of text chunks.
   * The library consumes this stream — it does not care about the underlying provider.
   */
  generate: (params: AIGenerateParams) => Promise<ReadableStream<string>>;
}

/** Labels for the AIPreviewNode buttons and header. All optional with sensible defaults. */
export interface AIPreviewLabels {
  /** Header label (default: "AI") */
  header?: string;
  /** Streaming status text (default: "generating...") */
  streaming?: string;
  /** Accept button label (default: "Accept") */
  accept?: string;
  /** Discard button label (default: "Discard") */
  discard?: string;
  /** Retry button label (default: "Retry") */
  retry?: string;
  /** Dismiss button label for error state (default: "Dismiss") */
  dismiss?: string;
  /** Default error message when no specific message is available (default: "An error occurred") */
  defaultError?: string;
}

/** Retry configuration for the AIPreviewNode. */
export interface AIRetryConfig {
  /** Maximum number of retries allowed. Set to 0 to disable retry. Default: Infinity */
  maxRetries?: number;
}

/** Props for a custom AI prompt input component. */
export interface AIPromptInputRenderProps {
  /** Current position for fixed positioning */
  position: { top: number; left: number };
  /** Call with the prompt text to submit */
  onSubmit: (prompt: string) => void;
  /** Call to close/cancel the prompt */
  onClose: () => void;
}

/**
 * Full configuration for the AI integration.
 * Pass to AIPlugin to customize every aspect of the AI experience.
 */
export interface AIPluginConfig {
  /** Model-level configuration (temperature, maxTokens, systemPrompt) */
  generate?: AIGenerateConfig;
  /** Custom labels for the preview node UI */
  labels?: AIPreviewLabels;
  /** Retry configuration */
  retry?: AIRetryConfig;
  /** Number of preceding blocks to include as context. Default: 3 */
  contextWindowSize?: number;
  /** Called when the AI stream encounters an error. Useful for logging/telemetry. */
  onError?: (error: Error) => void;
  /** Called when the user accepts generated content. Useful for analytics. */
  onAccept?: (content: string) => void;
  /** Called when the user discards generated content. */
  onDiscard?: () => void;
  /**
   * Custom prompt input component. When provided, replaces the built-in prompt input.
   * Receives position, onSubmit, and onClose as props.
   */
  renderPrompt?: (props: AIPromptInputRenderProps) => React.ReactElement;
}

// --- Input Rule Engine (Section 11.2) ---

export interface InputRule {
  /** The trigger pattern. Must include a trailing space or newline to fire. */
  pattern: RegExp;
  /** The node type this rule produces. */
  type: 'heading' | 'quote' | 'code' | 'divider' | 'custom';
  /**
   * Called when the pattern matches. Receives the matched text and the
   * current TextNode. Must perform its mutation inside an editor.update() call.
   * The engine handles deleting the trigger text before calling this.
   */
  onMatch: (match: RegExpMatchArray, node: TextNode, editor: LexicalEditor) => void;
}

// --- Mention System (Section 12) ---

export interface MentionItem {
  id: string;
  label: string;
  /** Optional: rendered inside the dropdown item */
  meta?: string;
  /** Optional: URL to an avatar or icon */
  icon?: string;
}

export interface MentionProvider {
  /** The character that triggers this provider (e.g., '@', '#') */
  trigger: string;
  /**
   * Called when the user types after the trigger. Return a promise that
   * resolves to matching items. Return an empty array for no results.
   */
  onSearch: (query: string) => Promise<MentionItem[]>;
  /**
   * Renders a single item in the Radix dropdown.
   * Keep it lightweight — this renders on every keystroke.
   */
  renderItem: (item: MentionItem) => React.ReactNode;
  /**
   * Called when the user selects an item. Return the Lexical node to insert.
   * The engine handles replacing the trigger + query text with this node.
   */
  onSelect: (item: MentionItem) => LexicalNode;
}

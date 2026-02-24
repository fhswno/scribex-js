import type { LexicalEditor } from "lexical";
import type { AIProvider, AIPluginConfig } from "../types";

/** Internal entry stored for each editor instance. */
interface AIRegistryEntry {
  provider: AIProvider;
  config: AIPluginConfig;
}

/**
 * WeakMap-based registry that maps each Lexical editor instance to its AIProvider + config.
 * Using WeakMap ensures:
 * 1. Multi-editor isolation — each editor has its own provider
 * 2. No memory leaks — when the editor is garbage collected, the entry is removed
 * 3. No module-level mutable singletons — the WeakMap is keyed by instance
 */
const registry = new WeakMap<LexicalEditor, AIRegistryEntry>();

export function registerAIProvider(
  editor: LexicalEditor,
  provider: AIProvider,
  config: AIPluginConfig = {},
): void {
  registry.set(editor, { provider, config });
}

export function getAIProvider(
  editor: LexicalEditor,
): AIProvider | null {
  return registry.get(editor)?.provider ?? null;
}

export function getAIConfig(
  editor: LexicalEditor,
): AIPluginConfig {
  return registry.get(editor)?.config ?? {};
}

export function unregisterAIProvider(editor: LexicalEditor): void {
  registry.delete(editor);
}

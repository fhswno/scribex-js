import type { LexicalEditor, LexicalNode, TextNode } from 'lexical';

// --- Asset Pipeline (Section 9) ---

export type UploadHandler = (file: File) => Promise<string>;

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

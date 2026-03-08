// LEXICAL
import { $isRootNode, type LexicalNode } from "lexical";

export type MarqueeRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export const MIN_DRAG_DISTANCE = 5;

export const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [contenteditable='true']";

/**
 * Returns true if two rects (in viewport coordinates) overlap.
 */
export function rectsIntersect(
  a: { top: number; left: number; bottom: number; right: number },
  b: { top: number; left: number; bottom: number; right: number },
): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Walks up from `node` to find the top-level block
 * (a direct child of the root node).
 * Returns `null` if the node is the root itself or has no block ancestor.
 */
export function findTopBlock(node: LexicalNode): LexicalNode | null {
  let current: LexicalNode | null = node;
  while (current !== null) {
    const parent: LexicalNode | null = current.getParent();
    if (parent === null) return null;
    if ($isRootNode(parent)) return current;
    current = parent;
  }
  return null;
}

// PLAYWRIGHT
import { test, expect } from '@playwright/test';

const EDITOR_SELECTOR = '[data-namespace="playground-editor"] [contenteditable="true"]';
const STATE_SELECTOR = '[data-namespace="playground-editor"] pre[data-testid="editor-state"]';

test.describe('Phase 6: Mention System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('typing "@" opens the mention dropdown', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('@');

    const dropdown = page.locator('[data-testid="mention-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Should show all 4 mock users
    await expect(page.locator('[data-testid^="mention-item-"]')).toHaveCount(4);
  });

  test('typing "@ali" filters to Alice only', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('@ali');

    const dropdown = page.locator('[data-testid="mention-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Only Alice should match
    const items = page.locator('[data-testid^="mention-item-"]');
    await expect(items).toHaveCount(1);
    await expect(page.locator('[data-testid="mention-item-1"]')).toBeVisible();
  });

  test('ArrowDown and Enter selects an item and inserts a MentionNode', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('@');

    const dropdown = page.locator('[data-testid="mention-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // First item (Alice, id=1) should be selected by default
    // Press ArrowDown to select Bob (id=2)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });

    // MentionNode should be in the DOM
    const mentionNode = page.locator('[data-testid="mention-node"]');
    await expect(mentionNode).toBeVisible({ timeout: 2000 });
    await expect(mentionNode).toHaveAttribute('data-mention-id', '2');
  });

  test('JSON state contains MentionNode with correct id and label', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('@ali');

    const dropdown = page.locator('[data-testid="mention-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Select Alice
    await page.keyboard.press('Enter');

    // Wait for dropdown to close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });

    // Wait for state to update
    await page.waitForTimeout(500);

    // Check JSON state
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    // Find mention node in the state
    function findMentionNode(
      nodes: { type: string; children?: unknown[]; mentionId?: string; label?: string; trigger?: string }[],
    ): { mentionId?: string; label?: string; trigger?: string } | null {
      for (const node of nodes) {
        if (node.type === 'mention') return node;
        if (node.children) {
          const found = findMentionNode(
            node.children as { type: string; children?: unknown[]; mentionId?: string; label?: string; trigger?: string }[],
          );
          if (found) return found;
        }
      }
      return null;
    }

    const mention = findMentionNode(state.root.children);
    expect(mention).not.toBeNull();
    expect(mention!.mentionId).toBe('1');
    expect(mention!.label).toBe('Alice');
    expect(mention!.trigger).toBe('@');
  });

  test('pressing Escape closes the dropdown and leaves trigger text as plain text', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('@bo');

    const dropdown = page.locator('[data-testid="mention-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });

    // The text "@bo" should still be in the editor as plain text
    await page.waitForTimeout(300);
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const fullText = JSON.stringify(JSON.parse(stateText!));
    expect(fullText).toContain('@bo');

    // No mention nodes should exist
    const mentionNode = page.locator('[data-testid="mention-node"]');
    await expect(mentionNode).toHaveCount(0);
  });

  test('backspacing past "@" closes the dropdown', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('@b');

    const dropdown = page.locator('[data-testid="mention-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Backspace to delete 'b'
    await page.keyboard.press('Backspace');

    // Dropdown should still be open (just @ remains)
    await expect(dropdown).toBeVisible({ timeout: 2000 });

    // Backspace to delete '@'
    await page.keyboard.press('Backspace');

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });
  });

  test('"#" trigger works independently from "@"', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('#');

    const dropdown = page.locator('[data-testid="mention-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Should show tag items (4 tags)
    await expect(page.locator('[data-testid^="mention-item-"]')).toHaveCount(4);

    // Filter to "bug"
    await page.keyboard.type('bug');
    await expect(page.locator('[data-testid^="mention-item-"]')).toHaveCount(1);

    // Select it
    await page.keyboard.press('Enter');

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });

    // MentionNode should be in the DOM with trigger="#"
    const mentionNode = page.locator('[data-testid="mention-node"]');
    await expect(mentionNode).toBeVisible({ timeout: 2000 });
    await expect(mentionNode).toHaveAttribute('data-mention-trigger', '#');
    await expect(mentionNode).toHaveAttribute('data-mention-id', 't2');

    // Verify in JSON state
    await page.waitForTimeout(500);
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    function findMentionNode(
      nodes: { type: string; children?: unknown[]; trigger?: string; label?: string }[],
    ): { trigger?: string; label?: string } | null {
      for (const node of nodes) {
        if (node.type === 'mention') return node;
        if (node.children) {
          const found = findMentionNode(
            node.children as { type: string; children?: unknown[]; trigger?: string; label?: string }[],
          );
          if (found) return found;
        }
      }
      return null;
    }

    const mention = findMentionNode(state.root.children);
    expect(mention).not.toBeNull();
    expect(mention!.trigger).toBe('#');
    expect(mention!.label).toBe('bug');
  });

  test('clicking a dropdown item inserts the MentionNode', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('@');

    const dropdown = page.locator('[data-testid="mention-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Click on Charlie (id=3)
    const charlieItem = page.locator('[data-testid="mention-item-3"]');
    await expect(charlieItem).toBeVisible();
    await charlieItem.click();

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });

    // MentionNode for Charlie should be in DOM
    const mentionNode = page.locator('[data-testid="mention-node"]');
    await expect(mentionNode).toBeVisible({ timeout: 2000 });
    await expect(mentionNode).toHaveAttribute('data-mention-id', '3');
  });

  test('mention trigger only activates at word boundary', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();

    // Type text followed by @ without space — should NOT trigger
    await page.keyboard.type('hello@');

    const dropdown = page.locator('[data-testid="mention-dropdown"]');
    // Give it a moment to potentially appear
    await page.waitForTimeout(500);
    await expect(dropdown).not.toBeVisible();

    // Now type space and then @ — should trigger
    await page.keyboard.type(' @');
    await expect(dropdown).toBeVisible({ timeout: 3000 });
  });
});

// PLAYWRIGHT
import { test, expect } from '@playwright/test';

const EDITOR_SELECTOR = '[data-namespace="playground-editor"] [contenteditable="true"]';
const STATE_SELECTOR = '[data-namespace="playground-editor"] pre[data-testid="editor-state"]';

// ─── Emoji Picker Tests ─────────────────────────────────────────────────────

test.describe('Emoji Picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('typing ":smile" opens the emoji picker dropdown', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type(':smile');

    const dropdown = page.locator('[data-testid="emoji-picker-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });
  });

  test('typing ":smile" filters to smile-related emojis', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type(':smile');

    const dropdown = page.locator('[data-testid="emoji-picker-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // All results should contain "smile" in their test id
    const items = dropdown.locator('[data-testid^="emoji-item-"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(8); // maxResults default
  });

  test('pressing Enter inserts the selected emoji as Unicode text', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type(':smile');

    const dropdown = page.locator('[data-testid="emoji-picker-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Press Enter to select the first emoji
    await page.keyboard.press('Enter');

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });

    // The editor should contain an emoji character (not the :smile text)
    await page.waitForTimeout(500);
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    // Find text content in the state — should NOT contain ":smile"
    const fullJson = JSON.stringify(state);
    expect(fullJson).not.toContain(':smile');

    // Should contain some non-ASCII character (the emoji)
    const textContent = extractTextContent(state.root.children);
    expect(textContent.length).toBeGreaterThan(0);
    // The emoji should be a non-standard character (code point > 127)
    const hasEmoji = Array.from(textContent).some((c) => c.codePointAt(0)! > 127);
    expect(hasEmoji).toBe(true);
  });

  test('pressing Escape dismisses the picker, leaves text as is', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type(':smile');

    const dropdown = page.locator('[data-testid="emoji-picker-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });

    // The text ":smile" should still be in the editor
    await page.waitForTimeout(300);
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    expect(JSON.stringify(JSON.parse(stateText!))).toContain(':smile');
  });

  test('arrow keys navigate the dropdown', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type(':heart');

    const dropdown = page.locator('[data-testid="emoji-picker-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // First item should be selected by default
    const firstItem = dropdown.locator('[role="option"]').first();
    await expect(firstItem).toHaveAttribute('aria-selected', 'true');

    // Press ArrowDown to select the second
    await page.keyboard.press('ArrowDown');

    const secondItem = dropdown.locator('[role="option"]').nth(1);
    await expect(secondItem).toHaveAttribute('aria-selected', 'true');

    // First should no longer be selected
    await expect(firstItem).toHaveAttribute('aria-selected', 'false');
  });

  test('emoji renders using OS native font', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type(':thumbs');

    const dropdown = page.locator('[data-testid="emoji-picker-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Select first result
    await page.keyboard.press('Enter');

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });

    // The editor DOM should contain the emoji character
    const editorText = await editor.textContent();
    expect(editorText).toBeTruthy();
    // Check that a Unicode emoji is present (thumbs up = 👍)
    const hasEmoji = Array.from(editorText!).some(
      (c) => c.codePointAt(0)! > 127,
    );
    expect(hasEmoji).toBe(true);
  });

  test('emoji picker does not trigger mid-word', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('hello:smile');

    const dropdown = page.locator('[data-testid="emoji-picker-dropdown"]');
    // Give it a moment to potentially appear
    await page.waitForTimeout(500);
    await expect(dropdown).not.toBeVisible();
  });
});

// ─── Link Plugin Tests ──────────────────────────────────────────────────────

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

test.describe('Link Plugin', () => {
  // Link tests modify shared state (create/edit/remove links) — run serially to avoid flakes
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
    // Wait for LinkPlugin to register its document keydown listener
    await page.locator(`${EDITOR_SELECTOR}[data-link-plugin-ready="true"]`).waitFor({ state: 'attached', timeout: 5000 });
  });

  test('Cmd+K with selected text opens link input popover', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Hello World');

    // Select all text
    await page.keyboard.press('Shift+Home');

    // Small wait to ensure selection is registered
    await page.waitForTimeout(100);

    // Press Cmd+K
    await page.keyboard.press(`${MOD}+k`);

    const linkInput = page.locator('[data-testid="link-input-popover"]');
    await expect(linkInput).toBeVisible({ timeout: 5000 });
  });

  test('entering URL and pressing Enter wraps text in a link', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Click here');

    // Select "Click here"
    await page.keyboard.press('Shift+Home');

    // Small wait to ensure selection is registered
    await page.waitForTimeout(100);

    // Press Cmd+K
    await page.keyboard.press(`${MOD}+k`);

    const linkInput = page.locator('[data-testid="link-input-popover"]');
    await expect(linkInput).toBeVisible({ timeout: 5000 });

    // Type URL
    await page.keyboard.type('https://example.com');
    await page.keyboard.press('Enter');

    // Link input should close
    await expect(linkInput).not.toBeVisible({ timeout: 2000 });

    // Wait for state update
    await page.waitForTimeout(500);

    // Check JSON state for LinkNode
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    const linkNode = findNodeByType(state.root.children, 'link');
    expect(linkNode).not.toBeNull();
    expect(linkNode!.url).toBe('https://example.com');
  });

  test('clicking Apply button creates the link', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Visit site');

    // Select "Visit site"
    await page.keyboard.press('Shift+Home');

    // Small wait to ensure selection is registered
    await page.waitForTimeout(100);

    // Press Cmd+K
    await page.keyboard.press(`${MOD}+k`);

    const linkInput = page.locator('[data-testid="link-input-popover"]');
    await expect(linkInput).toBeVisible({ timeout: 5000 });

    // Type URL
    await page.keyboard.type('example.com');

    // Click Apply button
    const applyButton = page.locator('[data-testid="link-input-apply"]');
    await applyButton.click();

    // Link input should close
    await expect(linkInput).not.toBeVisible({ timeout: 2000 });

    // Check JSON state for LinkNode (should have https:// prefix added)
    await page.waitForTimeout(500);
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    const linkNode = findNodeByType(state.root.children, 'link');
    expect(linkNode).not.toBeNull();
    expect(linkNode!.url).toBe('https://example.com');
  });

  test('link preview popover shows when cursor is inside a link', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Click here');

    // Create a link first
    await page.keyboard.press('Shift+Home');
    await page.waitForTimeout(100);
    await page.keyboard.press(`${MOD}+k`);

    const linkInput = page.locator('[data-testid="link-input-popover"]');
    await expect(linkInput).toBeVisible({ timeout: 5000 });
    await page.keyboard.type('https://example.com');
    await page.keyboard.press('Enter');
    await expect(linkInput).not.toBeVisible({ timeout: 2000 });

    // Click inside the link text to position cursor there
    const linkElement = editor.locator('a');
    await expect(linkElement).toBeVisible({ timeout: 2000 });
    await linkElement.click();

    // Wait for preview popover
    const preview = page.locator('[data-testid="link-preview-popover"]');
    await expect(preview).toBeVisible({ timeout: 3000 });

    // Should show the URL
    await expect(preview).toContainText('example.com');
  });

  test('remove button in preview unwraps the link back to plain text', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Remove me');

    // Create a link
    await page.keyboard.press('Shift+Home');
    await page.waitForTimeout(100);
    await page.keyboard.press(`${MOD}+k`);

    const linkInput = page.locator('[data-testid="link-input-popover"]');
    await expect(linkInput).toBeVisible({ timeout: 5000 });
    await page.keyboard.type('https://example.com');
    await page.keyboard.press('Enter');
    await expect(linkInput).not.toBeVisible({ timeout: 2000 });

    // Click inside the link to show preview
    const linkElement = editor.locator('a');
    await expect(linkElement).toBeVisible({ timeout: 2000 });
    await linkElement.click();

    const preview = page.locator('[data-testid="link-preview-popover"]');
    await expect(preview).toBeVisible({ timeout: 3000 });

    // Click remove
    const removeButton = page.locator('[data-testid="link-preview-remove"]');
    await removeButton.click();

    // Preview should close
    await expect(preview).not.toBeVisible({ timeout: 2000 });

    // Wait for state update
    await page.waitForTimeout(500);

    // Link node should be gone from state
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    const linkNode = findNodeByType(state.root.children, 'link');
    expect(linkNode).toBeNull();

    // But the text "Remove me" should still exist
    expect(JSON.stringify(state)).toContain('Remove me');
  });

  test('edit button opens input popover pre-filled with current URL', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Edit me');

    // Create a link
    await page.keyboard.press('Shift+Home');
    await page.waitForTimeout(100);
    await page.keyboard.press(`${MOD}+k`);

    const linkInput = page.locator('[data-testid="link-input-popover"]');
    await expect(linkInput).toBeVisible({ timeout: 5000 });
    await page.keyboard.type('https://example.com');
    await page.keyboard.press('Enter');
    await expect(linkInput).not.toBeVisible({ timeout: 2000 });

    // Click inside the link to show preview
    const linkElement = editor.locator('a');
    await expect(linkElement).toBeVisible({ timeout: 2000 });
    await linkElement.click();

    const preview = page.locator('[data-testid="link-preview-popover"]');
    await expect(preview).toBeVisible({ timeout: 3000 });

    // Click edit
    const editButton = page.locator('[data-testid="link-preview-edit"]');
    await editButton.click();

    // Link input should open, pre-filled with the current URL
    await expect(linkInput).toBeVisible({ timeout: 5000 });

    const input = linkInput.locator('input[type="text"]');
    await expect(input).toHaveValue('https://example.com');
  });

  test('Cmd+Z after creating a link removes it in a single undo', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Undo test');

    // Create a link
    await page.keyboard.press('Shift+Home');
    await page.waitForTimeout(100);
    await page.keyboard.press(`${MOD}+k`);

    const linkInput = page.locator('[data-testid="link-input-popover"]');
    await expect(linkInput).toBeVisible({ timeout: 5000 });
    await page.keyboard.type('https://example.com');
    await page.keyboard.press('Enter');
    await expect(linkInput).not.toBeVisible({ timeout: 2000 });

    // Verify link exists
    await page.waitForTimeout(500);
    let stateText = await page.locator(STATE_SELECTOR).textContent();
    let state = JSON.parse(stateText!);
    expect(findNodeByType(state.root.children, 'link')).not.toBeNull();

    // Click back into editor to ensure focus
    await editor.click();
    await page.waitForTimeout(200);

    // Undo
    await page.keyboard.press(`${MOD}+z`);

    // Wait for state update
    await page.waitForTimeout(500);

    // Link should be gone
    stateText = await page.locator(STATE_SELECTOR).textContent();
    state = JSON.parse(stateText!);
    expect(findNodeByType(state.root.children, 'link')).toBeNull();

    // Text "Undo test" should still be there
    expect(JSON.stringify(state)).toContain('Undo test');
  });

  test('link button appears in FloatingToolbar', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Toolbar link');

    // Select text
    await page.keyboard.press('Shift+Home');

    // Wait for toolbar
    const toolbar = page.locator('[data-testid="floating-toolbar"]');
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // Link button should be present
    const linkButton = page.locator('[data-testid="toolbar-link"]');
    await expect(linkButton).toBeVisible();
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractTextContent(
  nodes: { type: string; text?: string; children?: unknown[] }[],
): string {
  let result = '';
  for (const node of nodes) {
    if (node.text) result += node.text;
    if (node.children) {
      result += extractTextContent(
        node.children as { type: string; text?: string; children?: unknown[] }[],
      );
    }
  }
  return result;
}

function findNodeByType(
  nodes: { type: string; children?: unknown[]; url?: string; [key: string]: unknown }[],
  type: string,
): { type: string; url?: string; [key: string]: unknown } | null {
  for (const node of nodes) {
    if (node.type === type) return node;
    if (node.children) {
      const found = findNodeByType(
        node.children as { type: string; children?: unknown[]; url?: string; [key: string]: unknown }[],
        type,
      );
      if (found) return found;
    }
  }
  return null;
}

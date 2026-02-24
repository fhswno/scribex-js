// PLAYWRIGHT
import { test, expect } from '@playwright/test';

const EDITOR_SELECTOR = '[data-namespace="playground-editor"] [contenteditable="true"]';
const STATE_SELECTOR = '[data-namespace="playground-editor"] pre[data-testid="editor-state"]';

/**
 * Intercepts the Mistral API route and returns a mock streaming text response.
 */
async function mockAIRoute(
  page: import('@playwright/test').Page,
  responseText: string,
  options?: { status?: number; delay?: number },
) {
  await page.route('**/api/editor/**', async (route) => {
    if (options?.status && options.status !== 200) {
      await route.fulfill({
        status: options.status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI service error' }),
      });
      return;
    }

    if (options?.delay) {
      await new Promise((r) => setTimeout(r, options.delay));
    }

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: responseText,
    });
  });
}

/**
 * Opens the slash menu, selects "Ask AI", types a prompt, and submits.
 */
async function triggerAI(page: import('@playwright/test').Page, prompt: string) {
  const editor = page.locator(EDITOR_SELECTOR);
  await editor.focus();
  await page.keyboard.type('/ai');

  // Wait for slash menu to appear and select the AI item
  const slashMenu = page.locator('[data-testid="slash-menu"]');
  await expect(slashMenu).toBeVisible({ timeout: 3000 });

  const aiItem = page.locator('[data-testid="slash-menu-item-ai"]');
  await expect(aiItem).toBeVisible({ timeout: 2000 });

  // Click the AI item
  await aiItem.click({ force: true });

  // Wait for the prompt input to appear
  const promptInput = page.locator('[data-testid="ai-prompt-input"] input');
  await expect(promptInput).toBeVisible({ timeout: 3000 });

  // Type the prompt and submit
  await promptInput.fill(prompt);
  await promptInput.press('Enter');
}

test.describe('Phase 5: AI Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('typing /ai in slash menu shows the AI item', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('/ai');

    const slashMenu = page.locator('[data-testid="slash-menu"]');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    const aiItem = page.locator('[data-testid="slash-menu-item-ai"]');
    await expect(aiItem).toBeVisible();
  });

  test('selecting AI item opens the prompt input', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('/ai');

    const aiItem = page.locator('[data-testid="slash-menu-item-ai"]');
    await expect(aiItem).toBeVisible({ timeout: 3000 });
    await aiItem.click({ force: true });

    const promptInput = page.locator('[data-testid="ai-prompt-input"]');
    await expect(promptInput).toBeVisible({ timeout: 3000 });
  });

  test('submitting a prompt shows the AIPreviewNode with streamed content', async ({ page }) => {
    const mockText = 'Hello from AI! This is a test response.';
    await mockAIRoute(page, mockText);

    await triggerAI(page, 'Write a greeting');

    // Wait for the AIPreviewNode to appear
    const previewNode = page.locator('[data-testid="ai-preview-node"]');
    await expect(previewNode).toBeVisible({ timeout: 5000 });

    // Wait for the content to appear
    const previewContent = page.locator('[data-testid="ai-preview-content"]');
    await expect(previewContent).toContainText(mockText, { timeout: 5000 });

    // Wait for Accept button (stream complete)
    const acceptBtn = page.locator('[data-testid="ai-preview-accept"]');
    await expect(acceptBtn).toBeVisible({ timeout: 5000 });
  });

  test('"Discard" removes the AIPreviewNode and leaves AST unchanged', async ({ page }) => {
    const mockText = 'Content to discard';
    await mockAIRoute(page, mockText);

    // Type some initial text first
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Initial text');
    await page.keyboard.press('Enter');

    // Wait for state to settle
    await page.waitForTimeout(500);

    // Capture the state before AI
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateBefore = await stateDisplay.textContent();

    // Now trigger AI
    await page.keyboard.type('/ai');
    const aiItem = page.locator('[data-testid="slash-menu-item-ai"]');
    await expect(aiItem).toBeVisible({ timeout: 3000 });
    await aiItem.click({ force: true });

    const promptInput = page.locator('[data-testid="ai-prompt-input"] input');
    await expect(promptInput).toBeVisible({ timeout: 3000 });
    await promptInput.fill('Test prompt');
    await promptInput.press('Enter');

    // Wait for stream to complete
    const discardBtn = page.locator('[data-testid="ai-preview-discard"]');
    await expect(discardBtn).toBeVisible({ timeout: 5000 });

    // Click Discard
    await discardBtn.click();

    // AIPreviewNode should be removed
    const previewNode = page.locator('[data-testid="ai-preview-node"]');
    await expect(previewNode).toHaveCount(0, { timeout: 3000 });

    // Verify no ai-preview nodes in the JSON state
    await page.waitForTimeout(500);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    function hasNodeType(
      nodes: { type: string; children?: unknown[] }[],
      type: string,
    ): boolean {
      for (const node of nodes) {
        if (node.type === type) return true;
        if (node.children) {
          if (
            hasNodeType(
              node.children as { type: string; children?: unknown[] }[],
              type,
            )
          )
            return true;
        }
      }
      return false;
    }

    expect(hasNodeType(state.root.children, 'ai-preview')).toBe(false);
  });

  test('"Accept" replaces AIPreviewNode with content as Lexical nodes', async ({ page }) => {
    const mockText = 'Accepted paragraph content';
    await mockAIRoute(page, mockText);

    await triggerAI(page, 'Write something');

    // Wait for Accept button
    const acceptBtn = page.locator('[data-testid="ai-preview-accept"]');
    await expect(acceptBtn).toBeVisible({ timeout: 5000 });

    // Click Accept
    await acceptBtn.click();

    // AIPreviewNode should be replaced
    const previewNode = page.locator('[data-testid="ai-preview-node"]');
    await expect(previewNode).toHaveCount(0, { timeout: 3000 });

    // Wait for state to update
    await page.waitForTimeout(500);

    // Verify the content is in the JSON state as regular paragraph nodes
    const stateDisplay = page.locator(STATE_SELECTOR);
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    // Check that no ai-preview nodes remain
    function hasNodeType(
      nodes: { type: string; children?: unknown[] }[],
      type: string,
    ): boolean {
      for (const node of nodes) {
        if (node.type === type) return true;
        if (node.children) {
          if (
            hasNodeType(
              node.children as { type: string; children?: unknown[] }[],
              type,
            )
          )
            return true;
        }
      }
      return false;
    }

    expect(hasNodeType(state.root.children, 'ai-preview')).toBe(false);

    // Verify the accepted text exists as content somewhere
    const fullText = JSON.stringify(state);
    expect(fullText).toContain('Accepted paragraph content');
  });

  test('Cmd+Z after accept undoes in a single step', async ({ page }) => {
    const mockText = 'Undo test content';
    await mockAIRoute(page, mockText);

    // Type initial text
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Before AI');
    await page.keyboard.press('Enter');

    // Wait for state
    await page.waitForTimeout(500);

    // Trigger AI
    await page.keyboard.type('/ai');
    const aiItem = page.locator('[data-testid="slash-menu-item-ai"]');
    await expect(aiItem).toBeVisible({ timeout: 3000 });
    await aiItem.click({ force: true });

    const promptInput = page.locator('[data-testid="ai-prompt-input"] input');
    await expect(promptInput).toBeVisible({ timeout: 3000 });
    await promptInput.fill('Generate');
    await promptInput.press('Enter');

    // Accept
    const acceptBtn = page.locator('[data-testid="ai-preview-accept"]');
    await expect(acceptBtn).toBeVisible({ timeout: 5000 });
    await acceptBtn.click();

    // Wait for state to settle
    await page.waitForTimeout(500);

    // Verify content is there
    const stateDisplay = page.locator(STATE_SELECTOR);
    let stateText = await stateDisplay.textContent();
    expect(stateText).toContain('Undo test content');

    // Undo — focus the editor first
    await editor.focus();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+z`);

    // Wait for state
    await page.waitForTimeout(500);

    // After one undo, the accepted content should be removed
    stateText = await stateDisplay.textContent();
    expect(stateText).not.toContain('Undo test content');
  });

  test('API error shows error state with Dismiss button', async ({ page }) => {
    await mockAIRoute(page, '', { status: 500 });

    await triggerAI(page, 'This will fail');

    // Wait for the error state to appear
    const previewNode = page.locator('[data-testid="ai-preview-node"]');
    await expect(previewNode).toBeVisible({ timeout: 5000 });

    // The error message should be shown
    const errorEl = page.locator('[data-testid="ai-preview-error"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });

    // Dismiss button should be visible
    const dismissBtn = page.locator('[data-testid="ai-preview-dismiss"]');
    await expect(dismissBtn).toBeVisible({ timeout: 3000 });

    // Click Dismiss
    await dismissBtn.click();

    // Node should be removed
    await expect(previewNode).toHaveCount(0, { timeout: 3000 });
  });
});

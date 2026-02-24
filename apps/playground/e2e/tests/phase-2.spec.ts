import { test, expect } from '@playwright/test';

const EDITOR_SELECTOR = '[data-namespace="playground-editor"] [contenteditable="true"]';
const STATE_SELECTOR = '[data-namespace="playground-editor"] pre[data-testid="editor-state"]';
const MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control';

test.describe('Phase 2: Floating Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('selecting text shows the floating toolbar', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Hello World');

    // Select all text with keyboard
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');

    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="floating-toolbar"]')).toBeVisible();
  });

  test('clicking Bold in toolbar wraps selected text in bold format', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('Bold text');

    // Select "Bold text"
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.waitForTimeout(200);

    // Verify toolbar is shown
    await expect(page.locator('[data-testid="floating-toolbar"]')).toBeVisible();

    // Use the toolbar button via mousedown (the handler uses onMouseDown)
    await page.locator('[data-testid="toolbar-bold"]').dispatchEvent('mousedown');

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);
    const firstChild = state.root.children[0];
    // Bold format = 1 in Lexical's bitmask
    expect(firstChild.children[0].format & 1).toBe(1);
  });

  test('Cmd+Z removes the bold format', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('Undo bold');

    // Select text and bold it via keyboard shortcut
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.waitForTimeout(100);
    await page.keyboard.press(`${MODIFIER}+b`);
    await page.waitForTimeout(500);

    // Verify bold was applied
    let stateText = await stateDisplay.textContent();
    let state = JSON.parse(stateText!);
    expect(state.root.children[0].children[0].format & 1).toBe(1);

    // Undo
    await page.keyboard.press(`${MODIFIER}+z`);
    await page.waitForTimeout(500);

    stateText = await stateDisplay.textContent();
    state = JSON.parse(stateText!);
    // After undo, format should be 0 (no bold)
    expect(state.root.children[0].children[0].format & 1).toBe(0);
  });

  test('floating toolbar closes when selection is collapsed', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Some text');

    // Select text to show toolbar
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="floating-toolbar"]')).toBeVisible();

    // Collapse selection by pressing End
    await page.keyboard.press('End');
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="floating-toolbar"]')).not.toBeVisible();
  });
});

test.describe('Phase 2: Input Rule Engine', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('typing "# " converts to Heading 1', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('# ');

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);
    expect(state.root.children[0].type).toBe('heading');
    expect(state.root.children[0].tag).toBe('h1');
  });

  test('typing "## " converts to Heading 2', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('## ');

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);
    expect(state.root.children[0].type).toBe('heading');
    expect(state.root.children[0].tag).toBe('h2');
  });

  test('typing "> " converts to Blockquote', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('> ');

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);
    expect(state.root.children[0].type).toBe('quote');
  });
});

test.describe('Phase 2: Slash Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('typing "/" opens the slash menu', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('/');

    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="slash-menu"]')).toBeVisible();
  });

  test('typing "/head" filters to heading items', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('/head');

    await page.waitForTimeout(300);
    const menu = page.locator('[data-testid="slash-menu"]');
    await expect(menu).toBeVisible();

    // Should show heading items
    await expect(page.locator('[data-testid="slash-menu-item-heading-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="slash-menu-item-heading-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="slash-menu-item-heading-3"]')).toBeVisible();

    // Should NOT show non-heading items
    await expect(page.locator('[data-testid="slash-menu-item-quote"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="slash-menu-item-bullet-list"]')).not.toBeVisible();
  });

  test('selecting "Heading 1" from slash menu converts the block', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('/');

    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="slash-menu"]')).toBeVisible();

    // Click on the Heading 1 item directly
    const h1Item = page.locator('[data-testid="slash-menu-item-heading-1"]');
    await expect(h1Item).toBeVisible({ timeout: 2000 });
    await h1Item.click({ force: true });

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    // Find a heading node in the children
    const hasHeading = state.root.children.some(
      (child: { type: string; tag?: string }) => child.type === 'heading' && child.tag === 'h1',
    );
    expect(hasHeading).toBe(true);
  });
});

import { test, expect } from '@playwright/test';

const EDITOR_SELECTOR = '[data-namespace="playground-editor"] [contenteditable="true"]';
const STATE_SELECTOR = '[data-namespace="playground-editor"] pre[data-testid="editor-state"]';

test.describe('Phase 7: Code Blocks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('typing "```" converts to a CodeBlockNode', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('```');

    await page.waitForTimeout(600);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    // Find a code-block node in the children
    const hasCodeBlock = state.root.children.some(
      (child: { type: string }) => child.type === 'code-block',
    );
    expect(hasCodeBlock).toBe(true);
  });

  test('typing inside the code block updates the code property', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('```');

    await page.waitForTimeout(600);

    // The code block should now be visible
    const textarea = page.locator('[data-testid="code-block-textarea"]').first();
    await expect(textarea).toBeVisible();

    // Click on the textarea and type code using keyboard
    await textarea.click();
    await page.keyboard.type('hello world');

    // Wait for debounced update (300ms) + state update
    await page.waitForTimeout(800);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    const codeBlock = state.root.children.find(
      (child: { type: string }) => child.type === 'code-block',
    );
    expect(codeBlock).toBeTruthy();
    expect(codeBlock.code).toBe('hello world');
  });

  test('changing the language selector updates the language property', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('```');

    await page.waitForTimeout(600);

    // Default language should be javascript
    const stateText1 = await stateDisplay.textContent();
    const state1 = JSON.parse(stateText1!);
    const codeBlock1 = state1.root.children.find(
      (child: { type: string }) => child.type === 'code-block',
    );
    expect(codeBlock1.language).toBe('javascript');

    // Change language to python
    const languageSelect = page.locator('[data-testid="code-block-language"]').first();
    await languageSelect.selectOption('python');

    await page.waitForTimeout(600);

    const stateText2 = await stateDisplay.textContent();
    const state2 = JSON.parse(stateText2!);
    const codeBlock2 = state2.root.children.find(
      (child: { type: string }) => child.type === 'code-block',
    );
    expect(codeBlock2.language).toBe('python');
  });

  test('copy button writes code content to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const editor = page.locator(EDITOR_SELECTOR);

    await editor.focus();
    await page.keyboard.type('```');

    await page.waitForTimeout(600);

    // Type some code
    const textarea = page.locator('[data-testid="code-block-textarea"]').first();
    await expect(textarea).toBeVisible();
    await textarea.click();
    await page.keyboard.type('const x = 42;');

    await page.waitForTimeout(300);

    // Click copy button
    const copyButton = page.locator('[data-testid="code-block-copy"]').first();
    await copyButton.click();

    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe('const x = 42;');
  });

  test('Shiki highlighting endpoint returns HTML for a given snippet', async ({ page }) => {
    // Intercept highlight requests and return mock Shiki HTML
    let highlightCalled = false;
    await page.route('**/api/editor/highlight', async (route) => {
      const request = route.request();
      const postData = request.postData();
      const body = postData ? JSON.parse(postData) : {};
      highlightCalled = true;
      const mockHtml = `<pre class="shiki github-light"><code><span class="line">${body.code ?? ''}</span></code></pre>`;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ html: mockHtml }),
      });
    });

    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('```');

    await page.waitForTimeout(600);

    // Type code to trigger highlighting
    const textarea = page.locator('[data-testid="code-block-textarea"]').first();
    await expect(textarea).toBeVisible();
    await textarea.click();
    await page.keyboard.type('const y = 1;');

    // Wait for debounced highlight request (500ms debounce + network)
    await page.waitForTimeout(1200);

    // Verify the highlight API was called
    expect(highlightCalled).toBe(true);

    // Blur the textarea by clicking below the code block, outside the editor
    // This triggers isEditing=false which shows the highlighted output
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);

    // The highlighted content should be rendered
    const highlighted = page.locator('[data-testid="code-block-highlighted"]').first();
    await expect(highlighted).toBeVisible({ timeout: 3000 });
    const highlightHtml = await highlighted.innerHTML();
    expect(highlightHtml).toContain('const y = 1;');
  });

  test('selecting "Code Block" from slash menu creates a code block', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('/');

    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="slash-menu"]')).toBeVisible();

    // Click the code block item
    const codeItem = page.locator('[data-testid="slash-menu-item-code"]');
    await expect(codeItem).toBeVisible({ timeout: 2000 });
    await codeItem.click({ force: true });

    await page.waitForTimeout(600);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    const hasCodeBlock = state.root.children.some(
      (child: { type: string }) => child.type === 'code-block',
    );
    expect(hasCodeBlock).toBe(true);
  });
});

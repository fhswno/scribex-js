import { test, expect } from '@playwright/test';

const EDITOR_SELECTOR = '[data-namespace="playground-editor"] [contenteditable="true"]';
const STATE_SELECTOR = '[data-namespace="playground-editor"] pre[data-testid="editor-state"]';
const HANDLE_SELECTOR = '[data-testid="overlay-drag-handle"][data-namespace="playground-editor"]';

test.describe('Phase 3: Overlay Portal — Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('hovering over a paragraph shows the drag handle', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Hover me');

    // Move mouse over the paragraph
    const paragraph = editor.locator('p').first();
    await paragraph.hover();
    await page.waitForTimeout(200);

    await expect(page.locator(HANDLE_SELECTOR)).toBeVisible();
  });

  test('drag handle disappears when mouse leaves the editor', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('Some text');

    // Hover over paragraph to show handle
    const paragraph = editor.locator('p').first();
    await paragraph.hover();
    await page.waitForTimeout(200);
    await expect(page.locator(HANDLE_SELECTOR)).toBeVisible();

    // Move mouse outside editor
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    await expect(page.locator(HANDLE_SELECTOR)).not.toBeVisible();
  });

  test('dragging paragraph B above paragraph A reorders the AST', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();
    await page.keyboard.type('Paragraph A');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Paragraph B');

    await page.waitForTimeout(500);

    // Verify initial order: A then B
    let stateText = await stateDisplay.textContent();
    let state = JSON.parse(stateText!);
    expect(state.root.children[0].children[0].text).toBe('Paragraph A');
    expect(state.root.children[1].children[0].text).toBe('Paragraph B');

    // Hover over paragraph B to show drag handle
    const paragraphs = editor.locator('p');
    const paraB = paragraphs.nth(1);
    const paraA = paragraphs.nth(0);

    await paraB.hover();
    await page.waitForTimeout(300);

    const dragHandle = page.locator(HANDLE_SELECTOR);
    await expect(dragHandle).toBeVisible();

    // Get positions
    const rectA = await paraA.boundingBox();
    expect(rectA).toBeTruthy();

    // Dispatch mousedown directly on the drag handle element, then simulate
    // document-level mousemove/mouseup via page.evaluate for reliable DnD
    const targetY = rectA!.y + 4; // top of paragraph A = "before" position
    const ns = 'playground-editor';

    await page.evaluate(
      ({ targetY: ty, namespace }) => {
        const handle = document.querySelector(
          `[data-testid="overlay-drag-handle"][data-namespace="${namespace}"]`,
        );
        if (!handle) throw new Error('No drag handle found');

        const handleRect = handle.getBoundingClientRect();

        // Dispatch mousedown on the handle
        handle.dispatchEvent(
          new MouseEvent('mousedown', {
            bubbles: true,
            clientX: handleRect.x + handleRect.width / 2,
            clientY: handleRect.y + handleRect.height / 2,
            button: 0,
          }),
        );

        // Dispatch mousemove on document to trigger drag
        const editorRoot = document.querySelector(
          `[data-namespace="${namespace}"] [contenteditable="true"]`,
        );
        if (!editorRoot) throw new Error('No editor root found');
        const editorRect = editorRoot.getBoundingClientRect();

        document.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            clientX: editorRect.x + editorRect.width / 2,
            clientY: ty,
            button: 0,
          }),
        );

        // Dispatch mouseup on document
        document.dispatchEvent(
          new MouseEvent('mouseup', {
            bubbles: true,
            clientX: editorRect.x + editorRect.width / 2,
            clientY: ty,
            button: 0,
          }),
        );
      },
      { targetY, namespace: ns },
    );

    await page.waitForTimeout(500);

    // Verify new order: B then A
    stateText = await stateDisplay.textContent();
    state = JSON.parse(stateText!);
    const firstText = state.root.children[0]?.children?.[0]?.text;
    const secondText = state.root.children[1]?.children?.[0]?.text;
    expect(firstText).toBe('Paragraph B');
    expect(secondText).toBe('Paragraph A');
  });

  test('native text selection works across block boundaries after OverlayPortal mount', async ({
    page,
  }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    await editor.focus();
    await page.keyboard.type('First paragraph');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph');

    // Select all text
    await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+a`);
    await page.waitForTimeout(200);

    // Verify the selection spans both paragraphs
    const selectedText = await page.evaluate(() => {
      return window.getSelection()?.toString() ?? '';
    });
    expect(selectedText).toContain('First paragraph');
    expect(selectedText).toContain('Second paragraph');
  });
});

test.describe('Phase 3: Overlay Portal — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('drag handle is never rendered on mobile viewport', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Touch emulation only reliable in Chromium');

    const context = page.context();
    const mobilePage = await context.browser()!.newPage({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });

    await mobilePage.goto('/');
    const mobileEditor = mobilePage.locator(EDITOR_SELECTOR);
    await mobileEditor.waitFor({ state: 'visible' });
    await mobileEditor.focus();
    await mobilePage.keyboard.type('Mobile text');

    await mobilePage.waitForTimeout(300);
    const handle = mobilePage.locator(HANDLE_SELECTOR);
    await expect(handle).not.toBeVisible();

    await mobilePage.close();
  });
});

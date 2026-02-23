import { test, expect } from '@playwright/test';

test.describe('Phase 1: Core Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('editor mounts and is focusable', async ({ page }) => {
    const editor = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    await expect(editor).toBeVisible();
    await editor.focus();
    await expect(editor).toBeFocused();
  });

  test('typing text updates the serializedState JSON output', async ({ page }) => {
    const editor = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    const stateOutput = page.locator('[data-namespace="playground-editor"]').locator('~ pre[data-testid="editor-state"]').first();

    // Wait for editor to be ready, then get the state display within the same EditorRoot
    // The pre is a child of the EditorRoot div
    const stateDisplay = page.locator('[data-namespace="playground-editor"] pre[data-testid="editor-state"]');

    await editor.focus();
    await page.keyboard.type('Hello World');

    // Wait for debounce (300ms) + some buffer
    await page.waitForTimeout(500);

    const state = await stateDisplay.textContent();
    expect(state).toBeTruthy();
    expect(state).toContain('Hello World');
  });

  test('JSON output contains typed text as a Lexical paragraph node', async ({ page }) => {
    const editor = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    const stateDisplay = page.locator('[data-namespace="playground-editor"] pre[data-testid="editor-state"]');

    await editor.focus();
    await page.keyboard.type('Test paragraph');

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();

    const state = JSON.parse(stateText!);
    const root = state.root;
    expect(root.type).toBe('root');
    expect(root.children.length).toBeGreaterThan(0);

    const firstChild = root.children[0];
    expect(firstChild.type).toBe('paragraph');
    expect(firstChild.children.length).toBeGreaterThan(0);
    expect(firstChild.children[0].text).toBe('Test paragraph');
  });

  test('Cmd+Z undo removes last word', async ({ page }) => {
    const editor = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    const stateDisplay = page.locator('[data-namespace="playground-editor"] pre[data-testid="editor-state"]');

    await editor.focus();
    await page.keyboard.type('Hello ');
    // Small pause so the next word is a separate history entry
    await page.waitForTimeout(100);
    await page.keyboard.type('World');

    await page.waitForTimeout(500);

    // Verify both words are present
    let stateText = await stateDisplay.textContent();
    expect(stateText).toContain('Hello');
    expect(stateText).toContain('World');

    // Undo
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+z`);

    await page.waitForTimeout(500);

    stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();

    // After undo, "World" should be removed
    const state = JSON.parse(stateText!);
    const paragraphText = state.root.children[0]?.children
      ?.map((c: { text?: string }) => c.text ?? '')
      .join('') ?? '';

    expect(paragraphText).not.toContain('World');
  });

  test('two editors coexist without interfering with each other', async ({ page }) => {
    const editorA = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    const editorB = page.locator('[data-namespace="playground-editor-b"] [contenteditable="true"]');
    const stateA = page.locator('[data-namespace="playground-editor"] pre[data-testid="editor-state"]');
    const stateB = page.locator('[data-namespace="playground-editor-b"] pre[data-testid="editor-state"]');

    // Both editors should be visible
    await expect(editorA).toBeVisible();
    await expect(editorB).toBeVisible();

    // Type in editor A
    await editorA.focus();
    await page.keyboard.type('Content for A');

    await page.waitForTimeout(500);

    // Type in editor B
    await editorB.focus();
    await page.keyboard.type('Content for B');

    await page.waitForTimeout(500);

    // Verify each editor has its own state
    const stateAText = await stateA.textContent();
    const stateBText = await stateB.textContent();

    expect(stateAText).toContain('Content for A');
    expect(stateAText).not.toContain('Content for B');

    expect(stateBText).toContain('Content for B');
    expect(stateBText).not.toContain('Content for A');
  });
});

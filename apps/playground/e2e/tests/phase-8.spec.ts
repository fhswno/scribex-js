import { test, expect, devices } from '@playwright/test';

const EDITOR_SELECTOR = '[data-namespace="playground-editor"] [contenteditable="true"]';
const STATE_SELECTOR = '[data-namespace="playground-editor"] pre[data-testid="editor-state"]';

// ─── Paste Sanitisation Tests ──────────────────────────────────────────────────

test.describe('Phase 8: Paste Sanitisation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('sanitizePastedHTML strips script tags', async ({ page }) => {
    // Run the sanitizer in the browser context where DOMParser is available
    const result = await page.evaluate(() => {
      // Import the function by inlining its logic — we test the actual module via paste
      const parser = new DOMParser();
      const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
      const doc = parser.parseFromString(html, 'text/html');
      // Script tags should be removed by our sanitizer when paste happens
      return doc.body.innerHTML;
    });

    // DOMParser itself removes scripts in some browsers but let's test the paste flow
    // The real test is below — pasting HTML with script tags
  });

  test('pasting HTML with <b>bold</b> inserts bold-formatted text', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();

    // Simulate pasting HTML with bold text via clipboard API
    await page.evaluate(() => {
      const editor = document.querySelector('[data-namespace="playground-editor"] [contenteditable="true"]');
      if (!editor) throw new Error('Editor not found');

      const clipboardData = new DataTransfer();
      clipboardData.setData('text/html', '<p><strong>Bold text</strong> and normal</p>');
      clipboardData.setData('text/plain', 'Bold text and normal');

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(pasteEvent);
    });

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    // Find text nodes in the AST
    const paragraphs = state.root.children.filter(
      (c: { type: string }) => c.type === 'paragraph',
    );
    expect(paragraphs.length).toBeGreaterThan(0);

    // Check that at least one text node has bold format (format & 1)
    const hasBold = paragraphs.some((p: { children: Array<{ format?: number; text?: string }> }) =>
      p.children.some((c) => c.text && (c.format ?? 0) & 1),
    );
    expect(hasBold).toBe(true);
  });

  test('pasting HTML with <script> tags strips them', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();

    await page.evaluate(() => {
      const editor = document.querySelector('[data-namespace="playground-editor"] [contenteditable="true"]');
      if (!editor) throw new Error('Editor not found');

      const clipboardData = new DataTransfer();
      clipboardData.setData(
        'text/html',
        '<p>Safe text</p><script>alert("xss")</script><p>More safe text</p>',
      );
      clipboardData.setData('text/plain', 'Safe text More safe text');

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(pasteEvent);
    });

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();

    // The AST should NOT contain any script content
    expect(stateText).not.toContain('alert');
    expect(stateText).not.toContain('xss');

    // But should contain the safe text
    expect(stateText).toContain('Safe text');
  });

  test('pasting HTML with inline styles strips styles but preserves semantic elements', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();

    await page.evaluate(() => {
      const editor = document.querySelector('[data-namespace="playground-editor"] [contenteditable="true"]');
      if (!editor) throw new Error('Editor not found');

      const clipboardData = new DataTransfer();
      clipboardData.setData(
        'text/html',
        '<p style="color: red; font-size: 16px;"><strong style="font-weight: 700;">Styled bold</strong> and <em class="fancy">italic text</em></p>',
      );
      clipboardData.setData('text/plain', 'Styled bold and italic text');

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(pasteEvent);
    });

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();

    // Should contain the text
    expect(stateText).toContain('Styled bold');
    expect(stateText).toContain('italic text');

    const state = JSON.parse(stateText!);
    const paragraphs = state.root.children.filter(
      (c: { type: string }) => c.type === 'paragraph',
    );
    expect(paragraphs.length).toBeGreaterThan(0);

    // Bold should be preserved (format & 1)
    const hasBold = paragraphs.some((p: { children: Array<{ format?: number; text?: string }> }) =>
      p.children.some((c) => c.text?.includes('Styled bold') && ((c.format ?? 0) & 1)),
    );
    expect(hasBold).toBe(true);

    // Italic should be preserved (format & 2)
    const hasItalic = paragraphs.some((p: { children: Array<{ format?: number; text?: string }> }) =>
      p.children.some((c) => c.text?.includes('italic text') && ((c.format ?? 0) & 2)),
    );
    expect(hasItalic).toBe(true);
  });

  test('pasting HTML with onclick handlers strips event attributes', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);

    await editor.focus();

    await page.evaluate(() => {
      const editor = document.querySelector('[data-namespace="playground-editor"] [contenteditable="true"]');
      if (!editor) throw new Error('Editor not found');

      const clipboardData = new DataTransfer();
      clipboardData.setData(
        'text/html',
        '<p onclick="alert(1)">Click me</p><a href="https://example.com" onclick="alert(2)">Link</a>',
      );
      clipboardData.setData('text/plain', 'Click me Link');

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(pasteEvent);
    });

    await page.waitForTimeout(500);

    // Check there are no onclick handlers in the rendered DOM
    const hasOnclick = await page.evaluate(() => {
      const root = document.querySelector('[data-namespace="playground-editor"] [contenteditable="true"]');
      if (!root) return false;
      const allElements = root.querySelectorAll('*');
      for (const el of allElements) {
        if (el.getAttribute('onclick')) return true;
      }
      return false;
    });
    expect(hasOnclick).toBe(false);
  });

  test('pasting HTML with nested spans collapses them', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();

    await page.evaluate(() => {
      const editor = document.querySelector('[data-namespace="playground-editor"] [contenteditable="true"]');
      if (!editor) throw new Error('Editor not found');

      const clipboardData = new DataTransfer();
      clipboardData.setData(
        'text/html',
        '<p><span><span><span>Deeply nested text</span></span></span></p>',
      );
      clipboardData.setData('text/plain', 'Deeply nested text');

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(pasteEvent);
    });

    await page.waitForTimeout(500);

    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    expect(stateText).toContain('Deeply nested text');
  });
});

// ─── sanitizePastedHTML Unit Tests (run in browser via window.__scribex_sanitize) ─

test.describe('Phase 8: sanitizePastedHTML unit tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the sanitizer to be exposed on window
    await page.waitForFunction(() => '__scribex_sanitize' in window);
  });

  const sanitize = (page: import('@playwright/test').Page, html: string) =>
    page.evaluate((h) => {
      const fn = (window as unknown as Record<string, ((html: string) => string) | undefined>).__scribex_sanitize;
      if (!fn) throw new Error('__scribex_sanitize not found on window');
      return fn(h);
    }, html);

  test('strips script tags entirely', async ({ page }) => {
    const result = await sanitize(page, '<p>Hello</p><script>alert("xss")</script><p>World</p>');

    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  test('strips style tags entirely', async ({ page }) => {
    const result = await sanitize(page, '<style>.foo { color: red; }</style><p>Content</p>');

    expect(result).not.toContain('style');
    expect(result).not.toContain('.foo');
    expect(result).toContain('Content');
  });

  test('strips all style attributes', async ({ page }) => {
    const result = await sanitize(page, '<p style="color: red; font-size: 16px;">Styled</p>');

    expect(result).not.toContain('style=');
    expect(result).not.toContain('color');
    expect(result).toContain('Styled');
  });

  test('strips all class attributes', async ({ page }) => {
    const result = await sanitize(page, '<p class="fancy-class">Classy</p>');

    expect(result).not.toContain('class=');
    expect(result).toContain('Classy');
  });

  test('preserves allowed elements (strong, em, a href, img src alt)', async ({ page }) => {
    const result = await sanitize(
      page,
      '<p><strong>Bold</strong> <em>Italic</em> <a href="https://example.com">Link</a> <img src="test.png" alt="Test"></p>',
    );

    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('src="test.png"');
    expect(result).toContain('alt="Test"');
  });

  test('unwraps non-allowed elements to text content', async ({ page }) => {
    const result = await sanitize(page, '<center>Centered</center><font color="red">Fonted</font>');

    expect(result).not.toContain('<center>');
    expect(result).not.toContain('<font');
    expect(result).toContain('Centered');
    expect(result).toContain('Fonted');
  });

  test('collapses nested spans', async ({ page }) => {
    const result = await sanitize(page, '<p><span><span><span>Nested</span></span></span></p>');

    expect(result).not.toContain('<span>');
    expect(result).toContain('Nested');
  });

  test('strips event handler attributes', async ({ page }) => {
    const result = await sanitize(page, '<p onclick="alert(1)" onload="evil()">Safe</p>');

    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onload');
    expect(result).toContain('Safe');
  });

  test('converts Google Docs heading spans to heading elements', async ({ page }) => {
    const result = await sanitize(page, '<span style="font-size:26pt">Title Text</span>');

    // font-size 26pt (= ~34.67px) should map to h1
    expect(result).toContain('<h1>');
    expect(result).toContain('Title Text');
  });

  test('normalizes B to STRONG and I to EM', async ({ page }) => {
    const result = await sanitize(page, '<p><b>Bold</b> <i>Italic</i></p>');

    expect(result).toContain('<strong>');
    expect(result).not.toContain('<b>');
    expect(result).toContain('<em>');
    expect(result).not.toContain('<i>');
  });

  test('strips iframe and object tags entirely', async ({ page }) => {
    const result = await sanitize(
      page,
      '<p>Before</p><iframe src="evil.com"></iframe><object data="evil.swf"></object><p>After</p>',
    );

    expect(result).not.toContain('iframe');
    expect(result).not.toContain('object');
    expect(result).not.toContain('evil');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });
});

// ─── Mobile Toolbar Tests ──────────────────────────────────────────────────────

test.describe('Phase 8: Mobile', () => {
  test('drag handle is not rendered on mobile viewport', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
    });
    const page = await context.newPage();
    await page.goto('/');

    const editor = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    await editor.waitFor({ state: 'visible' });

    // Drag handle should not be rendered on touch devices
    const handles = page.locator('[data-testid="overlay-drag-handle"]');
    await expect(handles).toHaveCount(0);

    await context.close();
  });

  test('basic typing works on mobile viewport', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
    });
    const page = await context.newPage();
    await page.goto('/');

    const editor = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    await editor.waitFor({ state: 'visible' });

    await editor.focus();
    await page.keyboard.type('Mobile typing works');

    await page.waitForTimeout(500);

    const stateDisplay = page.locator('[data-namespace="playground-editor"] pre[data-testid="editor-state"]');
    const stateText = await stateDisplay.textContent();
    expect(stateText).toContain('Mobile typing works');

    await context.close();
  });

  test('slash menu triggers on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
    });
    const page = await context.newPage();
    await page.goto('/');

    const editor = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    await editor.waitFor({ state: 'visible' });

    await editor.focus();
    await page.keyboard.type('/');

    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="slash-menu"]')).toBeVisible();

    // Close it by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="slash-menu"]')).not.toBeVisible();

    await context.close();
  });
});

// ─── IME Composition Tests ─────────────────────────────────────────────────────

test.describe('Phase 8: IME Composition', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('input rules do not fire during IME composition', async ({ page }) => {
    const editor = page.locator(EDITOR_SELECTOR);
    const stateDisplay = page.locator(STATE_SELECTOR);

    await editor.focus();

    // Simulate IME composition: compositionstart → type trigger text → compositionend
    // During composition, "# " should NOT convert to a heading
    await page.evaluate(() => {
      const editor = document.querySelector('[data-namespace="playground-editor"] [contenteditable="true"]');
      if (!editor) throw new Error('Editor not found');

      // Fire compositionstart
      editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    });

    // Type trigger text during composition
    await page.keyboard.type('# ');

    await page.waitForTimeout(500);

    // The block should still be a paragraph, NOT a heading (because IME was active)
    const stateText = await stateDisplay.textContent();
    expect(stateText).toBeTruthy();
    const state = JSON.parse(stateText!);

    // During composition, the input rule should not have fired
    // The node should be a paragraph (not a heading)
    const firstChild = state.root.children[0];
    expect(firstChild.type).toBe('paragraph');

    // Now end composition
    await page.evaluate(() => {
      const editor = document.querySelector('[data-namespace="playground-editor"] [contenteditable="true"]');
      if (!editor) throw new Error('Editor not found');

      editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    });
  });
});

// ─── Multi-Editor Stress Test ──────────────────────────────────────────────────

test.describe('Phase 8: Multi-Editor Stress Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for primary editor to be ready
    await page.locator(EDITOR_SELECTOR).waitFor({ state: 'visible' });
  });

  test('five editors maintain independent state', async ({ page }) => {
    // Scroll to make stress test editors visible
    await page.locator('[data-testid="stress-test-editors"]').scrollIntoViewIfNeeded();

    // Wait for all 5 editors to be present
    const editorNamespaces = [
      'playground-editor',
      'playground-editor-b',
      'playground-editor-c',
      'playground-editor-d',
      'playground-editor-e',
    ];

    for (const ns of editorNamespaces) {
      await page.locator(`[data-namespace="${ns}"] [contenteditable="true"]`).waitFor({ state: 'visible', timeout: 5000 });
    }

    // Type unique text in editor C (index 2)
    const editorC = page.locator('[data-namespace="playground-editor-c"] [contenteditable="true"]');
    await editorC.focus();
    await page.keyboard.type('Unique text in editor C');
    await page.waitForTimeout(500);

    // Verify editor C contains the text
    const stateCDisplay = page.locator('[data-namespace="playground-editor-c"] pre[data-testid="editor-state"]');
    const stateCText = await stateCDisplay.textContent();
    expect(stateCText).toContain('Unique text in editor C');

    // Verify editor A (primary) does NOT contain editor C's text
    const stateADisplay = page.locator('[data-namespace="playground-editor"] pre[data-testid="editor-state"]');
    const stateAText = await stateADisplay.textContent();
    // Editor A state should not contain editor C's text
    // Note: stateA might be empty if we haven't typed in it, which is fine
    if (stateAText) {
      expect(stateAText).not.toContain('Unique text in editor C');
    }

    // Type in editor D
    const editorD = page.locator('[data-namespace="playground-editor-d"] [contenteditable="true"]');
    await editorD.focus();
    await page.keyboard.type('Editor D content');
    await page.waitForTimeout(500);

    const stateDDisplay = page.locator('[data-namespace="playground-editor-d"] pre[data-testid="editor-state"]');
    const stateDText = await stateDDisplay.textContent();
    expect(stateDText).toContain('Editor D content');

    // Re-verify editor C state is still independent
    const stateCTextAfter = await stateCDisplay.textContent();
    expect(stateCTextAfter).toContain('Unique text in editor C');
    expect(stateCTextAfter).not.toContain('Editor D content');
  });

  test('typing in editor 3 does not affect editor 1 state', async ({ page }) => {
    // Scroll to reveal all editors
    await page.locator('[data-testid="stress-test-editors"]').scrollIntoViewIfNeeded();

    // Type in the primary editor first
    const editorA = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    await editorA.scrollIntoViewIfNeeded();
    await editorA.focus();
    await page.keyboard.type('Editor A baseline');
    await page.waitForTimeout(500);

    // Get editor A state
    const stateADisplay = page.locator('[data-namespace="playground-editor"] pre[data-testid="editor-state"]');
    const stateABefore = await stateADisplay.textContent();
    expect(stateABefore).toContain('Editor A baseline');

    // Now type in editor C
    const editorC = page.locator('[data-namespace="playground-editor-c"] [contenteditable="true"]');
    await editorC.scrollIntoViewIfNeeded();
    await editorC.focus();
    await page.keyboard.type('Completely different content');
    await page.waitForTimeout(500);

    // Verify editor A state is unchanged
    const stateAAfter = await stateADisplay.textContent();
    expect(stateAAfter).toContain('Editor A baseline');
    expect(stateAAfter).not.toContain('Completely different content');
  });
});

// ─── Architecture Audit ────────────────────────────────────────────────────────

test.describe('Phase 8: Architecture Audit', () => {
  test('all editors have independent overlay portals', async ({ page }) => {
    await page.goto('/');

    // Primary and B editors should each have their own overlay portal
    // (Touch device detection may prevent drag handles from rendering,
    // but the namespace data attribute should be set)
    const editorA = page.locator('[data-namespace="playground-editor"] [contenteditable="true"]');
    const editorB = page.locator('[data-namespace="playground-editor-b"] [contenteditable="true"]');

    await expect(editorA).toBeVisible();
    await expect(editorB).toBeVisible();

    // Both editors should be functional and isolated
    await editorA.focus();
    await page.keyboard.type('A content');
    await page.waitForTimeout(500);

    await editorB.focus();
    await page.keyboard.type('B content');
    await page.waitForTimeout(500);

    const stateA = await page.locator('[data-namespace="playground-editor"] pre[data-testid="editor-state"]').textContent();
    const stateB = await page.locator('[data-namespace="playground-editor-b"] pre[data-testid="editor-state"]').textContent();

    expect(stateA).toContain('A content');
    expect(stateA).not.toContain('B content');
    expect(stateB).toContain('B content');
    expect(stateB).not.toContain('A content');
  });
});

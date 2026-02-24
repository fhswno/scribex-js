# Contributing to Scribex

Thanks for considering contributing. Here's what you need to know.

## Setup

```bash
git clone https://github.com/fhswno/scribex-js.git
cd scribex-js
bun install
bun dev
```

Requires [Bun](https://bun.sh) v1.0+.

## Development Workflow

1. Create a branch from `main`
2. Make your changes in `packages/scribex/src/`
3. Test in the playground at `http://localhost:3000`
4. Run checks before opening a PR:

```bash
bun typecheck    # Must pass with zero errors
bun test         # Must pass all Playwright tests
```

## Code Guidelines

**TypeScript**
- Strict mode is on. No `as any`. No `// @ts-ignore`.
- If you need to suppress a type error, use `// @ts-expect-error` with a description.

**Lexical**
- All AST mutations go through `editor.update()`. Never mutate the DOM directly.
- Never nest `editor.update()` calls.
- Always check `$getSelection()` for null before using it.
- Register custom nodes in `packages/scribex/src/nodes/index.ts`.

**Styling**
- Never hardcode color values. Use CSS variables from `tokens.css`.
- Prefix all new tokens with `--scribex-`.

**Components**
- Named exports only (no default exports).
- Client components must have `'use client'` at the top.
- No imports from `apps/` inside `packages/scribex/`.

## Adding a New Plugin

1. Create `packages/scribex/src/plugins/YourPlugin.tsx`
2. If it needs custom nodes, add them to `packages/scribex/src/nodes/`
3. Register new nodes in `ALL_NODES` array (`packages/scribex/src/nodes/index.ts`)
4. Export from `packages/scribex/src/index.ts`
5. Wire it up in `apps/playground/app/page.tsx` to demo it
6. Write Playwright tests in `apps/playground/e2e/tests/`

## Tests

Tests use Playwright and run in a real Chromium browser.

```bash
# Run all tests
bun test

# Run a specific test file
cd apps/playground && bunx playwright test e2e/tests/phase-1.spec.ts

# Run with UI mode
cd apps/playground && bunx playwright test --ui
```

Tests require the dev server to be running (`bun dev` in another terminal), or use the Playwright config's webServer option.

## Commit Messages

Keep them short and descriptive. Format: `<what>: <why>`

```
feat: add table plugin with CRUD operations
fix: prevent focus loss when clicking toolbar buttons
refactor: extract portal logic into shared hook
```

## Pull Requests

- Keep PRs focused. One feature or fix per PR.
- Include a brief description of what changed and why.
- Make sure `bun typecheck` and `bun test` pass.
- Screenshots or recordings for UI changes are helpful but not required.

## Project Structure

```
packages/scribex/src/
├── components/    # React components (EditorRoot, FloatingToolbar, etc.)
├── plugins/       # Lexical plugins (InputRulePlugin, ImagePlugin, etc.)
├── nodes/         # Custom Lexical nodes (ImageNode, MentionNode, etc.)
├── hooks/         # React hooks (useEditorState)
├── utils/         # Pure utilities (markdown, sanitize)
├── data/          # Static data (emoji list)
├── styles/        # CSS tokens
├── commands.ts    # Custom Lexical commands
├── theme.ts       # Lexical theme class mapping
├── types.ts       # Public TypeScript interfaces
└── index.ts       # Public API surface
```

## Questions?

Open an issue. We'll get back to you.

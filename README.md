# Scribex

A block-based rich text editor for Next.js. Copy-paste components, own every line of code.

Built on [Lexical](https://lexical.dev), [Radix UI](https://radix-ui.com), and [Tailwind CSS](https://tailwindcss.com).

> **Status:** Early development (v0.0.1). API is unstable. Contributions welcome.

## What is this?

Scribex is a Notion-style editor library designed for Next.js App Router. Instead of installing a black-box package, you copy components into your project and customize them directly — the same approach as [shadcn/ui](https://ui.shadcn.com).

Every feature is an independent, composable plugin passed as a React child:

```tsx
<EditorRoot namespace="my-editor">
  <FloatingToolbar />
  <InputRulePlugin />
  <SlashMenu />
  <ImagePlugin uploadHandler={handleUpload} />
  <MentionPlugin providers={mentionProviders} />
  <LinkPlugin />
</EditorRoot>
```

No prop explosion. No feature flags. Add what you need, remove what you don't.

## Features

- **Rich text** — Bold, italic, underline, strikethrough, inline code
- **Block types** — Headings, blockquotes, bullet/numbered/check lists, dividers
- **Slash menu** — `/` command palette with fuzzy search
- **Floating toolbar** — Appears on text selection
- **Images** — Drag-and-drop with optimistic upload UI
- **Code blocks** — Shiki syntax highlighting, 16 languages
- **Links** — Inline editing, preview popover, Cmd+K shortcut
- **Mentions** — `@users`, `#tags`, custom triggers with async search
- **Emoji picker** — `:colon` trigger with search
- **AI integration** — Streaming preview with accept/discard, provider-agnostic
- **Paste sanitization** — Cleans HTML from Google Docs, Word, web pages
- **Drag and drop** — Block reordering via drag handles (desktop)
- **Mobile toolbar** — Bottom-anchored formatting bar on touch devices
- **Multi-editor** — Multiple isolated editor instances on one page
- **Theming** — CSS custom properties, light/dark mode

## Quick Start

```bash
# Clone
git clone https://github.com/fhswno/scribex-js.git
cd scribex-js

# Install
bun install

# Run the playground
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
scribex-js/
├── packages/
│   └── scribex/              # @scribex/core — the library
│       └── src/
│           ├── components/   # EditorRoot, FloatingToolbar, SlashMenu, etc.
│           ├── plugins/      # InputRulePlugin, ImagePlugin, AIPlugin, etc.
│           ├── nodes/        # Custom Lexical nodes (Image, CodeBlock, Mention, etc.)
│           ├── hooks/        # useEditorState
│           ├── utils/        # Markdown serialization, HTML sanitization
│           ├── styles/       # CSS custom property tokens
│           └── index.ts      # Public API
│
└── apps/
    ├── playground/           # Next.js reference app with all features wired up
    └── docs/                 # Documentation site (scaffold)
```

The library (`packages/scribex`) has zero imports from `apps/`. It is fully self-contained.

## Tech Stack

| Layer | Choice |
|---|---|
| Package manager | [Bun](https://bun.sh) |
| Framework | [Next.js](https://nextjs.org) (App Router) |
| Editor engine | [Lexical](https://lexical.dev) |
| UI primitives | [Radix UI](https://radix-ui.com) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) + CSS custom properties |
| Icons | [Phosphor Icons](https://phosphoricons.com) |
| Syntax highlighting | [Shiki](https://shiki.style) |
| Testing | [Playwright](https://playwright.dev) |
| TypeScript | Strict mode, `noUncheckedIndexedAccess` |

## Theming

All visual tokens are CSS custom properties prefixed with `--scribex-`. Override them to match your design system:

```css
:root {
  --scribex-accent: hsl(221 83% 53%);
  --scribex-background: hsl(0 0% 100%);
  --scribex-foreground: hsl(222 84% 5%);
  --scribex-border: hsl(214 32% 91%);
  --scribex-radius: 0.5rem;
  /* ... see packages/scribex/src/styles/tokens.css for the full list */
}
```

## Scripts

```bash
bun dev              # Start playground dev server
bun typecheck        # Run tsc --noEmit across the monorepo
bun test             # Run Playwright tests
bun build            # Build the playground app
```

## AI Integration

Scribex is provider-agnostic. Implement the `AIProvider` interface to connect any LLM:

```ts
const myProvider: AIProvider = {
  name: "My LLM",
  generate: async ({ prompt, context }) => {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, context }),
    });
    return response.body; // ReadableStream<string>
  },
};
```

The playground includes working examples for [Ollama](https://ollama.com) (local, no API key) and [Mistral](https://mistral.ai).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

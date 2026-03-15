# @blokhaus/core

The **shadcn of rich text editors** — composable, block-based Notion-style editor components for Next.js, built on [Lexical](https://lexical.dev).

Zero abstraction. Full ownership. Every component is a composable React plugin you control.

[Documentation](https://blokhaus.fhswno.com) | [Playground](https://playground.blokhaus.fhswno.com)

## Features

- **Block-based editing** — headings, paragraphs, lists, blockquotes, code blocks, callouts, toggles, tables, horizontal rules
- **Floating toolbar** — appears on text selection with bold, italic, underline, strikethrough, code, link, color, highlight, font family
- **Slash menu** — type `/` to insert any block type
- **Drag-and-drop** — Notion-style block reordering with overlay handles
- **Marquee block selection** — click-drag from margins to select multiple blocks
- **Image & video uploads** — optimistic loading UI with pluggable `UploadHandler`
- **Video embeds** — YouTube, Vimeo, Loom URL detection
- **AI streaming** — pluggable `AIProvider` with streaming preview, accept/discard flow, single undo entry
- **Mentions** — `@` and `#` triggers with async search and keyboard navigation
- **Emoji picker** — inline emoji insertion via `:` trigger
- **Code blocks** — with language selection and Shiki syntax highlighting
- **Callout blocks** — Notion-style colored callouts with emoji icons
- **Toggle blocks** — collapsible content sections
- **Tables** — with column resize, header rows, cell background colors, and action menus
- **Link editing** — inline link input with preview on hover
- **Color & highlight** — text color and background highlight with customizable palette
- **Font families** — configurable font picker
- **RTL/LTR direction** — per-block text direction control
- **Paste sanitization** — cleans HTML from Google Docs, Word, and web pages
- **Mobile support** — bottom-anchored toolbar on touch devices, drag handles disabled
- **Input rules** — Markdown shortcuts (`# `, `> `, `- `, `1. `, `` ``` ``, `---`, etc.)
- **Word count** — `useWordCount` hook for live word/character counts
- **Dark mode** — full CSS variable theming with light and dark tokens
- **Multi-editor** — multiple isolated editor instances on one page

## Install

```bash
npm install @blokhaus/core lexical react react-dom
# or
pnpm add @blokhaus/core lexical react react-dom
# or
bun add @blokhaus/core lexical react react-dom
```

## Quick Start

```tsx
"use client";

import {
  EditorRoot,
  FloatingToolbar,
  SlashMenu,
  InputRulePlugin,
  ListPlugin,
  LinkPlugin,
  PastePlugin,
  OverlayPortal,
  BlockSelectionPlugin,
} from "@blokhaus/core";
import "@blokhaus/core/styles";

export function Editor() {
  return (
    <EditorRoot namespace="my-editor" className="relative min-h-50 p-4">
      <FloatingToolbar />
      <SlashMenu />
      <InputRulePlugin />
      <ListPlugin />
      <LinkPlugin />
      <PastePlugin />
      <OverlayPortal />
      <BlockSelectionPlugin />
    </EditorRoot>
  );
}
```

## Theming

Blokhaus uses CSS custom properties for all colors. Import the default tokens and override any variable:

```css
@import "@blokhaus/core/styles";

:root {
  --blokhaus-accent: hsl(262 83% 58%);
  --blokhaus-radius: 0.75rem;
}
```

See [`src/styles/tokens.css`](./src/styles/tokens.css) for all available tokens.

## Composable Architecture

Every feature is an independent plugin passed as a child of `<EditorRoot>`. Add only what you need:

```tsx
<EditorRoot namespace="minimal">
  {/* Just rich text — no toolbar, no slash menu, no drag handles */}
  <InputRulePlugin />
</EditorRoot>
```

```tsx
<EditorRoot namespace="full">
  <FloatingToolbar />
  <SlashMenu />
  <InputRulePlugin />
  <ListPlugin />
  <LinkPlugin />
  <ImagePlugin uploadHandler={myUpload} />
  <VideoPlugin uploadHandler={myUpload} />
  <AIPlugin provider={myAIProvider} />
  <MentionPlugin providers={[userMentionProvider]} />
  <EmojiPickerPlugin />
  <CalloutPlugin />
  <TogglePlugin />
  <TablePlugin />
  <CodeBlockNode />
  <ColorPlugin />
  <PastePlugin />
  <OverlayPortal />
  <BlockSelectionPlugin />
  <MobileToolbar />
</EditorRoot>
```

## Reading Editor State

```tsx
import { useEditorState } from "@blokhaus/core";

function SaveButton() {
  const { serializedState } = useEditorState({
    debounceMs: 300,
    onChange: (json) => console.log("State changed:", json),
  });

  return <button onClick={() => save(serializedState)}>Save</button>;
}
```

## Image & Video Uploads

Provide an `UploadHandler` — a function that takes a `File` and returns a URL:

```tsx
const uploadHandler = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const { url } = await res.json();
  return url;
};

<ImagePlugin uploadHandler={uploadHandler} />
<VideoPlugin uploadHandler={uploadHandler} />
```

## AI Integration

Implement the `AIProvider` interface to stream AI-generated content:

```tsx
import type { AIProvider } from "@blokhaus/core";

const myProvider: AIProvider = {
  generate: async ({ prompt, context }) => {
    const res = await fetch("/api/ai", {
      method: "POST",
      body: JSON.stringify({ prompt, context }),
    });
    return res.body!; // ReadableStream<string>
  },
};

<AIPlugin provider={myProvider} />
```

## Peer Dependencies

| Package | Version |
|---------|---------|
| `react` | >= 18 |
| `react-dom` | >= 18 |
| `lexical` | >= 0.40.0, < 1.0.0 |
| `next` | >= 14 |

## License

MIT

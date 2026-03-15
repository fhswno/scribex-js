// NEXT
import Link from "next/link";

// ICONS
import {
  Code,
  LayoutGrid,
  Sparkles,
  Puzzle,
  Palette,
  FileCode,
} from "lucide-react";

// COMPONENTS
import FeatureCard from "./FeatureCard";
import CopyInstallButton from "./CopyInstallButton";

const CODE_EXAMPLE = `import {
  EditorRoot,
  FloatingToolbar,
  SlashMenu,
  OverlayPortal,
  InputRulePlugin,
  ImagePlugin,
  AIPlugin,
  MentionPlugin,
} from "@blokhaus/core";

export function Editor() {
  return (
    <EditorRoot namespace="my-editor">
      <FloatingToolbar />
      <SlashMenu />
      <OverlayPortal namespace="my-editor" />
      <InputRulePlugin />
      <ImagePlugin uploadHandler={upload} />
      <AIPlugin provider={myAI} />
      <MentionPlugin providers={[users]} />
    </EditorRoot>
  );
}`;

const HomePage = () => {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      {/* Hero */}
      <p className="mb-4 font-(--font-mono) text-sm text-fd-primary">
        The shadcn of rich text editors.
      </p>
      <h1 className="mb-5 text-5xl font-bold tracking-tight md:text-7xl">
        Blokhaus
      </h1>
      <p className="mb-8 max-w-xl text-lg text-fd-muted-foreground">
        A zero-abstraction, copy-paste block editor for Next.js. You own every
        component, every node, every line of code. Built on Lexical.
      </p>

      <div className="mb-6">
        <CopyInstallButton />
      </div>

      <div className="flex gap-3">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
        >
          Get Started
        </Link>
        <a
          href="https://github.com/fhswno/blokhaus-js"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-fd-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
        >
          View on GitHub
        </a>
      </div>

      {/* Feature Grid */}
      <div className="mt-20 grid w-full max-w-4xl gap-4 text-left md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={<Code size={20} />}
          title="Zero Abstraction"
          description="Copy-paste into your project. Read every line. Fork fearlessly. No black boxes."
        />
        <FeatureCard
          icon={<LayoutGrid size={20} />}
          title="Block Editor UX"
          description="Drag-and-drop blocks, slash commands, floating toolbar. The Notion-style experience your users expect."
        />
        <FeatureCard
          icon={<Sparkles size={20} />}
          title="AI Streaming"
          description="Ephemeral AI preview nodes with accept/discard. Clean undo history — zero AST corruption during streaming."
        />
        <FeatureCard
          icon={<Puzzle size={20} />}
          title="20+ Plugins"
          description="Images, videos, tables, mentions, code blocks, callouts, toggles, lists, emoji, links — all composable."
        />
        <FeatureCard
          icon={<Palette size={20} />}
          title="Full Theming"
          description="CSS custom properties for every color, radius, and shadow. Dark mode included. Match any design system."
        />
        <FeatureCard
          icon={<FileCode size={20} />}
          title="TypeScript First"
          description="Strict mode. Every prop typed. Every hook documented. Autocomplete-driven development."
        />
      </div>

      {/* Code Preview */}
      <div className="mt-20 w-full max-w-3xl text-left">
        <h2 className="mb-2 text-center text-2xl font-bold tracking-tight">
          Compose your editor
        </h2>
        <p className="mb-6 text-center text-fd-muted-foreground">
          Every feature is an independent component. Include what you need,
          remove what you don&apos;t.
        </p>
        <div className="overflow-hidden rounded-lg border border-fd-border bg-fd-card">
          <div className="flex items-center gap-2 border-b border-fd-border px-4 py-2.5">
            <div className="h-3 w-3 rounded-full bg-fd-muted" />
            <div className="h-3 w-3 rounded-full bg-fd-muted" />
            <div className="h-3 w-3 rounded-full bg-fd-muted" />
            <span className="ml-2 font-(--font-mono) text-xs text-fd-muted-foreground">
              editor.tsx
            </span>
          </div>
          <pre className="overflow-x-auto p-4 font-(--font-mono) text-sm leading-relaxed text-fd-foreground">
            <code>{CODE_EXAMPLE}</code>
          </pre>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-20 grid w-full max-w-3xl gap-4 text-left md:grid-cols-3">
        <Link
          href="/docs/installation"
          className="group rounded-lg border border-fd-border bg-fd-card p-5 transition-all hover:border-fd-primary/50 hover:shadow-lg hover:shadow-fd-primary/5"
        >
          <h3 className="mb-1 text-sm font-semibold text-fd-foreground">
            Installation
          </h3>
          <p className="text-sm text-fd-muted-foreground">
            Get up and running in under 2 minutes.
          </p>
        </Link>
        <Link
          href="/docs/quick-start"
          className="group rounded-lg border border-fd-border bg-fd-card p-5 transition-all hover:border-fd-primary/50 hover:shadow-lg hover:shadow-fd-primary/5"
        >
          <h3 className="mb-1 text-sm font-semibold text-fd-foreground">
            Quick Start
          </h3>
          <p className="text-sm text-fd-muted-foreground">
            Build a full-featured editor step by step.
          </p>
        </Link>
        <Link
          href="/docs/api/components/editor-root"
          className="group rounded-lg border border-fd-border bg-fd-card p-5 transition-all hover:border-fd-primary/50 hover:shadow-lg hover:shadow-fd-primary/5"
        >
          <h3 className="mb-1 text-sm font-semibold text-fd-foreground">
            API Reference
          </h3>
          <p className="text-sm text-fd-muted-foreground">
            Every component, hook, and type documented.
          </p>
        </Link>
      </div>
    </main>
  );
};

export default HomePage;

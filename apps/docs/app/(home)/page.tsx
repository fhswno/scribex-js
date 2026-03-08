// NEXT
import Link from "next/link";

// COMPONENTS
import FeatureCard from "./FeatureCard";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="mb-3 font-(--font-mono) text-sm text-fd-muted-foreground">
        Open source rich text for Next.js
      </p>
      <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
        Blokhaus
      </h1>
      <p className="mb-8 max-w-md text-fd-muted-foreground">
        A copy-paste block editor library. You own every component, every node,
        every line of code. Built on Lexical.
      </p>
      <div className="flex gap-3">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
        >
          Get Started
        </Link>
        <Link
          href="/docs/guides/theming"
          className="rounded-md border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
        >
          Guides
        </Link>
      </div>

      <div className="mt-16 grid w-full max-w-2xl gap-3 text-left md:grid-cols-3">
        <FeatureCard
          title="Zero abstraction"
          description="Copy-paste components into your project. Nothing hidden."
        />
        <FeatureCard
          title="Block-based"
          description="Drag-and-drop blocks, slash commands, floating toolbar."
        />
        <FeatureCard
          title="AI-ready"
          description="Streaming AI preview nodes with clean undo history."
        />
      </div>
    </main>
  );
}

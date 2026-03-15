// NEXT
import Link from "next/link";

const NotFound = () => {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Page not found</h1>
      <p className="mb-8 max-w-md text-fd-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="rounded-md bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
        >
          Back to Home
        </Link>
        <Link
          href="/docs"
          className="rounded-md border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
        >
          Documentation
        </Link>
      </div>
    </main>
  );
};

export default NotFound;

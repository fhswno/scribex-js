"use client";

// TYPESCRIPT
type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

const ErrorPage = ({ reset }: Props) => {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">
        Something went wrong
      </h1>
      <p className="mb-8 max-w-md text-fd-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="cursor-pointer rounded-md bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
      >
        Try again
      </button>
    </main>
  );
};

export default ErrorPage;

"use client";

// REACT
import { useState, useCallback } from "react";

// ICONS
import { Star, Check, Copy, X } from "lucide-react";

// CLSX
import clsx from "clsx";

// SONNER
import { toast } from "sonner";

const CopyInstallButton = () => {
  // States
  const [copied, setCopied] = useState<boolean>(false);

  // Callback - Copy
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText("npm i @blokhaus/core");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast.custom(
      (t) => (
        <div className="flex w-full items-center gap-4 rounded-xl border border-fd-border bg-fd-card px-5 py-4 shadow-2xl shadow-fd-primary/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fd-primary/10">
            <Star size={20} className="text-fd-primary" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-fd-foreground">
              Copied! Thank you for trying Blokhaus
            </span>
            <span className="text-xs text-fd-muted-foreground">
              If you enjoy it, consider giving us a star on GitHub
            </span>
          </div>
          <a
            href="https://github.com/fhswno/blokhaus-js"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto shrink-0 rounded-lg border border-fd-border bg-fd-background px-4 py-2 text-xs font-medium text-fd-foreground transition-colors hover:border-fd-primary/50 hover:bg-fd-accent"
          >
            <span className="flex items-center gap-1.5">
              <Star size={12} />
              Star on GitHub
            </span>
          </a>
          <button
            onClick={() => toast.dismiss(t)}
            className="shrink-0 cursor-pointer text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ),
      { duration: 5000 },
    );
  }, []);

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-fd-border bg-fd-card px-5 py-2.5 font-(--font-mono) text-sm text-fd-muted-foreground">
      <span>npm i @blokhaus/core</span>
      <button
        className={clsx(
          "cursor-pointer transition-colors",
          copied
            ? "text-fd-primary"
            : "text-fd-muted-foreground hover:text-fd-foreground",
        )}
        onClick={handleCopy}
        aria-label="Copy install command"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
};

export default CopyInstallButton;

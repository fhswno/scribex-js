// REACT
import type { ReactNode } from "react";

// COMPONENTS
import ReadingProgress from "./ReadingProgress";
import SidebarKeybind from "./SidebarKeybind";

// FUMADOCS
import { DocsLayout } from "fumadocs-ui/layouts/docs";

// SOURCE
import { source } from "@/lib/source";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: <span className="font-medium tracking-tight">blokhaus</span>,
      }}
      links={[
        {
          text: "Playground",
          url: "https://playground.blokhaus.fhswno.com",
          external: true,
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          ),
        },
      ]}
      sidebar={{
        banner: (
          <div className="flex items-center gap-2 px-2 pb-2">
            <span className="text-sm font-medium text-fd-foreground">
              blokhaus
            </span>
            <span className="rounded border border-fd-border px-1.5 py-0.5 text-[10px] text-fd-muted-foreground">
              v0.2.0
            </span>
          </div>
        ),
        footer: (
          <div className="flex flex-col gap-3 border-t border-fd-border px-2 pt-3">
            <a
              href="https://playground.blokhaus.fhswno.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-lg border border-fd-border bg-fd-card px-3 py-2.5 transition-all hover:border-fd-primary/50 hover:shadow-md hover:shadow-fd-primary/5"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-fd-primary/10 transition-colors group-hover:bg-fd-primary/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fd-primary">
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-fd-foreground">
                  Try the Playground
                </span>
                <span className="text-[10px] text-fd-muted-foreground">
                  Live editor demo
                </span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-fd-muted-foreground transition-transform group-hover:translate-x-0.5">
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </a>
            <div className="flex items-center gap-3 text-xs text-fd-muted-foreground">
              <a
                href="https://github.com/fhswno/blokhaus-js"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-fd-foreground"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        ),
      }}
    >
      <ReadingProgress />
      <SidebarKeybind />
      {children}
    </DocsLayout>
  );
};

export default Layout;

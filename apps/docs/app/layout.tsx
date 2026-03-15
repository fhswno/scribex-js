// REACT
import type { ReactNode } from "react";

// FUMADOCS
import { RootProvider } from "fumadocs-ui/provider";

// FONTS
import { Inter, JetBrains_Mono } from "next/font/google";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

// ANALYTICS
import { Analytics } from "@vercel/analytics/react";

// TOAST
import { Toaster } from "sonner";

// GLOBALS
import "./globals.css";

// METADATA
export const metadata = {
  title: {
    template: "%s | Blokhaus",
    default: "Blokhaus — The shadcn of rich text editors",
  },
  description:
    "A fully open-source, block-based Notion-style editor library built for Next.js.",
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${inter.className}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ defaultTheme: "dark" }}>{children}</RootProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            className:
              "border-fd-border bg-fd-card text-fd-foreground shadow-2xl",
          }}
        />
        <Analytics />
      </body>
    </html>
  );
};

export default RootLayout;

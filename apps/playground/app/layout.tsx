// NEXT
import type { Metadata } from "next";

// GLOBALS
import "./globals.css";

// METADATA
export const metadata: Metadata = {
  title: "Scribex Playground",
  description: "Reference implementation of the Scribex editor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

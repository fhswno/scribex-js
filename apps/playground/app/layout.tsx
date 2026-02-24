// NEXT
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

// GLOBALS
import "./globals.css";

// FONTS
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased font-sans min-h-screen bg-white text-neutral-900">
        {children}
      </body>
    </html>
  );
}

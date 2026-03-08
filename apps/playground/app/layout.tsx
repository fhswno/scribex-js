// NEXT
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Lora, Caveat } from "next/font/google";

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

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

// METADATA
export const metadata: Metadata = {
  title: "Blokhaus Playground",
  description: "Reference implementation of the Blokhaus editor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${lora.variable} ${caveat.variable}`} suppressHydrationWarning>
      <body className="antialiased font-sans min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors">
        {children}
      </body>
    </html>
  );
}

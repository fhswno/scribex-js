// TSUP
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "lexical",
    "next",
    "@lexical/react",
    "@lexical/rich-text",
    "@lexical/history",
    "@lexical/html",
    "@lexical/link",
    "@lexical/list",
    "@lexical/selection",
    "@lexical/table",
    "@lexical/utils",
    "@radix-ui/react-popover",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-toast",
    "@phosphor-icons/react",
    "shiki",
  ],
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.banner = { js: '"use client";' };
  },
});

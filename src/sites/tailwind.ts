import { readFileSync, statSync } from "node:fs";

// The Tailwind CSS of the clinic sites, built by `npm run sites:css` from
// src/sites/tailwind.css (part of `npm run build`). render.tsx inlines it in
// every page. In production it's read once; while developing it's read again
// whenever the file changes (`npm run sites:dev` keeps rebuilding it).

const file = new URL("../../sites-assets/generated/sites.css", import.meta.url);
const production = process.env.NODE_ENV === "production";

let cached: { mtime: number; css: string } | null = null;
let warned = false;

export function tailwindCss(): string {
  try {
    if (cached && production) return cached.css;
    const mtime = statSync(file).mtimeMs;
    if (!cached || cached.mtime !== mtime) cached = { mtime, css: readFileSync(file, "utf8") };
    return cached.css;
  } catch {
    // Without it the templates still work (their own CSS); classes from
    // Tailwind just do nothing. Say it once
    if (!warned) {
      console.warn("[sites] sites-assets/generated/sites.css not found: run `npm run sites:css`");
      warned = true;
    }
    return "";
  }
}

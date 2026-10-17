import type { Lang } from "./hreflang";
import { en } from "./strings/en";
import { he } from "./strings/he";
import { es } from "./strings/es";
import { fr } from "./strings/fr";
import { ar } from "./strings/ar";

// All five languages in one record. For BUILD-TIME tools only (the prerender in
// vite.config.ts, scripts/split-articles.mjs): importing this from app code would
// put every language back into one chunk. The app loads a single language
// through src/lib/strings/load.ts.
export type { Dict } from "./strings/en";
export const strings: Record<Lang, import("./strings/en").Dict> = { en, he, es, fr, ar };

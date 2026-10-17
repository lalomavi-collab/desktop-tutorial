// The FAQ sets that need nothing beyond the passed Dict: the home page and the
// practice hub. Kept apart from pageFaqs.ts because that module also pulls in
// faq.ts and pillars.ts (about 300KB of copy), and the home page, which is in the
// entry bundle, only ever asks for these two. Importing the full module from Home
// put all of that on every first visit.

import type { Dict } from "./strings";
import type { QA } from "./schema";

// The general homepage FAQ (rendered in the Home FAQ section).
function homeFaqs(t: Dict): QA[] {
  return t.data.faqs.map((f) => ({ q: f.q, a: f.a }));
}

// The practice-area FAQ (rendered by <PracticeFaq/> on Advisory only).
function practiceFaqs(t: Dict): QA[] {
  return t.practice.faq.cats.flatMap((c) => c.items.map((it) => ({ q: it.q, a: it.a })));
}

/** The sets that need only the Dict, or undefined for any other path. */
export function coreFaqsForPath(t: Dict, path: string): QA[] | undefined {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === "/") return homeFaqs(t);
  if (clean === "/advisory") return practiceFaqs(t);
  return undefined;
}

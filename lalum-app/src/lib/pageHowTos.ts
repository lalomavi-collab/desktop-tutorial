// Central per-page HowTo mapping. Each route resolves to the ordered, user
// performed steps that are actually shown on that page, so the HowTo JSON-LD
// matches visible content. Content is read from the existing bilingual sources,
// never duplicated, so the schema stays in sync with the copy on screen.
//
// HowTo is used ONLY where the page presents a real step sequence a user follows
// (the quick-start guide, the mediation path). Descriptive "modules", "phases",
// or "stages" are intentionally NOT forced into HowTo, which would be invalid.

import type { Dict } from "./strings";
import { howToNode } from "./schema";

// Resolve the HowTo node for `path`, or null when the page has no step sequence.
export function howToForPath(t: Dict, path: string): object | null {
  const clean = path.replace(/\/+$/, "") || "/";

  // Home: the five-step quick-start guide for the client area.
  if (clean === "/") {
    return howToNode(
      t.ui.guide.title,
      t.ui.guide.steps.map((s) => ({ name: s.title, text: s.body }))
    );
  }

  // Advisory: the Decision-Oriented Mediation path, dispute to binding outcome.
  if (clean === "/advisory") {
    return howToNode(
      t.advisory.mediationH2,
      t.data.domModules.map((m) => ({ name: m.title, text: m.body }))
    );
  }

  // Book: the three-step flow to request a consultation slot, from the labels
  // shown on the page (t.ui.bookPage). Each carries a "1 · " ordinal prefix for
  // the UI, stripped here.
  if (clean === "/book") {
    const b = t.ui.bookPage;
    const strip = (s: string) => s.replace(/^\s*\d+\s*·\s*/, "").trim();
    return howToNode(b.title, [
      { name: strip(b.step1), text: strip(b.step1) },
      { name: strip(b.step2), text: strip(b.step2) },
      { name: strip(b.topic), text: strip(b.topic) },
    ]);
  }

  return null;
}

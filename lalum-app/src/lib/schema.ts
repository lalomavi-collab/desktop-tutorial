// Reusable schema.org node builders and a per-page composer. One place owns the
// exact JSON-LD shapes so every page emits identical, valid structured data,
// and a page can carry several types (e.g. FAQPage + HowTo) in one @graph.
//
// Node builders return a node WITHOUT "@context" (the composer adds it once).
// Each returns null when it has no usable content, so an empty section never
// produces an invalid block.
//
// References:
//   FAQPage: https://schema.org/FAQPage
//   HowTo:   https://schema.org/HowTo  (HowTo -> HowToStep)

export type QA = { q: string; a: string };
export type Step = { name: string; text: string };

// FAQPage node: mainEntity -> Question -> acceptedAnswer -> Answer. Blank pairs
// dropped, questions de-duplicated by text.
export function faqPageNode(pairs: QA[]): object | null {
  const seen = new Set<string>();
  const mainEntity = pairs
    .map((p) => ({ q: (p?.q ?? "").trim(), a: (p?.a ?? "").trim() }))
    .filter((p) => {
      if (!p.q || !p.a) return false;
      const key = p.q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p) => ({ "@type": "Question", name: p.q, acceptedAnswer: { "@type": "Answer", text: p.a } }));
  return mainEntity.length ? { "@type": "FAQPage", mainEntity } : null;
}

// HowTo node: an ordered list of HowToStep. Use ONLY for genuine, user-performed
// step sequences (not for descriptive "modules" or "phases"). Blank steps are
// dropped; returns null without a name or at least one step.
export function howToNode(name: string, steps: Step[]): object | null {
  const cleanName = (name ?? "").trim();
  const cleaned = steps
    .map((s) => ({ name: (s?.name ?? "").trim(), text: (s?.text ?? "").trim() }))
    .filter((s) => s.name || s.text);
  if (!cleanName || cleaned.length === 0) return null;
  return {
    "@type": "HowTo",
    name: cleanName,
    step: cleaned.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      ...(s.name ? { name: s.name } : {}),
      text: s.text || s.name,
    })),
  };
}

// Compose a page's JSON-LD from its nodes. Drops nulls, returns null when the
// page has none, a single node (with @context) when it has one, or an @graph
// when it has several, so one page can carry FAQPage + HowTo together.
export function pageJsonLd(nodes: Array<object | null>): object | null {
  const real = nodes.filter((n): n is object => Boolean(n));
  if (real.length === 0) return null;
  if (real.length === 1) return { "@context": "https://schema.org", ...real[0] };
  return { "@context": "https://schema.org", "@graph": real };
}

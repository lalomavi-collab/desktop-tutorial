// Reusable schema.org FAQPage builder. One place owns the exact JSON-LD shape
// Google documents for FAQ rich results, so every page emits identical, valid
// structured data instead of hand-rolling the object per page.
//
// Shape (see https://schema.org/FAQPage and Google's Rich Results guidance):
//   { "@context": "https://schema.org", "@type": "FAQPage",
//     "mainEntity": [
//       { "@type": "Question", "name": <q>,
//         "acceptedAnswer": { "@type": "Answer", "text": <a> } }, ... ] }

export type QA = { q: string; a: string };

// Build a FAQPage object from the Q&A that is visible on a page. Returns null
// when there is no usable content, so a page with no FAQ never emits an empty
// (and therefore invalid) FAQPage block. Blank questions or answers are dropped,
// and questions are de-duplicated by text so the same Question never appears
// twice in one page's mainEntity.
export function buildFaqPage(pairs: QA[]): object | null {
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
    .map((p) => ({
      "@type": "Question",
      name: p.q,
      acceptedAnswer: { "@type": "Answer", text: p.a },
    }));

  if (mainEntity.length === 0) return null;
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity };
}

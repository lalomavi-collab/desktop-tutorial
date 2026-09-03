// Which articles to offer at the foot of an article.
//
// The list used to be the first three entries of the corpus, minus the current
// piece. Every one of the 152 articles therefore linked to the same three, and
// the other 149 received no internal link from anywhere except the flat
// /insights index. For a reader that is a non sequitur (a piece on urban
// renewal ending with three pieces on AI liability); for a crawler it is 151
// links pointing at three URLs and nothing pointing at the rest, which is the
// opposite of what internal linking is for.
//
// So the neighbours are chosen by what the pieces are actually about. Titles
// and standfirsts are tokenised, each token weighted by how rare it is across
// the corpus (a word in four articles says far more about a pair than a word
// in ninety), and the best-scoring neighbours win. Ties fall back to corpus
// order, so the result is stable between the runtime and the build.

import { blogMeta } from "./blogMeta";
import articleIndex from "../data/articleIndex.json";
import { blocksToText } from "./articleBlocks";
import type { ArticleBlock } from "./content";
import type { Dict } from "./strings";

export type RelatedSource = { slug: string; title: string; text?: string };

// The corpus both the rendered article and the prerendered one score against,
// so the three links a reader sees and the three a crawler reads are the same
// three. Full bodies, not standfirsts: on titles alone the piece comparing
// תמ״א 38/1 with 38/2 had no urban-renewal neighbour to match, because the
// other pieces on the subject name it in different words, and it ended up
// beside an article on AI risk frameworks.
//
// Memoised per dictionary, which also keeps the array identity stable so the
// tokenising below is done once rather than on every render.
// The opening of a piece, not all of it. An article states its subject in its
// first paragraphs; the rest adds length, and length is what makes a long piece
// share a few tokens with everything and turn into a false neighbour for all of
// them. It also keeps this off the critical path of an article render: the
// whole corpus is tokenised once, and a quarter of the text is a quarter of the
// work.
function lead(text: string, chars = 1500): string {
  return text.length <= chars ? text : text.slice(0, chars);
}

// The scoring corpus, with the opening of every body in it. This is the
// expensive form and it is why a content page used to download all 169 bodies.
// It is now built once, in scripts/split-articles.mjs, which scores every pair
// and writes the three neighbours per article to src/data/articleIndex.json.
// Nothing in the app or in the build calls it.
export function scoringCorpus(dict: Dict, posts: { slug: string; title: string; excerpt: string; body: string }[]): RelatedSource[] {
  return [
    ...dict.data.articles.map((a) => ({ slug: a.slug, title: a.title, text: `${a.dek} ${lead(blocksToText(a.blocks as ArticleBlock[]))}` })),
    ...posts.map((p) => ({ slug: p.slug, title: p.title, text: `${p.excerpt} ${lead(p.body)}` })),
  ];
}

// The corpus the pages use: slug and title only, in the same order, which is
// all that is needed once the neighbours are known.
const corpora = new WeakMap<object, RelatedSource[]>();
export function articleCorpus(dict: Dict): RelatedSource[] {
  let c = corpora.get(dict);
  if (!c) {
    c = [
      ...dict.data.articles.map((a) => ({ slug: a.slug, title: a.title })),
      ...blogMeta.map((m) => ({ slug: m.slug, title: m.title })),
    ];
    corpora.set(dict, c);
  }
  return c;
}

// Function words and words so common here (משפטי, LALUM) that they say nothing
// about which two pieces belong together. Rare-word weighting already discounts
// them; dropping them outright keeps short titles from matching on filler.
const STOP = new Set([
  "של", "על", "עם", "את", "מה", "למה", "איך", "כיצד", "מתי", "האם", "אשר",
  "הוא", "היא", "הם", "הן", "זה", "זו", "אלה", "כל", "לא", "אם", "אבל", "או",
  "גם", "כמו", "בין", "יותר", "רק", "כדי", "אחרי", "לפני", "תוך", "מול",
  "יש", "אין", "היה", "הייתה", "להיות", "עוד", "כבר", "אצל", "בלי", "עד",
  "the", "and", "for", "with", "that", "this", "from", "are", "was", "what",
  "how", "why", "when", "your", "you", "our", "not", "but", "all", "can",
  "lalum",
]);

function tokens(s: string): Set<string> {
  const out = new Set<string>();
  // Gershayim stay inside the word. Splitting on them turned תמ״א into תמ, and
  // an article on תמ״א 38 then had no distinctive token left to match on, so it
  // was paired with whatever shared its filler words.
  for (const piece of s.toLowerCase().split(/[^\p{L}\p{N}"'\u05f3\u05f4]+/u)) {
    const raw = piece.replace(/^["'\u05f3\u05f4]+|["'\u05f3\u05f4]+$/g, "");
    // Hebrew inflects by prefix, so "בגישור", "לגישור" and "גישור" are three
    // spellings of one topic. Stripping a single leading particle catches most
    // of that without a morphological analyser, and a token is kept in both
    // forms so a stripped match and a literal match both land.
    if (raw.length < 3 || STOP.has(raw)) continue;
    out.add(raw);
    const bare = raw.replace(/^[הבלכמושו]/, "");
    if (bare.length >= 3 && !STOP.has(bare)) out.add(bare);
  }
  return out;
}

// Rarity weight. A token in one article scores highest, a token in most of the
// corpus scores near zero, which is what keeps "משפטי" from pairing everything
// with everything.
function weights(docs: Set<string>[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d) df.set(t, (df.get(t) ?? 0) + 1);
  const w = new Map<string, number>();
  for (const [t, n] of df) w.set(t, Math.log(docs.length / n));
  return w;
}

// Tokenising 152 full article bodies is not something to redo per lookup: the
// build asks for every article's neighbours in a row, and the corpus is the
// same array each time. Keyed by that array, so a different corpus is analysed
// afresh and nothing is held alive once the caller drops it.
const analysed = new WeakMap<RelatedSource[], { docs: Set<string>[]; w: Map<string, number> }>();
function analyse(corpus: RelatedSource[]) {
  let a = analysed.get(corpus);
  if (!a) {
    const docs = corpus.map((x) => tokens(`${x.title} ${x.text ?? ""}`));
    a = { docs, w: weights(docs) };
    analysed.set(corpus, a);
  }
  return a;
}

// The scoring itself, over a corpus that carries text. Called once by the
// generator; the pages read its result instead of recomputing it.
export function scoreRelated(slug: string, corpus: RelatedSource[], limit = 3): RelatedSource[] {
  const { docs, w } = analyse(corpus);
  const i = corpus.findIndex((a) => a.slug === slug);
  if (i < 0) return corpus.filter((a) => a.slug !== slug).slice(0, limit);

  const mine = docs[i];
  const scored = corpus.map((a, j) => {
    if (j === i) return { a, score: -1, j };
    let score = 0;
    for (const t of docs[j]) if (mine.has(t)) score += w.get(t) ?? 0;
    // Longer documents share more tokens with everything, so divide out their
    // length: what counts is the share of a piece that overlaps, not the count.
    const norm = Math.sqrt(mine.size * docs[j].size) || 1;
    return { a, score: score / norm, j };
  });

  // Corpus order breaks ties, so the runtime list and the prerendered list are
  // the same list.
  scored.sort((x, y) => (y.score - x.score) || (x.j - y.j));
  return scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.a);
}

// The three neighbours of an article, read from the precomputed index. Falls
// back to corpus order for an article the index does not know, which is what
// the scoring did for an unknown slug, so a newly written piece still ends with
// three links while the index is regenerated.
export function relatedTo(slug: string, corpus: RelatedSource[], limit = 3): RelatedSource[] {
  const entry = (articleIndex as Record<string, { related: string[] }>)[slug];
  if (!entry) return corpus.filter((a) => a.slug !== slug).slice(0, limit);
  const bySlug = new Map(corpus.map((a) => [a.slug, a] as const));
  return entry.related.map((s) => bySlug.get(s)).filter((a): a is RelatedSource => Boolean(a)).slice(0, limit);
}

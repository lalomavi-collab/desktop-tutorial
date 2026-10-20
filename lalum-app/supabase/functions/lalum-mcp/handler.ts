// lalum-mcp handler: a Model Context Protocol server over Streamable HTTP, kept
// free of Deno globals so scripts/mcp-check.mjs can exercise it under Node.
//
// It is stateless on purpose: every POST is one JSON-RPC message (or a batch),
// answered with one JSON body. No session, no SSE stream, nothing to keep warm
// between invocations of an edge function.
//
// It serves public content only: the articles and the verified case law that
// lalumapp.com already shows to any visitor. There is no sign-in and no client
// data behind it, which is why it needs no credential from the connector.

import { ARTICLES, CASES } from "./content.data.ts";

const SERVER = { name: "lalum", title: "LALUM", version: "1.0.0" };
const LATEST = "2025-06-18";
const SUPPORTED = [LATEST, "2025-03-26", "2024-11-05"];
const MAX_BODY_BYTES = 64 * 1024;
const MAX_LIMIT = 20;

const INSTRUCTIONS =
  "Public content of LALUM, the practice of Dr. Avraham Lalum, Adv. (Hebrew: ד״ר עו״ד אברהם ללום), across two areas: real estate and urban renewal in Israel and abroad, and AI. " +
  "Tools search and read the published articles and the verified case law database. Content is in Hebrew. " +
  "Answer only from what a tool returns, and say so when the database has no match instead of supplying a ruling or a citation from memory. " +
  "This is general information and not legal advice.";

const DISCLAIMER = "מידע כללי ואינו ייעוץ משפטי. LALUM, ד״ר עו״ד אברהם ללום.";

// Same folding the site search uses (src/lib/hebrewSearch.ts): lowercase, no
// niqqud, final letters folded to base form, punctuation and the three Hebrew
// quote characters turned into spaces, so "בג״ץ" and "בגץ" match each other.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ךםןףץ]/g, (c) => ({ "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" }[c] as string))
    .replace(/["'`׳״.,;:!?()[\]{}<>/\\|_+=~@#$%^&*־–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Every query token must appear (AND). A hit in the title outweighs one in the
// standfirst, which outweighs one in the body. Zero means the record is out.
function score(query: string, fields: { title: string; mid: string; body: string }): number {
  const toks = norm(query).split(" ").filter(Boolean);
  if (!toks.length) return 0;
  const title = norm(fields.title);
  const mid = norm(fields.mid);
  const body = norm(fields.body);
  let total = 0;
  for (const t of toks) {
    if (title.includes(t)) total += title.startsWith(t) ? 12 : 8;
    else if (mid.includes(t)) total += 4;
    else if (body.includes(t)) total += 2;
    else return 0;
  }
  return total;
}

const clampLimit = (v: unknown, dflt: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : dflt;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
};

const TOPIC_NAMES: Record<string, string> = {
  "real-estate": "נדל״ן והתחדשות עירונית, בארץ ובחו״ל",
  "ai-governance": "בינה מלאכותית וממשל סיכונים",
  contracts: "חוזים, חברות וקניין רוחני",
  mediation: "גישור ויישוב סכסוכים",
};

type Json = Record<string, unknown>;
type ToolResult = { content: { type: "text"; text: string }[]; structuredContent?: Json; isError?: boolean };

const text = (t: string, structuredContent?: Json): ToolResult => ({
  content: [{ type: "text", text: t }],
  ...(structuredContent ? { structuredContent } : {}),
});
const fail = (t: string): ToolResult => ({ content: [{ type: "text", text: t }], isError: true });

const TOOLS = [
  {
    name: "search_articles",
    title: "Search LALUM articles",
    description:
      "Search the published LALUM articles (Hebrew) by keywords. Every keyword must appear. Optionally restrict to one topic. Returns slug, title, excerpt, date, topic and URL, best match first. Use get_article for the full text.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords, in Hebrew or English." },
        topic: { type: "string", enum: Object.keys(TOPIC_NAMES), description: "Optional topic filter. See list_topics." },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, description: "Maximum results, default 8." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_article",
    title: "Read a LALUM article",
    description: "Return the full text of one published article by its slug (from search_articles).",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "The article slug." } },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  {
    name: "list_topics",
    title: "List article topics",
    description: "List the article topics with the number of articles in each.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_rulings",
    title: "Search verified case law",
    description:
      "Search LALUM's verified Israeli case law database by keywords, a citation or a docket number. Returns only rulings whose citation, court and date were checked against the instrument. If nothing matches, the database does not hold the ruling: do not supply one from memory.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords, party names, a citation, or a docket number." },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, description: "Maximum results, default 8." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_ruling",
    title: "Read a verified ruling",
    description: "Return the full record of one verified ruling by its citation (from search_rulings): facts, issue, holding and implications.",
    inputSchema: {
      type: "object",
      properties: { citation: { type: "string", description: "The citation exactly as search_rulings returned it." } },
      required: ["citation"],
      additionalProperties: false,
    },
  },
].map((t) => ({ ...t, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }));

function callTool(name: string, args: Json): ToolResult {
  switch (name) {
    case "search_articles": {
      const q = typeof args.query === "string" ? args.query : "";
      if (!norm(q)) return fail("query is required.");
      const topic = typeof args.topic === "string" ? args.topic : null;
      if (topic && !(topic in TOPIC_NAMES)) return fail(`Unknown topic. Use one of: ${Object.keys(TOPIC_NAMES).join(", ")}.`);
      const hits = ARTICLES.filter((a) => !topic || a.topic === topic)
        .map((a) => ({ a, s: score(q, { title: a.title, mid: a.excerpt, body: a.body }) }))
        .filter((x) => x.s > 0)
        .sort((x, y) => y.s - x.s)
        .slice(0, clampLimit(args.limit, 8))
        .map(({ a }) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, date: a.date, topic: a.topic, url: a.url }));
      if (!hits.length) return text("No article matches. The site has no published article on this wording.", { results: [] });
      return text(JSON.stringify(hits, null, 2), { results: hits });
    }
    case "get_article": {
      const slug = typeof args.slug === "string" ? args.slug : "";
      const a = ARTICLES.find((x) => x.slug === slug);
      if (!a) return fail("No article with this slug. Use search_articles to find one.");
      return text(`# ${a.title}\n\n${a.date}\n${a.url}\n\n${a.body}\n\n${DISCLAIMER}`, {
        slug: a.slug, title: a.title, date: a.date, topic: a.topic, url: a.url,
      });
    }
    case "list_topics": {
      const topics = Object.entries(TOPIC_NAMES).map(([slug, name]) => ({
        slug, name, articles: ARTICLES.filter((a) => a.topic === slug).length,
      }));
      return text(JSON.stringify(topics, null, 2), { topics });
    }
    case "search_rulings": {
      const q = typeof args.query === "string" ? args.query : "";
      if (!norm(q)) return fail("query is required.");
      // A query that is itself a citation or docket number is answered by that
      // record alone: its common tokens (a year, a month) would otherwise drag
      // in unrelated rulings that merely mention the same digits.
      const exact = CASES.filter((c) => norm(c.citation).includes(norm(q)));
      const hits = (exact.length ? exact : CASES).map((c) => ({
        c,
        s: score(q, {
          title: `${c.citation} ${c.caption}`,
          mid: `${c.court} ${c.tags.join(" ")} ${c.issue}`,
          body: `${c.facts} ${c.holding} ${c.implications}`,
        }),
      }))
        .filter((x) => x.s > 0)
        .sort((x, y) => y.s - x.s)
        .slice(0, clampLimit(args.limit, 8))
        .map(({ c }) => ({ citation: c.citation, caption: c.caption, court: c.court, date: c.date, issue: c.issue }));
      if (!hits.length) return text("No verified ruling matches. The database does not hold it. Do not cite one from memory.", { results: [] });
      return text(JSON.stringify(hits, null, 2), { results: hits });
    }
    case "get_ruling": {
      const citation = typeof args.citation === "string" ? args.citation : "";
      const c = CASES.find((x) => norm(x.citation) === norm(citation));
      if (!c || !norm(citation)) return fail("No verified ruling with this citation. Use search_rulings to find one.");
      const lines = [
        `# ${c.citation}: ${c.caption}`,
        `${c.court}, ${c.date}`,
        `\n## Facts\n${c.facts}`,
        `\n## Issue\n${c.issue}`,
        `\n## Holding\n${c.holding}`,
        `\n## Implications\n${c.implications}`,
        ...(c.article ? [`\nRelated article: ${c.article}`] : []),
        `\n${DISCLAIMER}`,
      ];
      return text(lines.join("\n"), { citation: c.citation, caption: c.caption, court: c.court, date: c.date });
    }
    default:
      return fail(`Unknown tool: ${name}`);
  }
}

const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

// One JSON-RPC message in, one response out. Returns null for a notification,
// which the transport answers with 202 and no body.
function dispatch(msg: unknown): Json | null {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return rpcError(null, -32600, "Invalid Request");
  const m = msg as { jsonrpc?: string; id?: unknown; method?: unknown; params?: Json };
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") {
    // A response from the client to a server request; we send none, so ignore.
    return "result" in m || "error" in m ? null : rpcError(m.id, -32600, "Invalid Request");
  }
  const isNotification = m.id === undefined;
  const reply = (result: Json) => (isNotification ? null : { jsonrpc: "2.0", id: m.id, result });

  switch (m.method) {
    case "initialize": {
      const asked = typeof m.params?.protocolVersion === "string" ? m.params.protocolVersion : "";
      return reply({
        protocolVersion: SUPPORTED.includes(asked) ? asked : LATEST,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = m.params?.name;
      if (typeof name !== "string" || !TOOLS.some((t) => t.name === name)) {
        return isNotification ? null : rpcError(m.id, -32602, "Unknown tool");
      }
      const args = m.params?.arguments;
      return reply(callTool(name, args && typeof args === "object" && !Array.isArray(args) ? (args as Json) : {}) as unknown as Json);
    }
    default:
      if (m.method.startsWith("notifications/")) return null;
      return isNotification ? null : rpcError(m.id, -32601, `Method not found: ${m.method}`);
  }
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, authorization, apikey",
  "access-control-expose-headers": "mcp-session-id",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  // No server initiated stream and no sessions: GET and DELETE are refused as
  // the Streamable HTTP transport allows.
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...CORS, allow: "POST, OPTIONS" } });

  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(413, rpcError(null, -32600, "Request too large"));
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, rpcError(null, -32700, "Parse error"));
  }

  if (Array.isArray(parsed)) {
    if (!parsed.length) return json(400, rpcError(null, -32600, "Empty batch"));
    const out = parsed.map(dispatch).filter((r): r is Json => r !== null);
    return out.length ? json(200, out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = dispatch(parsed);
  return out ? json(200, out) : new Response(null, { status: 202, headers: CORS });
}

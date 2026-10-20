// Checks the lalum-mcp handler speaks MCP correctly and serves only what the
// site publishes. Runs the real handler under Node, no Deno needed.
//
// Usage: node scripts/mcp-check.mjs

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { handleRequest } = await import(pathToFileURL(join(root, "supabase/functions/lalum-mcp/handler.ts")).href);

let failed = 0;
const ok = (cond, msg) => {
  if (cond) return console.log(`[OK] ${msg}`);
  failed++;
  console.error(`[FAIL] ${msg}`);
};

const post = (body, method = "POST") =>
  handleRequest(new Request("https://x.test/lalum-mcp", { method, headers: { "content-type": "application/json" }, body: method === "POST" ? JSON.stringify(body) : undefined }));
const rpc = async (method, params, id = 1) => (await post({ jsonrpc: "2.0", id, method, params })).json();
const call = async (name, args) => (await rpc("tools/call", { name, arguments: args })).result;

try {
  execFileSync("node", [join(root, "scripts/sync-mcp-content.mjs"), "--check"], { stdio: "inherit" });
  ok(true, "content.data.ts is in step with the site corpus");
} catch {
  ok(false, "content.data.ts is stale");
}

// Handshake
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
ok(init.result?.protocolVersion === "2025-06-18" && init.result.capabilities.tools, "initialize negotiates the version and declares tools");
const old = await rpc("initialize", { protocolVersion: "2024-11-05" });
ok(old.result?.protocolVersion === "2024-11-05", "initialize echoes an older supported version");
const unknownVer = await rpc("initialize", { protocolVersion: "1999-01-01" });
ok(unknownVer.result?.protocolVersion === "2025-06-18", "initialize falls back to the latest for an unknown version");
const note = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
ok(note.status === 202, "a notification is answered 202 with no body");
ok((await rpc("ping")).result && Object.keys((await rpc("ping")).result).length === 0, "ping returns an empty result");

// Transport edges
ok((await post(null, "GET")).status === 405, "GET is refused with 405");
ok((await post(null, "OPTIONS")).status === 204, "OPTIONS answers CORS preflight");
const bad = await handleRequest(new Request("https://x.test", { method: "POST", body: "{nope" }));
ok(bad.status === 400 && (await bad.json()).error.code === -32700, "malformed JSON gives -32700");
const big = await handleRequest(new Request("https://x.test", { method: "POST", body: "x".repeat(70 * 1024) }));
ok(big.status === 413, "an oversized body is refused");
ok((await rpc("nope/nope")).error?.code === -32601, "unknown method gives -32601");
const batch = await (await post([{ jsonrpc: "2.0", id: 1, method: "ping" }, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "tools/list" }])).json();
ok(Array.isArray(batch) && batch.length === 2, "a batch answers requests and skips notifications");

// Tools
const tools = (await rpc("tools/list")).result.tools;
ok(tools.length === 5 && tools.every((t) => t.annotations.readOnlyHint === true && t.inputSchema.type === "object"), "five tools, all read only, all with an input schema");
ok(tools.every((t) => !/[—–]/.test(t.description)), "tool descriptions carry no dashes as punctuation");

const topics = (await call("list_topics", {})).structuredContent.topics;
ok(topics.length === 4 && topics.reduce((n, t) => n + t.articles, 0) > 200, "list_topics counts the articles by topic");

const found = await call("search_articles", { query: "פינוי בינוי", limit: 3 });
ok(found.structuredContent.results.length > 0 && found.structuredContent.results.length <= 3, "search_articles finds Hebrew articles and honours the limit");
ok(found.structuredContent.results.every((r) => r.url.startsWith("https://lalumapp.com/insights/")), "every result links to the live site");
const slug = found.structuredContent.results[0].slug;
const art = await call("get_article", { slug });
ok(!art.isError && art.content[0].text.includes("אינו ייעוץ משפטי"), "get_article returns the full text with the disclaimer");
ok((await call("get_article", { slug: "no-such-slug" })).isError === true, "get_article on an unknown slug is a tool error");
ok((await call("search_articles", { query: "zzzzqqqq" })).structuredContent.results.length === 0, "search_articles says so when nothing matches");
ok((await call("search_articles", { query: "" })).isError === true, "an empty query is a tool error");
ok((await call("search_articles", { query: "AI", topic: "nope" })).isError === true, "an unknown topic is a tool error");
ok((await call("search_articles", { query: "בינה מלאכותית", limit: 999 })).structuredContent.results.length <= 20, "limit is capped");

const rul = await call("search_rulings", { query: "בר״ם 37942-05-25" });
ok(rul.structuredContent.results.length === 1, "search_rulings finds a ruling by a docket number written with Hebrew quotes");
const rec = await call("get_ruling", { citation: rul.structuredContent.results[0].citation });
ok(!rec.isError && rec.content[0].text.includes("## Holding"), "get_ruling returns facts, issue and holding");
ok((await call("get_ruling", { citation: "בג״ץ 1/1" })).isError === true, "get_ruling does not invent a ruling that is not in the database");
const none = await call("search_rulings", { query: "zzzzqqqq" });
ok(none.structuredContent.results.length === 0 && /Do not cite/.test(none.content[0].text), "an empty ruling search tells the model not to cite from memory");

ok((await rpc("tools/call", { name: "delete_everything", arguments: {} })).error?.code === -32602, "an unknown tool is a protocol error");

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall MCP checks passed");

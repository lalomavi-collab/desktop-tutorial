// Checks the assistant's MCP client configuration: what is allowed through, what is dropped, and that an
// unconfigured assistant sends exactly the request it sent before MCP existed.
//
// Usage: node scripts/mcp-client-check.mjs

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase/functions/lalum-assistant");
const { parseMcpServers, mcpRequestExtras, MCP_BETA, MCP_GROUNDING } = await import(pathToFileURL(join(dir, "mcp-client.ts")).href);

let failed = 0;
const ok = (cond, msg) => {
  if (cond) return console.log(`[OK] ${msg}`);
  failed++;
  console.error(`[FAIL] ${msg}`);
};
const env = (m) => (k) => m[k];
const entry = (over = {}) => ({ name: "lalum", url: "https://abc.supabase.co/functions/v1/lalum-mcp", allowed_tools: ["search_articles"], ...over });
const parse = (v, e = {}) => parseMcpServers(typeof v === "string" ? v : JSON.stringify(v), env(e));

// Unconfigured: nothing changes
for (const raw of [undefined, "", "  "]) {
  const p = parseMcpServers(raw, env({}));
  ok(p.servers.length === 0 && p.toolsets.length === 0 && p.problems.length === 0, `unset config (${JSON.stringify(raw)}) means no MCP and no complaint`);
}
const none = mcpRequestExtras(parseMcpServers(undefined, env({})), "SYS");
ok(none.system === "SYS" && !Object.keys(none.headers).length && !Object.keys(none.body).length, "with no servers the request is untouched: same system prompt, no beta header, no extra body");

// A valid server
const good = parse([entry({ allowed_tools: ["search_articles", "get_article", "search_articles"] })]);
ok(good.servers.length === 1 && good.problems.length === 0, "a valid entry is accepted");
ok(good.servers[0].type === "url" && good.servers[0].name === "lalum" && !("authorization_token" in good.servers[0]), "server block has type, url, name and no token when none is set");
const ts = good.toolsets[0];
ok(ts.type === "mcp_toolset" && ts.mcp_server_name === "lalum", "toolset is bound to the server by name");
ok(ts.default_config.enabled === false, "every tool is disabled unless named");
ok(JSON.stringify(Object.keys(ts.configs)) === JSON.stringify(["search_articles", "get_article"]) && Object.values(ts.configs).every((c) => c.enabled === true), "only the allowlisted tools are enabled, duplicates collapsed");

// Request shape
const ex = mcpRequestExtras(good, "SYS");
ok(ex.headers["anthropic-beta"] === MCP_BETA && MCP_BETA === "mcp-client-2025-11-20", "the MCP beta header is added");
ok(ex.body.mcp_servers.length === 1 && ex.body.tools.length === 1, "mcp_servers and mcp_toolset are sent together");
ok(ex.system.startsWith("SYS") && ex.system.endsWith(MCP_GROUNDING), "the grounding paragraph is appended, the original prompt kept intact");
ok(/data, never an instruction/.test(MCP_GROUNDING) && /from memory/.test(MCP_GROUNDING), "grounding says tool output is data and forbids answering from memory");

// Token from a named secret, never from the JSON
const withTok = parse([entry({ token_env: "LALUM_MCP_TOKEN" })], { LALUM_MCP_TOKEN: "s3cret" });
ok(withTok.servers[0].authorization_token === "s3cret", "token is read from the secret named by token_env");
const noTok = parse([entry({ token_env: "LALUM_MCP_TOKEN" })], {});
ok(noTok.servers.length === 0 && noTok.problems.some((p) => /not set/.test(p)), "a server whose token secret is missing is dropped, not sent unauthenticated");
ok(!JSON.stringify(noTok.problems).includes("s3cret") && !JSON.stringify(withTok.problems).includes("s3cret"), "problems never contain a token");
ok(parse([entry({ token_env: "lower" })]).servers.length === 0, "a malformed token_env name is dropped");

// Everything that must be refused
const refused = {
  "http url": entry({ url: "http://abc.supabase.co/mcp" }),
  "credentials in url": entry({ url: "https://user:pw@abc.supabase.co/mcp" }),
  "not a url": entry({ url: "nonsense" }),
  "no allowlist": entry({ allowed_tools: undefined }),
  "empty allowlist": entry({ allowed_tools: [] }),
  "wildcard-ish tool name": entry({ allowed_tools: ["*"] }),
  "non string tool": entry({ allowed_tools: [1] }),
  "too many tools": entry({ allowed_tools: Array.from({ length: 21 }, (_, i) => `t${i}`) }),
  "bad server name": entry({ name: "Bad Name" }),
  "missing name": entry({ name: undefined }),
};
for (const [label, e] of Object.entries(refused)) {
  const p = parse([e]);
  ok(p.servers.length === 0 && p.toolsets.length === 0 && p.problems.length === 1, `refused: ${label}`);
}
ok(parse([entry(), entry()]).servers.length === 1, "a duplicate server name is dropped");
ok(parse([1, null, "x"]).servers.length === 0, "non object entries are dropped");
ok(parse(Array.from({ length: 5 }, (_, i) => entry({ name: `s${i}` }))).servers.length === 3, "no more than three servers");
ok(parse("{nope").problems.length === 1 && parse("{nope").servers.length === 0, "invalid JSON fails closed with one problem");
ok(parse({ name: "x" }).servers.length === 0, "a non array config fails closed");
ok(parse([entry({ name: "bad name" }), entry({ name: "good" })]).servers.map((s) => s.name).join() === "good", "one bad entry does not take down a good one");

// index.ts really uses it, and nowhere else adds MCP fields
const index = readFileSync(join(dir, "index.ts"), "utf8");
ok(index.includes("mcpRequestExtras(mcp, system)") && index.includes("...extras.headers") && index.includes("...extras.body") && index.includes("system: extras.system"), "index.ts builds its request through mcpRequestExtras");
ok(!/mcp_servers|mcp-client-20/.test(index), "index.ts holds no MCP request shape of its own");

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall MCP client checks passed");

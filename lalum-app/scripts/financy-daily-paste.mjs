// The daily paste for Financy on its free plan (migration 20261029160000): turns one morning's read of the Financy screens (Chrome,
// read only) into one SQL block the owner pastes in the Supabase SQL editor. The business account's new lines go through
// lalum_fin_bank_lines_merge as feed lines with the screen's balance, the card's lines into lalum_fin_ext_lines, and the figures
// Financy states (open card charge, limits, guarantee, dollar account) into lalum_fin_ext_facts. Every part runs again safely.
//
// Usage: node scripts/financy-daily-paste.mjs READ.json OUT.sql [--with-migration]
// READ.json: { read_on, data_through, sync_from, account: { id, last4, balance, lines: [{ date, description, amount }] },
//              card: { last4, lines: [{ date, description, category, currency, amount }] },
//              facts: [{ kind, ref, label, amount, currency, due_on, as_of }] }
// Each list must hold every line Financy shows for the days it covers: a line's key counts its occurrence within its day, so two
// identical charges on one day stay two, and a later read of the same days gives the same keys.
// The output has no blank lines, no indentation and single spaces only, because the owner's copy path turns runs of spaces into
// non-breaking ones and the editor then fails with 42601 at " ".
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIRM = "72dbb28f-b035-43fa-aa1d-a83ae9309cb2";
const MIGRATION = "supabase/migrations/20261029160000_lalum_fin_bank_hand_feed.sql";

const md5 = (s) => createHash("md5").update(s, "utf8").digest("hex");
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const day = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? "")) throw new Error(`not a date: ${s}`); return s; };
const money = (v) => { const n = Math.round(Number(v) * 100) / 100; if (!Number.isFinite(n)) throw new Error(`not an amount: ${v}`); return n; };

/** Keys as the read of 29.10 built them: kind|ref|date|amount|currency|text, then the occurrence within that. */
export function keyed(kind, ref, lines, prefix) {
  const seen = new Map();
  return [...lines].map((l, i) => ({ ...l, i })).sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i)
    .filter((l) => money(l.amount) !== 0)
    .map((l) => {
      const cur = l.currency ?? "ILS", desc = one(l.description), amt = money(l.amount);
      const k = `${kind}|${ref}|${day(l.date)}|${amt.toFixed(2)}|${cur}|${desc}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
      return { ...l, description: desc, amount: amt, currency: cur, hash: prefix + md5(`${k}|${seen.get(k)}`) };
    });
}

/** No blank lines, no indentation, single spaces; literals between single quotes are left as they are. */
export function flatten(sql) {
  const out = [];
  let inq = false;
  for (const raw of sql.split("\n")) {
    const startIn = inq;
    const line = inq ? raw : raw.replace(/^[ \t]+/, "");
    let res = "", i = 0;
    while (i < line.length) {
      const c = line[i];
      if (inq) {
        res += c;
        if (c === "'") { if (line[i + 1] === "'") { res += "'"; i += 2; continue; } inq = false; }
        i++; continue;
      }
      if (c === "-" && line.startsWith("--", i)) { res += line.slice(i).replace(/[ \t]+/g, " ").trimEnd(); break; }
      if (c === "'") { inq = true; res += c; i++; continue; }
      if (c === " " || c === "\t") {
        let j = i; while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
        if (j < line.length) res += " ";
        i = j; continue;
      }
      res += c; i++;
    }
    if (res.trim() === "" && !startIn) continue;
    out.push(res);
  }
  return out.join("\n") + "\n";
}

export function build(read, { withMigration = false, root = "." } = {}) {
  const acc = read.account, card = read.card ?? { last4: "", lines: [] };
  if (!/^[0-9a-f-]{36}$/.test(acc?.id ?? "")) throw new Error("account.id");
  const feed = keyed("current", acc.last4, acc.lines ?? [], "financy:read:");
  const cardLines = keyed("card", card.last4, card.lines ?? [], "financy-read:");
  const facts = read.facts ?? [];
  const span = (ls) => (ls.length ? `${ls[0].date}..${ls[ls.length - 1].date}` : "none");
  const json = (v) => { const s = JSON.stringify(v); if (s.includes("$j$")) throw new Error("text holds $j$"); return "$j$" + s + "$j$"; };
  const L = [];
  L.push(`-- Financy, the read of ${day(read.read_on)} (data through ${day(read.data_through)}): ${feed.length} business account lines (${span(feed)}), ` +
    `${cardLines.length} card lines (${span(cardLines)}), ${facts.length} figures. Paste all in a new SQL editor tab, Run. Expect 1 row; it runs again safely.`);
  if (withMigration) L.push(flatten(readFileSync(join(root, MIGRATION), "utf8")).trimEnd());
  L.push("begin;");
  L.push(`-- The first day the hand feed writes (set once; the statement runs to the day before).`);
  L.push(`update public.lalum_fin_bank_accounts set sync_from = ${q(day(read.sync_from))} where id = ${q(acc.id)} and sync_from is null;`);
  L.push("drop table if exists pg_temp.lalum_feed_run;");
  const lines = feed.map((l) => ({ import_hash: l.hash, value_date: l.date, amount: l.amount, description: l.description, source_file: `Financy read ${read.read_on}` }));
  const balance = acc.balance == null ? null : { as_of: day(read.data_through), balance: money(acc.balance), type: "financyScreen", currency: "ILS" };
  L.push(`create temp table lalum_feed_run as select public.lalum_fin_bank_lines_merge(${q(acc.id)}::uuid, 'financy',`);
  L.push(`${json(lines)}::jsonb,`);
  L.push(`${balance ? json(balance) + "::jsonb" : "null"}) as r;`);
  if (cardLines.length) {
    L.push("insert into public.lalum_fin_ext_lines (firm_id, account_kind, account_ref, txn_date, description, source_category, amount, currency, import_hash, read_on)");
    L.push(`select ${q(FIRM)}::uuid, 'card', ${q(card.last4)}, v.d::date, v.t, v.c, v.a, v.cur, v.h, ${q(read.read_on)}::date from (values`);
    cardLines.forEach((l, i) => L.push(`(${q(l.date)}, ${q(l.description)}, ${l.category ? q(one(l.category)) : "null"}, ${l.amount.toFixed(2)}, ${q(l.currency)}, ${q(l.hash)})${i < cardLines.length - 1 ? "," : ""}`));
    L.push(") as v(d, t, c, a, cur, h) on conflict (firm_id, import_hash) do nothing;");
  }
  if (facts.length) {
    L.push("insert into public.lalum_fin_ext_facts (firm_id, kind, account_ref, label, amount, currency, due_on, as_of) values");
    facts.forEach((f, i) => L.push(`(${q(FIRM)}, ${q(f.kind)}, ${q(f.ref)}, ${f.label ? q(one(f.label)) : "null"}, ${money(f.amount).toFixed(2)}, ${q(f.currency ?? "ILS")}, ` +
      `${f.due_on ? q(day(f.due_on)) : "null"}, ${q(day(f.as_of))})${i < facts.length - 1 ? "," : ""}`));
    L.push("on conflict (firm_id, kind, account_ref, as_of) do update set label = excluded.label, amount = excluded.amount, currency = excluded.currency, due_on = excluded.due_on;");
  }
  L.push("commit;");
  L.push("-- What went in: the feed's answer, the balance the dashboard now shows, and the card and figures as stored.");
  L.push(`select r ->> 'inserted' as new_lines, r ->> 'already' as read_before, (r ->> 'duplicates')::int + (r ->> 'near_duplicates')::int as on_statement, r ->> 'before_sync' as before_sync,`);
  L.push(`(select b.balance::text || ' on ' || b.as_of::text from public.lalum_fin_bank_balances b where b.bank_account_id = ${q(acc.id)} order by b.as_of desc, b.fetched_at desc limit 1) as balance,`);
  L.push(`(select count(*)::text || ' lines, last ' || max(txn_date)::text from public.lalum_fin_ext_lines where firm_id = ${q(FIRM)} and account_kind = 'card') as card,`);
  L.push(`(select string_agg(kind || ' ' || amount::text || coalesce(' due ' || due_on::text, ''), ', ' order by kind) from public.lalum_fin_ext_facts where firm_id = ${q(FIRM)} and as_of = ${q(read.read_on)}) as figures`);
  L.push("from lalum_feed_run;");
  const sql = flatten(L.join("\n"));
  if (/\n\n|\n[ \t]|\u00a0/.test(sql)) throw new Error("the paste has a blank line, an indent or a non-breaking space");
  if (sql.split("\n").some((l) => l.startsWith("--") && /[\u2013\u2014]| - /.test(l))) throw new Error("a comment uses a dash as punctuation");
  return sql;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [inp, out] = process.argv.slice(2);
  if (!inp || !out) { console.error("usage: node scripts/financy-daily-paste.mjs READ.json OUT.sql [--with-migration]"); process.exit(2); }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const sql = build(JSON.parse(readFileSync(inp, "utf8")), { withMigration: process.argv.includes("--with-migration"), root });
  writeFileSync(out, sql);
  console.log(`${out}: ${sql.length} bytes, ${sql.split("\n").length - 1} lines`);
}

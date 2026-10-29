// Checks the control room rules (src/lib/cockpit/controlRoomCore.ts): every tile's status on the real snapshot of 28.10.2026, and the
// rules that keep an old or unreconciled number from showing as today's. Run with: npm run control-room-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTiles, daily, parseSnapshot, stripOrder, summarize, webDays, money, SNAPSHOT_STALE_MIN } from "../src/lib/cockpit/controlRoomCore.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const NOW = new Date("2026-10-28T12:10:00Z");

// The snapshot query's answer on 28.10.2026 at 12:08 UTC (read only, before the migration), unchanged.
const REAL = {
  v: 1, db: { bytes: 56519827 },
  fin: { archive_rows: 277, bank_balance: 41369.21, import_ok_at: "2026-10-21T13:09:40.061292+00:00", bank_last_day: "2026-09-01", expenses_rows: 184,
    import_last_at: "2026-10-21T20:55:54.146321+00:00", import_last_error: 'type 1 [{"__type":"CommonError:#Invoice.Common","Error":"UnauthorizedUser","ID":80,"Paramters":null}]',
    archive_last_issue: "2026-10-21", expenses_import_key: false, proformas_open: 34, proformas_open_total: 1192301, proformas_open_old: 23 },
  sec: { users_total: 6, totp_verified: 1, users_no_firm: 4, definer_callable: 136, partners_no_totp: 0 },
  web: { paid_90d: 0, cf_last_day: "2026-10-27", gsc_last_day: "2026-10-24" },
  cron: [
    { job: "lalum-campaign-sync", active: true, last_at: "2026-10-28T11:30:00.029569+00:00", runs_24h: 2, schedule: "30 6,11 * * *", failed_24h: 0, last_ok_at: "2026-10-28T11:30:00.029569+00:00", last_status: "succeeded" },
    { job: "lalum-dispatch-worker", active: true, last_at: "2026-10-28T12:08:00.019786+00:00", runs_24h: 1440, schedule: "* * * * *", failed_24h: 0, last_ok_at: "2026-10-28T12:08:00.019786+00:00", last_status: "succeeded" },
    { job: "lalum-outlook-sync", active: true, last_at: "2026-10-28T04:15:00.028093+00:00", runs_24h: 1, schedule: "15 4 * * *", failed_24h: 0, last_ok_at: "2026-10-28T04:15:00.028093+00:00", last_status: "succeeded" },
  ],
  http: { bad: 0, since: "2026-10-28T06:09:00.03672+00:00", total: 362, timed_out: 0 },
  matters: { high: 6, live: 7, binned: 14, caution: 0, fee_terms: 0, inquiries: 1, not_assessed: 1, time_entries: 0, deadlines_14d: 0, deadlines_total: 0, deadlines_overdue: 0 },
  outlook: { held: 0, status: "ok", fetched: 52, last_at: "2026-10-28T04:15:01.815548+00:00", last_ok_at: "2026-10-28T04:15:01.815548+00:00" },
  campaign: Object.fromEntries(["gsc", "facebook", "internal", "meta_ads", "instagram", "cloudflare"].map((k) => [k, { status: "ok", last_at: "2026-10-28T11:30:07+00:00", last_ok_at: "2026-10-28T11:30:07+00:00" }])),
  cron_failed_7d: 0,
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const snap = (data, takenAt = "2026-10-28T12:08:00Z") => parseSnapshot({ taken_at: takenAt, data });
const WEB = webDays(Array.from({ length: 21 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10);
  return [{ day, source: "gsc", scope: "site", key: "", metric: "impressions", value: 100 + i }, { day, source: "gsc", scope: "site", key: "", metric: "clicks", value: 3 }];
}).flat());
const tiles = (data, extra = {}) => Object.fromEntries(buildTiles({ snapshot: snap(data), web: WEB, now: NOW, ...extra }).map((x) => [x.id, x]));

t("28.10: the real snapshot gives 4 green, 4 attention or stale, 2 blocked, 1 not connected", () => {
  const all = buildTiles({ snapshot: snap(REAL), web: WEB, now: NOW });
  const st = Object.fromEntries(all.map((x) => [x.id, x.status]));
  assert.deepEqual(st, { pnl: "stale", ar: "bad", cash: "stale", issue: "bad", sec: "watch", mat: "watch", web: "ok", camp: "ok", cron: "ok", cal: "ok", bak: "none" });
  assert.deepEqual(summarize(all), { ok: 4, watch: 4, bad: 2, none: 1 });
});

t("the receivable is not shown while the import fails, and old pro formas keep it hidden after", () => {
  const x = tiles(REAL).ar;
  assert.equal(x.value, "לא מאומת");
  assert.ok(!x.strip.includes("₪"), "no amount in the strip");
  const fresh = clone(REAL); fresh.fin.import_last_error = null; fresh.fin.import_ok_at = "2026-10-28T09:00:00Z";
  assert.equal(tiles(fresh).ar.status, "watch");
  assert.equal(tiles(fresh).ar.value, "לא מוצג");
  fresh.fin.proformas_open_old = 0; fresh.fin.proformas_open = 3; fresh.fin.proformas_open_total = 42000;
  assert.equal(tiles(fresh).ar.status, "ok");
  assert.equal(tiles(fresh).ar.value, "₪42K");
});

t("profit and loss: stale while the import fails, the 14 duplicates flagged until the import key exists", () => {
  assert.equal(tiles(REAL).pnl.status, "stale");
  assert.match(tiles(REAL).pnl.today, /14 הכפולות/);
  const fresh = clone(REAL); fresh.fin.import_last_error = null; fresh.fin.import_ok_at = "2026-10-27T09:00:00Z";
  assert.equal(tiles(fresh).pnl.status, "watch");
  assert.equal(tiles(fresh).pnl.strip, "כולל 14 כפולות");
  fresh.fin.expenses_import_key = true;
  assert.equal(tiles(fresh).pnl.status, "ok");
  fresh.fin.import_ok_at = "2026-10-23T09:00:00Z";
  assert.equal(tiles(fresh).pnl.status, "stale", "a clean import older than 3 days is stale");
});

t("profit and loss figures come from the bookkeeping engine: the last full month, never the partial one", () => {
  const x = tiles(REAL, { finance: { months: ["מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳"], revenue: [1, 2, 3, 76600, 55200, 12000], expenses: [0, 0, 0, 59900, 5800, 1400] } }).pnl;
  assert.equal(x.value, "₪55.2K");
  assert.match(x.sub, /ספט׳/);
  assert.match(x.sub, /ירידה של 28%/);
  assert.equal(x.chart.kind, "dual");
});

t("cash from monthly statements: the balance shows with its date for 40 days, then it is hidden", () => {
  assert.equal(tiles(REAL).cash.value, "יתרה לא מוצגת", "a statement ending 1.9 is 57 days old on 28.10");
  assert.match(tiles(REAL).cash.sub, /1\.9/);
  assert.ok(!tiles(REAL).cash.strip.includes("₪"));
  const fresh = clone(REAL); fresh.fin.bank_last_day = "2026-10-26";
  assert.equal(tiles(fresh).cash.status, "ok");
  assert.equal(tiles(fresh).cash.value, "₪41.4K");
  assert.equal(tiles(fresh).cash.fix, "אין פעולה.");
  const month = clone(REAL); month.fin.bank_last_day = "2026-09-30";
  const c = tiles(month).cash;
  assert.equal(c.status, "ok"); assert.equal(c.value, "₪41.4K"); assert.match(c.sub, /לפי דף הבנק/); assert.match(c.today, /לפני 28 ימים/);
  const late = clone(REAL); late.fin.bank_last_day = "2026-09-17";
  assert.equal(tiles(late).cash.status, "stale", "41 days: the month's statement was not imported");
});

// The Financy feed (20261028143100): the snapshot carries bank_balance_day and bank_sync.
const feed = (sync, over = {}) => {
  const x = clone(REAL);
  Object.assign(x.fin, { bank_balance: 52000.5, bank_balance_day: "2026-10-27", bank_sync: sync }, over);
  return x;
};
const OK_RUN = { status: "ok", last_at: "2026-10-28T05:30:04Z", last_ok_at: "2026-10-28T05:30:04Z", data_at: "2026-10-28T05:12:00Z" };

t("cash: with no feed key the monthly statement is the source, and the tile never asks for Financy keys", () => {
  const waiting = tiles(feed({ status: "not_configured", last_at: "2026-10-28T05:30:00Z", last_ok_at: null, data_at: null }, { bank_balance: 41369.21, bank_balance_day: "2026-09-01" })).cash;
  assert.equal(waiting.status, "stale"); assert.equal(waiting.value, "יתרה לא מוצגת");
  assert.match(waiting.fix, /דף הבנק/); assert.doesNotMatch(waiting.fix, /FINANCY|Financy/);
  assert.match(waiting.src, /Financy משמש לצפייה בלבד/); assert.match(waiting.fresh, /פעם בחודש/);
  const statement = tiles(feed({ status: "not_configured", last_at: "2026-10-28T05:30:00Z", last_ok_at: null, data_at: null }, { bank_balance: 30618.02, bank_balance_day: "2026-10-28" })).cash;
  assert.equal(statement.status, "ok"); assert.equal(statement.value, "₪30.6K");
});

t("cash: a fresh read shows the balance, even on a quiet account", () => {
  const c = tiles(feed(OK_RUN)).cash;
  assert.equal(c.status, "ok"); assert.equal(c.value, "₪52K"); assert.equal(c.strip, "₪52K ב-27.10");
  assert.match(c.src, /Financy/); assert.match(c.fresh, /07:30/);
  // the last movement is still 1.9: a balance read today is today's balance
  assert.equal(feed(OK_RUN).fin.bank_last_day, "2026-09-01");
});

t("cash: a read older than a week, or a stopped job, is not today's money", () => {
  const old = tiles(feed({ ...OK_RUN, data_at: "2026-10-18T05:00:00Z" })).cash;
  assert.equal(old.status, "stale"); assert.ok(!old.strip.includes("₪")); assert.ok(!old.value.includes("₪"));
  const oldBalance = tiles(feed(OK_RUN, { bank_balance_day: "2026-10-19" })).cash;
  assert.equal(oldBalance.status, "stale"); assert.ok(!oldBalance.value.includes("₪"));
  const stopped = tiles(feed({ ...OK_RUN, last_at: "2026-10-26T12:30:00Z", last_ok_at: "2026-10-26T12:30:00Z", data_at: "2026-10-26T05:00:00Z" }, { bank_balance_day: "2026-10-26" })).cash;
  assert.equal(stopped.status, "stale"); assert.match(stopped.today, /26\.10/);
});

t("cash: a run that failed says why, and shows no balance", () => {
  const run = (status) => tiles(feed({ ...OK_RUN, status, last_at: "2026-10-28T12:30:00Z" })).cash;
  assert.equal(run("consent_expired").status, "bad"); assert.equal(run("consent_expired").value, "ההסכמה פגה");
  assert.equal(run("token_failed").value, "המפתח נדחה");
  assert.equal(run("not_linked").status, "watch");
  assert.equal(run("provider_error").status, "watch");
  assert.equal(run("transactions_failed").status, "bad"); assert.equal(run("transactions_failed").value, "הסנכרון נכשל");
  for (const st of ["consent_expired", "token_failed", "not_linked", "account_missing", "error"]) {
    assert.ok(!run(st).strip.includes("₪") && !run(st).value.includes("₪"), st);
    assert.match(run(st).today, /27\.10/, `${st} names the last stored balance`);
  }
});

t("issuing: green only after a connection check that passed", () => {
  assert.equal(tiles(REAL).issue.status, "bad");
  const ok = { ok: true, text: "החיבור למערכת ההנפקה תקין", at: "2026-10-28T12:00:00Z" };
  assert.equal(tiles(REAL, { issueCheck: ok }).issue.status, "ok");
  const clean = clone(REAL); clean.fin.import_last_error = null;
  assert.equal(tiles(clean).issue.status, "watch", "a clean import alone is not a passed check");
  assert.equal(tiles(clean, { issueCheck: { ...ok, ok: false } }).issue.status, "bad");
});

t("matters: live only, overdue deadlines block, no saved deadline asks for attention", () => {
  const x = tiles(REAL).mat;
  assert.equal(x.value, "7");
  assert.match(x.today, /בסל המיחזור 14/);
  const d = clone(REAL); d.matters.deadlines_total = 2; d.matters.deadlines_14d = 1;
  assert.equal(tiles(d).mat.status, "ok");
  d.matters.deadlines_overdue = 1;
  assert.equal(tiles(d).mat.status, "bad");
});

t("security: a partner without a second factor blocks; users without a firm ask for attention", () => {
  assert.equal(tiles(REAL).sec.status, "watch");
  const d = clone(REAL); d.sec.partners_no_totp = 1;
  assert.equal(tiles(d).sec.status, "bad");
  d.sec.partners_no_totp = 0; d.sec.users_no_firm = 0;
  assert.equal(tiles(d).sec.status, "ok");
  const hist = [{ takenAt: "2026-10-26T04:00:00Z", definer: 136, live: 7, cronFailed7d: 0 }, { takenAt: "2026-10-27T04:00:00Z", definer: 139, live: 7, cronFailed7d: 0 }];
  assert.equal(tiles(d, { history: hist }).sec.status, "watch", "more DEFINER functions than the day before");
});

t("cron: a job whose last run failed blocks; failures earlier in the day or a bad HTTP answer ask for attention", () => {
  const d = clone(REAL); d.http.bad = 2;
  assert.equal(tiles(d).cron.status, "watch");
  d.cron[1].last_status = "failed"; d.cron[1].failed_24h = 1;
  assert.equal(tiles(d).cron.status, "bad");
  assert.match(tiles(d).cron.today, /lalum-dispatch-worker/);
});

t("cron: the run still in flight when the snapshot reads the log (its own, every time) is not a failure", () => {
  const d = clone(REAL);
  d.cron.push({ job: "lalum-ops-snapshot", active: true, last_at: "2026-10-28T14:15:00.196548+00:00", runs_24h: 1, schedule: "*/15 * * * *", failed_24h: 1, last_ok_at: null, last_status: "running" });
  d.cron_failed_7d = 1;
  const c = tiles(d).cron;
  assert.equal(c.status, "ok");
  assert.equal(c.value, "0 כשלים");
  assert.match(c.today, /\(0 ב-7 ימים\)/);
  d.cron[3].failed_24h = 2; d.cron_failed_7d = 2;
  assert.equal(tiles(d).cron.status, "watch", "an earlier failed run of the same job still counts");
});

t("calendar: held changes block, a missed day is stale", () => {
  const d = clone(REAL); d.outlook.status = "held"; d.outlook.held = 11;
  assert.equal(tiles(d).cal.status, "bad");
  const s = clone(REAL); s.outlook.last_ok_at = "2026-10-27T04:15:00Z"; s.outlook.last_at = s.outlook.last_ok_at;
  assert.equal(tiles(s).cal.status, "stale");
});

t("web: only the Search Console summary row counts (24.10: 4,998 summed against 85 real clicks)", () => {
  const rows = [
    { day: "2026-10-24", source: "gsc", scope: "site", key: "", metric: "clicks", value: 85 },
    { day: "2026-10-24", source: "gsc", scope: "page", key: "/ai", metric: "clicks", value: 2400 },
    { day: "2026-10-24", source: "gsc", scope: "query", key: "lalum", metric: "clicks", value: 2513 },
    { day: "2026-10-24", source: "facebook", scope: "site", key: "", metric: "followers", value: 946 },
  ];
  assert.deepEqual(webDays(rows), [{ day: "2026-10-24", impressions: 0, clicks: 85, fbFollowers: 946, igFollowers: null }]);
  const late = clone(REAL); late.web.gsc_last_day = "2026-10-20";
  assert.equal(tiles(late).web.status, "stale", "more than 5 days behind is more than Google's lag");
  const err = clone(REAL); err.campaign.gsc.status = "error";
  assert.equal(tiles(err).web.status, "bad");
});

t(`a snapshot older than ${SNAPSHOT_STALE_MIN} minutes shows nothing as green`, () => {
  const all = buildTiles({ snapshot: snap(REAL, "2026-10-28T11:00:00Z"), web: WEB, now: NOW });
  assert.equal(all.filter((x) => x.status === "ok").length, 0);
  assert.ok(all.every((x) => x.today.includes("תמונת המצב האחרונה")));
});

t("no snapshot: every tile says so and none is green", () => {
  const all = buildTiles({ snapshot: null, now: NOW });
  assert.equal(all.length, 11);
  assert.ok(all.every((x) => x.status === "none"));
  assert.equal(parseSnapshot(null), null);
  assert.equal(parseSnapshot({ taken_at: "2026-10-28T12:00:00Z" }), null);
});

t("the strip puts problems first", () => {
  const order = stripOrder(buildTiles({ snapshot: snap(REAL), web: WEB, now: NOW })).map((x) => x.status);
  assert.deepEqual(order.slice(0, 2), ["bad", "bad"]);
  assert.equal(order[order.length - 1], "ok");
});

t("daily series keep the last value of each Israel day", () => {
  const pts = [["2026-10-26T20:00:00Z", 1], ["2026-10-26T22:30:00Z", 2], ["2026-10-27T10:00:00Z", 3]];
  // 22:30 UTC on 26.10 is already 27.10 in Israel (UTC+2 after 25.10)
  assert.deepEqual(daily(pts, (p) => p[0], (p) => p[1]), [1, 3]);
  assert.equal(money(1192301), "₪1.19M");
  assert.equal(money(820), "₪820");
});

t("no dash used as punctuation in any text the control room shows", () => {
  const src = readFileSync(new URL("../src/lib/cockpit/controlRoomCore.ts", import.meta.url), "utf8")
    + readFileSync(new URL("../src/components/cockpit/ControlStrip.tsx", import.meta.url), "utf8")
    + readFileSync(new URL("../src/pages/cockpit/ControlRoom.tsx", import.meta.url), "utf8");
  const hebrew = [...src.matchAll(/["`]([^"`\n]*[֐-׿][^"`\n]*)["`]/g)].map((m) => m[1]);
  // the text itself, not the code inside ${...} (a minus there is arithmetic)
  const bad = hebrew.map((s) => s.replace(/\$\{[^}]*\}/g, "")).filter((s) => /[\u2013\u2014]| - /.test(s));
  assert.deepEqual(bad, []);
  const runs = ["ok", "not_configured", "consent_expired", "provider_error", "token_failed", "not_linked", "account_missing", "connection_missing", "error"];
  const rendered = [REAL, ...runs.map((status) => feed({ ...OK_RUN, status }))]
    .flatMap((data) => buildTiles({ snapshot: snap(data), web: WEB, now: NOW }))
    .flatMap((x) => [x.value, x.sub, x.strip, x.today, x.fix, x.src, x.fresh]);
  assert.deepEqual(rendered.filter((s) => /[\u2013\u2014]| - /.test(s)), []);
});

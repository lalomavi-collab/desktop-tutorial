import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../../../lib/supabase";
import { monthPeriod, summarize } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, FinDocument, FinExpense, FinPayment } from "../../../lib/cockpit/finance";
import { buildPnl, DEFAULT_TAX_SETTINGS } from "../../../lib/cockpit/taxPnl";
import type { TaxSettingsRow } from "../../../lib/cockpit/taxPnl";
import type { TaxParams } from "../../../lib/cockpit/taxParams";
import {
  accountBalances, addMonths, balanceSeries, cardCategories, cardInsights, cardMonths, cardRecurring, cardTaxPaid, categoryTotals, changePct,
  classify, classifyCard, defaultReserve, drawable, forecast30, insights, liquidity, monthlyCash, monthOf, monthTaxes, openCardCharges,
  recurring, runway, vatPeriod, withHistory,
} from "../../../lib/cockpit/bankDashboard";
import type { BankAccount, BankLine, Classified, ExtFact, ExtLine, ReconMatch, StoredBalance, YtdTax } from "../../../lib/cockpit/bankDashboard";
import { balanceWindow, bridge, flowByDay, forecastDays, lastMonths, nextKnown, RANGES, recentDays, recurringLoad } from "../../../lib/cockpit/bankTiles";
import type { Range } from "../../../lib/cockpit/bankTiles";
import { Amt } from "../../../components/cockpit/Amt";
import { MarketChart } from "../../../components/cockpit/MarketChart";
import { Bridge, DayFlows, Heat, Meter, MonthCols, PairCols, RankBars, ShareDonut, Spark } from "../../../components/cockpit/FinCharts";
import { IN, OK, OUT } from "../../../components/cockpit/finChartColors";
import { acct, pctText } from "../../../lib/cockpit/accounting";
import "../../../styles/cockpit-bank.css";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const SHORT = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
/** A bar's month: short, with the year on the first bar and on every January, so a year and a half of bars stays readable. */
const barLabel = (ym: string, i: number) => `${SHORT[Number(ym.slice(5, 7)) - 1]}${i === 0 || ym.endsWith("-01") ? ` ${ym.slice(2, 4)}` : ""}`;
const CUR: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };
/** A figure in a foreign currency, in the same form as Amt. */
function Fx({ n, cur }: { n: number; cur: string }) {
  if (cur === "ILS") return <Amt n={n} />;
  const a = acct(n);
  return <span className={`acct${a.neg ? " neg" : ""}${a.zero ? " zero" : ""}`} dir="ltr">{a.neg ? "−" : ""}{a.text}<small>{CUR[cur] ?? cur}</small></span>;
}
const dmy = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join(".") : "");
const PALETTE = ["var(--chart-ok, #216f33)", "var(--chart-cat-2, #2a75ba)", "var(--chart-cat-3, #984588)", "var(--chart-ok-l, #559f68)", "var(--chart-neutral, #9a968c)"];
const HOW: Record<Classified["how"], string> = { MATCH: "", RULE: "", LEARNED: "לפי תנועות קודמות", NONE: "לא שויך" };
const BANKS: Record<string, string> = { "10": "לאומי", "12": "הפועלים", "11": "דיסקונט", "20": "מזרחי טפחות", "31": "הבינלאומי", "17": "מרכנתיל", "14": "אוצר החייל" };

/** The four largest parts by colour in fixed order, the rest folded into one grey part, as every donut on the cockpit does. */
function topParts(rows: Array<{ key: string; label: string; amount: number }>) {
  const rest = rows.slice(4).reduce((s, c) => s + Math.max(0, c.amount), 0);
  return [
    ...rows.slice(0, 4).map((c, i) => ({ key: c.key, label: c.label, value: Math.max(0, c.amount), color: PALETTE[i] })),
    ...(rest > 0 ? [{ key: "rest", label: "שאר הקטגוריות", value: rest, color: PALETTE[4] }] : []),
  ];
}

// ---------- The tile parts: one shell, one toggle, one change chip, one icon set ----------

const ICON = {
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 0V6a2 2 0 0 1 2-2h10M16 13.5h.01",
  in: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14",
  out: "M12 15V4m0 0-4 4m4-4 4 4M5 20h14",
  net: "M5 8h6M8 5v6M13 16h6M18 5 6 19",
  draw: "M3 7h18v10H3ZM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6.5 10v4M17.5 10v4",
  line: "m3 17 5-5 4 3 8-8M15 7h5v5",
  bars: "M5 20v-9M10 20V5M15 20v-8M20 20v-5",
  forecast: "M4 6h16v14H4ZM4 10h16M8 3v4M16 3v4M8 14h3",
  pie: "M12 3v9h9a9 9 0 1 1-9-9ZM15 3.5A9 9 0 0 1 20.5 9H15Z",
  heat: "M4 4h4v4H4ZM10 4h4v4h-4ZM16 4h4v4h-4ZM4 10h4v4H4ZM10 10h4v4h-4ZM16 10h4v4h-4ZM4 16h4v4H4ZM10 16h4v4h-4Z",
  repeat: "M4 10a5 5 0 0 1 5-5h10m0 0-3-3m3 3-3 3M20 14a5 5 0 0 1-5 5H5m0 0 3 3m-3-3 3-3",
  card: "M3 6h18v12H3ZM3 10h18M7 15h4",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  bank: "m3 10 9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  profit: "M4 19h16M6 15l4-5 3 3 5-7M14 6h4v4",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
} as const;
function Ico({ name, size = 20 }: { name: keyof typeof ICON; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[name]} />
    </svg>
  );
}

/** Every box on the board: the icon chip and the title, a line under it, what sits beside it (a toggle, a badge, a link),
 *  the chart, a closing sentence, and the same figures as a table behind a disclosure. */
function Tile({ icon, title, sub, aside, wide, foot, more, moreLabel = "הצגת הטבלה", tone, children }: {
  icon: keyof typeof ICON; title: string; sub?: ReactNode; aside?: ReactNode; wide?: boolean; foot?: ReactNode; more?: ReactNode; moreLabel?: string;
  tone?: "in" | "out"; children: ReactNode;
}) {
  return (
    <section className={`ck-card db-card bdt${wide ? " wide" : ""}${tone ? ` ${tone}` : ""}`} aria-label={title}>
      <header className="bdt-head">
        <span className="db-kicon" aria-hidden="true"><Ico name={icon} /></span>
        <div className="bdt-titles"><h3>{title}</h3>{sub && <div className="db-note">{sub}</div>}</div>
        {aside && <div className="bdt-aside">{aside}</div>}
      </header>
      {children}
      {foot && <div className="bdt-foot">{foot}</div>}
      {more && <details className="bdt-more"><summary>{moreLabel}</summary>{more}</details>}
    </section>
  );
}

function Toggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<{ key: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="db-toggle" role="group" aria-label={label}>
      {options.map((o) => <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>{o.label}</button>)}
    </div>
  );
}

/** A percent change against an earlier figure as a chip: the arrow says the direction, the colour whether that is good news. */
function Delta({ cur, prev, goodWhenUp, vs }: { cur: number; prev: number | null | undefined; goodWhenUp: boolean; vs: string }) {
  const p = changePct(cur, prev);
  if (p == null) return <span className="bd-delta">אין נתון קודם להשוואה</span>;
  const good = p === 0 ? null : (p > 0) === goodWhenUp;
  return (
    <span className={`bd-delta${good == null ? "" : good ? " good" : " bad"}`}>
      <span aria-hidden="true">{p > 0 ? "▲" : p < 0 ? "▼" : "●"}</span><bdi dir="ltr">{pctText(p)}</bdi><small>מול {vs}</small>
    </span>
  );
}

/** A stat tile in the top row: label, one figure, its change, and a small chart of the same measure. */
function Kpi({ icon, label, tone, figure, delta, chart, note }: {
  icon: keyof typeof ICON; label: string; tone?: "in" | "out"; figure: ReactNode; delta?: ReactNode; chart?: ReactNode; note?: ReactNode;
}) {
  return (
    <section className={`ck-card db-card bdk${tone ? ` ${tone}` : ""}`} aria-label={label}>
      <div className="bdk-head"><span className="db-kicon" aria-hidden="true"><Ico name={icon} /></span><span className="bdk-label">{label}</span></div>
      <div className="bdk-fig">{figure}</div>
      {delta}
      {chart}
      {note && <div className="bdk-note">{note}</div>}
    </section>
  );
}

export function BankDashboardTab({ firmId, docs, payments, expenses, archive, reserveSaved, onReserveSaved, onOpen }: {
  firmId: string; docs: FinDocument[]; payments: FinPayment[]; expenses: FinExpense[]; archive: ArchiveDoc[];
  /** lalum_fin_cashflow_settings.safety_reserve, when the firm saved one. */
  reserveSaved: number | null; onReserveSaved: () => void;
  /** Opens another tab of the finance screen (the 13 week cash flow, the profit and loss report). */
  onOpen?: (tab: "pnl" | "cashflow") => void;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [lines, setLines] = useState<BankLine[]>([]);
  const [matches, setMatches] = useState<ReconMatch[]>([]);
  const [stored, setStored] = useState<StoredBalance[]>([]);
  const [ext, setExt] = useState<ExtLine[]>([]);
  const [facts, setFacts] = useState<ExtFact[]>([]);
  const [settings, setSettings] = useState<TaxSettingsRow | null>(null);
  const [paramsDb, setParamsDb] = useState<TaxParams[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("12");
  const [side, setSide] = useState<"OUT" | "IN">("OUT");
  const [heatSide, setHeatSide] = useState<"OUT" | "IN">("OUT");
  const [allLines, setAllLines] = useState(false);
  const [reserveText, setReserveText] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    void (async () => {
      const sb = supabase!;
      // Bank lines can pass the 1000 row page, so they are read page by page, in the order they were stored.
      const all: BankLine[] = [];
      let err = false;
      for (let off = 0; ; off += 1000) {
        const r = await sb.from("lalum_fin_bank_lines").select("id, bank_account_id, value_date, description, reference, amount, balance_after, created_at")
          .order("value_date").order("created_at").order("id").range(off, off + 999);
        if (r.error) { err = true; break; }
        all.push(...((r.data as BankLine[] | null) ?? []).map((l) => ({ ...l, amount: Number(l.amount), balance_after: l.balance_after == null ? null : Number(l.balance_after) })));
        if (!r.data || r.data.length < 1000) break;
      }
      // What Financy shows beyond the statement (migration 20261029150000), finance level 3 only. Missing or refused, it is left out.
      const extAll: ExtLine[] = [];
      for (let off = 0; ; off += 1000) {
        const r = await sb.from("lalum_fin_ext_lines").select("id, account_kind, account_ref, txn_date, description, source_category, amount, currency")
          .order("txn_date").order("id").range(off, off + 999);
        if (r.error) break;
        extAll.push(...((r.data as ExtLine[] | null) ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
        if (!r.data || r.data.length < 1000) break;
      }
      const [a, m, b, s, p, f] = await Promise.all([
        sb.from("lalum_fin_bank_accounts").select("id, bank_code, branch, account_last4, label, is_active"),
        sb.from("lalum_fin_recon_matches").select("bank_line_id, target_kind, expense_id, matched_amount, note"),
        // Stated balances arrive with migration 20261028143000; until it is applied the read fails and the lines' own chain is used.
        sb.from("lalum_fin_bank_balances").select("bank_account_id, as_of, balance, fetched_at, source").order("as_of", { ascending: false }).limit(500),
        sb.from("lalum_fin_tax_settings").select("*").eq("firm_id", firmId).eq("tax_year", new Date().getFullYear()).maybeSingle(),
        sb.from("lalum_tax_params").select("*"),
        sb.from("lalum_fin_ext_facts").select("kind, account_ref, label, amount, currency, due_on, as_of").order("as_of", { ascending: false }).limit(200),
      ]);
      if (!live) return;
      setLines(all);
      setExt(extAll);
      setFacts(((f.data as ExtFact[] | null) ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
      setAccounts((a.data as BankAccount[] | null) ?? []);
      setMatches(((m.data as ReconMatch[] | null) ?? []).map((x) => ({ ...x, matched_amount: x.matched_amount == null ? null : Number(x.matched_amount) })));
      setStored(((b.data as StoredBalance[] | null) ?? []).map((x) => ({ ...x, balance: Number(x.balance) })));
      setSettings((s.data as TaxSettingsRow | null) ?? null);
      setParamsDb(((p.data ?? []) as Array<{ tax_year: number; status: "VERIFIED" | "DRAFT"; verified_at: string | null; sources: string[]; params: Partial<TaxParams> }>)
        .filter((r) => r.params && Array.isArray(r.params.brackets))
        .map((r) => ({ ...(r.params as TaxParams), year: r.tax_year, status: r.status, verifiedAt: r.verified_at, sources: r.sources })));
      setError(err || a.error || m.error ? "שורות הבנק לא נטענו. ודאו שהתחברתם עם אימות דו שלבי כשותף בפירמה." : "");
      setLoaded(true);
      setBusy(false);
      setUpdated(new Date());
    })();
    return () => { live = false; };
  }, [firmId, tick]);

  // A refresh reads the tables again; the board stays on screen, quieter, until the new figures arrive.
  const refresh = () => { setBusy(true); setTick((t) => t + 1); };

  const view = useMemo(() => {
    const expCat = new Map(expenses.map((e) => [e.id, e.category]));
    // Before the first statement line the account's days come from Financy; the balance today is always the statement's.
    const all = withHistory(lines, accounts, ext);
    const cl = classify(all, matches, (id) => expCat.get(id));
    const bals = accountBalances(accounts, lines, stored);
    const known = bals.filter((x) => x.balance != null);
    const balance = known.length ? known.reduce((s, x) => s + (x.balance as number), 0) : null;
    const asOf = known.length ? known.map((x) => x.asOf as string).sort()[0] : null;
    const months = monthlyCash(cl, asOf);
    const rec = recurring(cl, asOf);
    const card = classifyCard(ext);
    const firstStatement = lines.reduce<string | null>((m, l) => (m == null || l.value_date < m ? l.value_date : m), null);
    return {
      cl, bals, balance, asOf, months, rec, series: balanceSeries(all, stored), card, cardMonths: cardMonths(card), cardRec: cardRecurring(card),
      firstStatement, fromFinancy: all.length - lines.length,
    };
  }, [lines, matches, accounts, stored, expenses, ext]);

  const sel = month ?? view.months[view.months.length - 1]?.month ?? monthOf(today);
  const year = Number(sel.slice(0, 4));
  const monthWord = MONTHS[Number(sel.slice(5, 7)) - 1];

  // Recomputed with the inputs; the React Compiler memoizes it.
  const tax = (() => {
    const year = Number(sel.slice(0, 4));
    const st = settings ?? { ...DEFAULT_TAX_SETTINGS, firm_id: firmId, tax_year: year, reporting_basis: "CASH" as const };
    const upTo = Number(sel.slice(5, 7));
    let problems: string[] = [], warnings: string[] = [], final = false;
    const ytd: Array<YtdTax | null> = [];
    for (let m = 1; m <= upTo; m++) {
      const rep = buildPnl(docs, payments, expenses, archive, { from: `${year}-01-01`, to: monthPeriod(year, m).to }, st, st.reporting_basis, paramsDb);
      ytd.push(rep.pnl ? { profit: rep.pnl.accounting.profit, incomeTax: rep.pnl.tax.netIncomeTax, bl: rep.pnl.tax.bl.total } : null);
      if (m === upTo) { problems = rep.problems; warnings = rep.pnl?.warnings ?? []; final = rep.final; }
    }
    const byMonth = monthTaxes(year, ytd);
    // VAT payable of every bimonthly period from a year back, from the ledger, so any period still open is covered.
    const vatByPeriod: Record<string, number> = {};
    for (let ym = `${year - 1}-01`; ym <= `${year}-12`; ym = addMonths(ym, 2)) {
      const p = vatPeriod(`${ym}-01`);
      vatByPeriod[p.months[0]] = summarize(docs, payments, expenses, { from: p.from, to: p.to }, archive).vatPayable;
    }
    const incomeTaxByMonth = Object.fromEntries(byMonth.map((x) => [x.month, x.incomeTax]));
    const outstanding = summarize(docs, payments, expenses, { from: "2000-01-01", to: "2100-12-31" }, archive).outstanding;
    return { byMonth, cur: byMonth[upTo - 1], problems, warnings, final, vatByPeriod, incomeTaxByMonth, outstanding };
  })();

  const liq = view.balance != null && view.asOf ? liquidity(view.balance, view.asOf, facts) : null;
  const cards = view.asOf ? openCardCharges(facts, view.asOf).flatMap((c) => (c.due ? [{ amount: c.amount, due: c.due, label: `כרטיס אשראי ***${c.account_ref}` }] : [])) : [];
  const fc = view.balance != null && view.asOf
    ? forecast30(view.cl, view.rec, view.balance, view.asOf, { vatByPeriod: tax.vatByPeriod, incomeTaxByMonth: tax.incomeTaxByMonth }, tax.outstanding,
      { cards, paidElsewhere: cardTaxPaid(view.card) })
    : null;

  const suggested = defaultReserve(view.rec);
  const reserve = reserveText != null && reserveText.trim() !== "" && Number.isFinite(Number(reserveText)) ? Math.max(0, Number(reserveText)) : reserveSaved ?? suggested;
  const isNow = view.asOf != null && sel === monthOf(view.asOf);
  const d = tax.cur ? drawable(sel, tax.cur, view.cl, isNow ? fc : null, reserve) : null;
  const ins = [...insights(view.cl, sel, view.asOf, today, d), ...cardInsights(view.card, sel)];
  const rw = liq ? runway(view.months, liq.liquid) : null;

  const saveReserve = async () => {
    if (!supabase) return;
    const { error: e } = await supabase.from("lalum_fin_cashflow_settings").upsert({ firm_id: firmId, safety_reserve: reserve });
    setMsg(e ? { ok: false, text: "הרזרבה לא נשמרה. שמירה דורשת הרשאת שותף מלאה בהנהלת החשבונות." } : { ok: true, text: "הרזרבה נשמרה. אותה רזרבה משמשת גם את תזרים 13 השבועות." });
    if (!e) { setReserveText(null); onReserveSaved(); }
  };

  if (!loaded) return <div className="ck-meta">טוען את נתוני הבנק...</div>;
  if (error) return <div className="ck-err" aria-live="polite">{error}</div>;
  if (lines.length === 0) return <div className="ck-card ck-empty"><div className="ck-title">אין עדיין שורות בנק</div><div className="ck-meta">הלוח נבנה מדפי הבנק. אחרי שדף הבנק החודשי ייובא, היתרה, התזרים והתחזית יופיעו כאן.</div></div>;

  const mi = view.months.findIndex((x) => x.month === sel);
  const cur = view.months[mi], prev = mi > 0 ? view.months[mi - 1] : null;
  const prevWord = prev ? MONTHS[Number(prev.month.slice(5, 7)) - 1] : "";
  // The stat tiles draw the six months up to the one chosen; the trend tiles share the range chosen in the bar above them.
  const six = mi >= 0 ? view.months.slice(Math.max(0, mi - 5), mi + 1) : [];
  const sixLabels = six.map((m) => SHORT[Number(m.month.slice(5, 7)) - 1]);
  const win = lastMonths(view.months, range);
  const winActive = win.findIndex((m) => m.month === sel);
  const winLabels = win.map((m, i) => barLabel(m.month, i));
  const series = balanceWindow(view.series, range);
  // Day and month on the axis while the series spans less than a year; past that, month and year, so no label repeats.
  const longSeries = series.length > 1 && Date.parse(series[series.length - 1].date) - Date.parse(series[0].date) > 360 * 86400000;
  const balLabels = series.map((x) => (longSeries ? `${x.date.slice(5, 7)}.${x.date.slice(2, 4)}` : dmy(x.date).slice(0, 5)));
  const profitByMonth = new Map(tax.byMonth.map((x) => [x.month, x]));
  const beforeStatement = view.firstStatement != null && sel < monthOf(view.firstStatement);

  const cats = categoryTotals(view.cl, sel, side);
  const catTotal = cats.reduce((s, c) => s + Math.max(0, c.amount), 0);
  const heat = flowByDay(view.cl, sel, heatSide);
  const heatMax = Math.max(0, ...heat);
  // VAT, the income tax advance and the card show the forecast's figure for their next payment, so each has one number on the page.
  const load = recurringLoad(view.rec, nextKnown(fc));
  const days14 = recentDays(view.cl, view.asOf ?? today, 14);
  const byDate = [...view.cl].sort((a, b) => b.value_date.localeCompare(a.value_date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const monthLines = byDate.filter((l) => monthOf(l.value_date) === sel);
  const shown = allLines ? monthLines : byDate.slice(0, 6);
  const fcDays = fc ? forecastDays(fc) : [];

  const cardRefs = [...new Set(view.card.map((l) => l.account_ref))];
  const cm = view.cardMonths.find((m) => m.month === sel) ?? null;
  const card12 = view.cardMonths.slice(-12);
  const cardAvg = card12.length ? Math.round(card12.reduce((a, m) => a + m.ils, 0) / card12.length) : 0;
  const cardWin = lastMonths(view.cardMonths, range);
  const cardActive = cardWin.findIndex((m) => m.month === sel);
  const cardCats = cardCategories(view.card, sel);
  const cardSel = view.card.filter((l) => monthOf(l.txn_date) === sel).sort((a, b) => b.txn_date.localeCompare(a.txn_date) || a.amount - b.amount);
  const fxText = (fx: Record<string, number>) => Object.entries(fx).filter(([, v]) => v !== 0).map(([c, v]) => `${CUR[c] ?? c}${acct(v).text}`).join(", ");

  const hasCard = view.card.length > 0;
  // Two tiles a row on a wide screen: when the count of half tiles is odd, the last one (the accounts) takes the whole row.
  const halves = 7 + (fc ? 1 : 0) + (hasCard ? 2 : 0) + 1;
  const hhmm = (t: Date) => t.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`ck-stack bd${busy ? " busy" : ""}`}>
      <div className="bd-bar">
        <div className="bd-bar-titles">
          <h2>לוח בקרה כספי</h2>
          <div className="ck-meta">
            לפי דפי הבנק עד <bdi>{dmy(view.asOf)}</bdi>
            {view.fromFinancy > 0 && view.firstStatement ? <>, ולפני <bdi>{dmy(view.firstStatement)}</bdi> לפי Financy</> : ""}.
            {view.card.length > 0 || facts.length > 0 ? " פירוט הכרטיס, החיוב הפתוח, המסגרות והערבות נקראו מ־Financy, לצפייה בלבד." : " Financy משמש לצפייה בלבד, והנתונים כאן מגיעים מדף הבנק החודשי."}
          </div>
        </div>
        <div className="bd-controls">
          <select className="ck-select" aria-label="חודש" value={sel} onChange={(e) => setMonth(e.target.value)}>
            {[...view.months].reverse().map((m) => <option key={m.month} value={m.month}>{monthName(m.month)}{m.partial ? " (חלקי)" : ""}</option>)}
          </select>
          <Toggle label="טווח הגרפים" value={range} options={RANGES} onChange={setRange} />
          <button type="button" className="ck-btn sm bd-refresh" onClick={refresh} disabled={busy}>
            <Ico name="refresh" size={16} />{busy ? "מרענן..." : "רענון"}
          </button>
          {updated && <span className="db-note" aria-live="polite">עודכן ב־<bdi>{hhmm(updated)}</bdi></span>}
        </div>
      </div>

      <div className="bd-body" aria-busy={busy}>
        {ins.length > 0 && (
          <div className="bd-insights" aria-label="תובנות">
            {ins.map((i) => <div key={i.title + i.body} className={`ck-card bd-insight ${i.tone}`}><b>{i.title}</b><div className="fin-note">{i.body}</div></div>)}
          </div>
        )}

        <div className="bd-kpis">
          <Kpi icon="wallet" label="מצב נזיל" figure={<Amt n={liq ? liq.liquid : view.balance} />}
            chart={series.length > 1 ? <Spark values={series.map((x) => x.balance)} labels={series.map((x) => dmy(x.date))} label="יתרה לאורך זמן" /> : undefined}
            note={<>
              {liq && liq.cardDue > 0
                ? <>עו״ש <Amt n={liq.balance} /> ב־<bdi>{dmy(view.asOf)}</bdi>, פחות חיוב כרטיס פתוח <Amt n={liq.cardDue} />{liq.cardDueOn ? <> שיורד ב־<bdi>{dmy(liq.cardDueOn)}</bdi></> : ""}.</>
                : <>יתרת העו״ש ב־<bdi>{dmy(view.asOf)}</bdi>{view.bals.length > 1 ? `, ${view.bals.length} חשבונות` : ""}.</>}
              {rw && rw.months > 0 ? <> מכסה כ־<bdi>{rw.months.toLocaleString("he-IL")}</bdi> חודשי הוצאות של העסק.</> : ""}
            </>} />
          <Kpi icon="in" tone="in" label={`נכנס ב${monthWord}`} figure={<Amt n={cur?.inflow ?? 0} />}
            delta={<Delta cur={cur?.inflow ?? 0} prev={prev?.inflow} goodWhenUp vs={prevWord} />}
            chart={<MonthCols values={six.map((m) => m.inflow)} labels={sixLabels} active={six.length - 1} tone="in" label="נכנס לפי חודש" height={46} />} />
          <Kpi icon="out" tone="out" label={`יצא ב${monthWord}`} figure={<Amt n={cur?.outflow ?? 0} />}
            delta={<Delta cur={cur?.outflow ?? 0} prev={prev?.outflow} goodWhenUp={false} vs={prevWord} />}
            chart={<MonthCols values={six.map((m) => m.outflow)} labels={sixLabels} active={six.length - 1} tone="out" label="יצא לפי חודש" height={46} />} />
          <Kpi icon="net" label="נטו בבנק" figure={<Amt n={cur?.net ?? 0} />}
            delta={<Delta cur={cur?.net ?? 0} prev={prev?.net} goodWhenUp vs={prevWord} />}
            chart={<MonthCols values={six.map((m) => m.net)} labels={sixLabels} active={six.length - 1} tone="net" label="נטו לפי חודש" height={46} />} />
        </div>
        <div className="fin-note bd-footnote">
          לא כולל העברות בין חשבונות, המרות מטבע ומשיכות בעלים (<Amt n={cur?.owner ?? 0} /> בחודש הזה).
          {hasCard ? " חיוב כרטיס האשראי נספר פעם אחת, ביום שהבנק גבה אותו. הפירוט לפי בית עסק מופיע בכרטיס האשראי למטה ולא נספר שוב." : " חיוב כרטיס האשראי נספר ביום החיוב, כי פירוט הכרטיס עוד לא מגיע אלינו."}
          {beforeStatement ? " החודש הזה קודם לדף הבנק הראשון: התנועות לפי Financy, בלי התאמה לחשבוניות." : cur?.partial ? " החודש לא מכוסה במלואו בדפי הבנק." : ""}
        </div>

        <div className="bd-tiles">
          {d && (
            <Tile icon="draw" title="שכר שאפשר למשוך" wide tone="in"
              sub={<>{monthName(sel)}{isNow ? "" : ", לפי הרווח בלבד כי החודש עבר"}</>}
              aside={!tax.final && <span className="ck-badge">הערכה: פרמטרי המס של {year} בטיוטה</span>}>
              <div className="bdt-fig hero"><Amt n={d.drawable} /></div>
              <div className="fin-note">
                {d.cash == null ? "הרווח של החודש אחרי מס הכנסה וביטוח לאומי, פחות מה שכבר נמשך בו."
                  : d.binding === "CASH" ? "המגבלה כרגע היא הקופה: הרווח מאפשר יותר, אבל הכסף בחשבון צריך קודם לכסות מסים ורזרבה."
                    : "המגבלה כרגע היא הרווח: בקופה יש יותר, אבל חלק ממנו שייך למסים או לחודשים הבאים."}
              </div>
              <div className="bd-bridges">
                <Bridge caption={d.binding === "EARNED" ? "לפי הרווח, זו המגבלה כרגע" : "לפי הרווח"} strong={d.binding === "EARNED"}
                  rows={bridge({ label: "רווח החודש לפני מס", value: d.profit }, [
                    { label: "מס הכנסה על החודש", value: -d.incomeTax },
                    { label: "ביטוח לאומי ובריאות על החודש", value: -d.bl },
                    { label: "כבר נמשך החודש (כולל פנסיה)", value: -d.taken },
                  ], { label: "נותר לפי הרווח" })}
                  extras={{ "ביטוח לאומי ובריאות על החודש": <span className="db-note">רווח אחרי מס: <Amt n={d.earned} /></span> }} />
                {d.cash && (
                  <Bridge caption={d.binding === "CASH" ? "לפי הקופה, זו המגבלה כרגע" : "לפי הקופה"} strong={d.binding === "CASH"}
                    rows={bridge({ label: `יתרה ב־${dmy(d.cash.asOf)}`, value: d.cash.balance }, [
                      { label: "מע״מ שעוד לא שולם", value: -d.cash.vat },
                      { label: "מקדמת מס הכנסה (הערכה)", value: -d.cash.incomeTax },
                      { label: "ביטוח לאומי ב־30 הימים הקרובים", value: -d.cash.bl },
                      ...(d.cash.card > 0 ? [{ label: "חיוב הכרטיס הפתוח (כבר הוצא)", value: -d.cash.card }] : []),
                      { label: "רזרבה תפעולית", value: -d.cash.reserve },
                    ], { label: "הקופה מאפשרת" })}
                    extras={{
                      "רזרבה תפעולית": (
                        <div className="bd-reserve-box">
                          <label htmlFor="bd-reserve" className="db-note">סכום הרזרבה</label>
                          <div className="bd-reserve">
                            <input id="bd-reserve" className="ck-input" inputMode="decimal" dir="ltr" value={reserveText ?? String(reserve)} onChange={(e) => setReserveText(e.target.value)} aria-describedby="bd-reserve-note" />
                            <button type="button" className="ck-btn sm primary" onClick={() => void saveReserve()} disabled={reserveText == null}>שמירה</button>
                          </div>
                          <div id="bd-reserve-note" className="db-note">{reserveSaved == null ? "לא נקבעה רזרבה, ולכן מוצג חודש אחד של חיובים קבועים" : "הרזרבה שנשמרה"} (<Amt n={suggested} /> לחודש).</div>
                        </div>
                      ),
                    }} />
                )}
              </div>
              {msg && <div className={msg.ok ? "ck-meta" : "ck-err"} aria-live="polite">{msg.text}</div>}
              {tax.problems.length > 0 && <div className="fin-note">{tax.problems.join(". ")}.</div>}
              {tax.warnings.length > 0 && <ul className="fin-note bd-list">{tax.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            </Tile>
          )}

          <Tile icon="line" title="יתרה לאורך זמן" sub={series.length > 1 ? <>מ־<bdi>{dmy(series[0].date)}</bdi> עד <bdi>{dmy(series[series.length - 1].date)}</bdi></> : undefined}>
            {series.length > 1 && (
              <div className="bdt-fig">
                <Amt n={series[series.length - 1].balance} />
                <Delta cur={series[series.length - 1].balance} prev={series[0].balance} goodWhenUp vs={`תחילת הטווח`} />
              </div>
            )}
            <MarketChart title="יתרה לאורך זמן" labels={balLabels} height={210}
              series={[{ key: "bal", label: "יתרה", color: OK, values: series.map((x) => x.balance), kind: "area" }]} />
          </Tile>

          <Tile icon="bars" title="תזרים מזומנים לפי חודש" sub={`${win.length} חודשים, נכנס מול יצא`}
            foot={win.some((m) => m.partial) ? <span className="db-note">* חודש שלא מכוסה במלואו בדפי הבנק.</span> : undefined}
            more={
              <div className="ck-table-wrap"><table className="ck-table">
                <thead><tr><th>חודש</th><th className="fin-num">נכנס</th><th className="fin-num">יצא</th><th className="fin-num">נטו</th></tr></thead>
                <tbody>{[...win].reverse().map((m) => (
                  <tr key={m.month}><td>{monthName(m.month)}{m.partial ? " (חלקי)" : ""}</td><td className="fin-num"><Amt n={m.inflow} /></td><td className="fin-num"><Amt n={m.outflow} /></td><td className="fin-num"><Amt n={m.net} /></td></tr>
                ))}</tbody>
              </table></div>
            }>
            <div className="bd-sums">
              <span><i style={{ background: IN }} />נכנס <Amt n={win.reduce((s, m) => s + m.inflow, 0)} /></span>
              <span><i style={{ background: OUT }} />יצא <Amt n={win.reduce((s, m) => s + m.outflow, 0)} /></span>
            </div>
            <PairCols buckets={winLabels} marks={win.map((m) => (m.partial ? "*" : ""))} active={winActive >= 0 ? winActive : undefined} label="תזרים מזומנים לפי חודש"
              series={[{ label: "נכנס", color: IN, values: win.map((m) => m.inflow) }, { label: "יצא", color: OUT, values: win.map((m) => m.outflow) }]} />
          </Tile>

          {fc && (
            <Tile icon="forecast" title="תחזית ל־30 יום" sub={<>מ־<bdi>{dmy(fc.startOn)}</bdi> עד <bdi>{dmy(fc.end)}</bdi>, מהיתרה בדף הבנק</>}
              aside={onOpen && <button type="button" className="ck-btn sm" onClick={() => onOpen("cashflow")}>לתזרים 13 השבועות</button>}
              foot={fc.excluded.length > 0 && (
                <>
                  <div className="ck-meta">לא נכללו בתחזית</div>
                  <ul className="fin-note bd-list">{fc.excluded.map((x) => <li key={x.label}>{x.label}{x.amount ? <>: <Amt n={x.amount} /></> : ""}. {x.why}.</li>)}</ul>
                </>
              )}
              more={fc.timeline.length === 0 ? <div className="ck-meta">אין חיובים צפויים בתקופה.</div> : (
                <div className="ck-table-wrap"><table className="ck-table">
                  <thead><tr><th>תאריך</th><th>תנועה</th><th className="fin-num">סכום</th><th className="fin-num">יתרה</th>{fc.expected.length > 0 && <th className="fin-num">עם תקבולים צפויים</th>}</tr></thead>
                  <tbody>{fc.timeline.map((r, i) => (
                    <tr key={i} className={r.expected ? "bd-expected" : undefined}><td><bdi>{dmy(r.date)}</bdi></td>
                      <td className="fin-text">{r.label}{r.note && <span className="fin-sub">{r.note}</span>}</td>
                      <td className="fin-num"><Amt n={r.amount} plus={r.expected} /></td><td className="fin-num">{r.expected ? "" : <Amt n={r.balance} />}</td>
                      {fc.expected.length > 0 && <td className="fin-num"><Amt n={r.withReceipts} /></td>}</tr>
                  ))}</tbody>
                </table></div>
              )}
              moreLabel="הצגת החיובים לפי תאריך">
              <div className="bdt-fig"><Amt n={fc.minBalance} /><span className="db-note">הנקודה הנמוכה, ב־<bdi>{dmy(fc.minOn)}</bdi></span></div>
              <MarketChart title="תחזית היתרה" labels={fcDays.map((p) => dmy(p.date).slice(0, 5))} height={190}
                series={[
                  { key: "bal", label: "בלי תקבולים", color: OK, values: fcDays.map((p) => p.balance), kind: "area" },
                  ...(fc.expected.length > 0 ? [{ key: "rcv", label: "עם תקבולים קבועים", color: "var(--chart-cat-2, #2a75ba)", values: fcDays.map((p) => p.withReceipts), kind: "dashed" as const }] : []),
                ]} />
              <div className={fc.shortOn ? "ck-warn" : "fin-note"}>
                {fc.shortOn ? <>אם לא ייכנס כסף, היתרה תרד מתחת לאפס ב־<bdi>{dmy(fc.shortOn)}</bdi> ותגיע עד <Amt n={fc.minBalance} /> ב־<bdi>{dmy(fc.minOn)}</bdi>.</>
                  : <>הקופה מכסה את כל 30 הימים גם בלי שייכנס כסף. הקו סופר רק חיובים, כי תקבול נכנס לחשבון רק כשהוא נכנס.</>}
                {fc.shortOn && fc.expected.length > 0 ? (fc.shortOnWithReceipts ? <> גם עם התקבולים הקבועים היא יורדת מתחת לאפס ב־<bdi>{dmy(fc.shortOnWithReceipts)}</bdi>.</> : " עם התקבולים הקבועים היא נשארת מעל אפס.") : ""}
              </div>
            </Tile>
          )}

          <Tile icon="profit" title="משיכות מול רווח" sub="רווח אחרי מס לפי הנהלת החשבונות, משיכות לפי הבנק"
            aside={onOpen && <button type="button" className="ck-btn sm" onClick={() => onOpen("pnl")}>לדוח רווח והפסד</button>}
            foot={<span className="db-note">הרווח אחרי מס מחושב מהחשבוניות וההוצאות (לא מהבנק), לפי מנוע המס, לשנה של החודש שנבחר בלבד.</span>}
            more={
              <div className="ck-table-wrap"><table className="ck-table">
                <thead><tr><th>חודש</th><th className="fin-num">נטו בבנק</th><th className="fin-num">רווח אחרי מס</th><th className="fin-num">נמשך</th></tr></thead>
                <tbody>{[...win].reverse().map((m) => {
                  const p = profitByMonth.get(m.month);
                  return (
                    <tr key={m.month}><td>{monthName(m.month)}{m.partial ? " (חלקי)" : ""}</td><td className="fin-num"><Amt n={m.net} /></td>
                      <td className="fin-num">{p ? <Amt n={p.afterTax} /> : "לא חושב"}</td><td className="fin-num"><Amt n={m.owner} /></td></tr>
                  );
                })}</tbody>
              </table></div>
            }>
            <PairCols buckets={winLabels} active={winActive >= 0 ? winActive : undefined} label="משיכות מול רווח לפי חודש"
              series={[
                { label: "רווח אחרי מס", color: OK, values: win.map((m) => profitByMonth.get(m.month)?.afterTax ?? null) },
                { label: "נמשך", color: "var(--chart-cat-2, #2a75ba)", values: win.map((m) => m.owner) },
              ]} />
          </Tile>

          <Tile icon="pie" title="פילוח לפי קטגוריה" sub={monthName(sel)}
            aside={<Toggle label="כיוון" value={side} options={[{ key: "OUT", label: "הוצאות" }, { key: "IN", label: "הכנסות" }] as const} onChange={setSide} />}
            more={cats.length === 0 ? undefined : (
              <div className="ck-table-wrap"><table className="ck-table">
                <thead><tr><th>קטגוריה</th><th className="fin-num">תנועות</th><th className="fin-num">סכום</th><th className="fin-num">חלק</th></tr></thead>
                <tbody>{cats.map((c) => <tr key={c.key}><td>{c.label}</td><td className="fin-num">{c.count}</td><td className="fin-num"><Amt n={c.amount} /></td><td className="fin-num"><bdi>{c.share}%</bdi></td></tr>)}</tbody>
              </table></div>
            )}>
            {cats.length > 0
              ? <ShareDonut parts={topParts(cats)} centre={Math.round(catTotal).toLocaleString("he-IL")} sub={side === "OUT" ? "₪ יצאו" : "₪ נכנסו"} />
              : <div className="ck-meta">אין תנועות בחודש הזה.</div>}
          </Tile>

          <Tile icon="heat" title="הכסף לפי יום" sub={monthName(sel)}
            aside={<Toggle label="כיוון" value={heatSide} options={[{ key: "OUT", label: "יצא" }, { key: "IN", label: "נכנס" }] as const} onChange={setHeatSide} />}
            foot={<span className="db-note">{heatMax > 0
              ? <>ככל שהיום כהה יותר, {heatSide === "OUT" ? "יצא בו יותר כסף מהעסק" : "נכנס בו יותר כסף לעסק"}. היום הכבד בחודש: <bdi>{heat.indexOf(heatMax) + 1}.{sel.slice(5, 7)}</bdi>, <Amt n={heatMax} />.</>
              : "אין תנועות בכיוון הזה בחודש הזה."}</span>}>
            <Heat days={heat} month={sel} color={heatSide === "OUT" ? OUT : IN} label={heatSide === "OUT" ? "יצא לפי יום" : "נכנס לפי יום"} />
          </Tile>

          <Tile icon="repeat" title="תנועות קבועות" sub="מה שחוזר כל חודש או כל חודשיים, מחושב לחודש"
            more={view.rec.length === 0 ? undefined : (
              <div className="ck-table-wrap"><table className="ck-table">
                <thead><tr><th>תנועה</th><th>קטגוריה</th><th>תדירות</th><th className="fin-num">סכום</th><th className="fin-num">שינוי</th><th>הבא בתאריך</th></tr></thead>
                <tbody>{load.rows.map((r) => (
                  <tr key={r.key}><td className="fin-text">{r.label}</td><td>{r.catLabel}</td><td>{r.cadence === "MONTHLY" ? "חודשי" : "דו חודשי"}</td>
                    <td className="fin-num"><Amt n={r.amount} />{r.note && <span className="fin-sub">{r.note}, בפעם הקודמת <Amt n={r.lastAmount} /></span>}</td>
                    <td className="fin-num">{r.changePct == null || r.changePct === 0 ? "ללא שינוי" : <span className={`bd-change ${(r.changePct > 0) === (r.amount > 0) ? "good" : "bad"}`}><bdi>{pctText(r.changePct)}</bdi></span>}</td>
                    <td>{r.stale ? <span className="fin-sub">הופסק? נראה לאחרונה ב־<bdi>{dmy(r.last)}</bdi>, ולכן לא נספר בתחזית</span>
                      : <><bdi>{dmy(r.next)}</bdi>{view.asOf && r.next <= view.asOf && <span className="fin-sub">לא נראה בדף הבנק</span>}</>}</td></tr>
                ))}</tbody>
              </table></div>
            )}>
            {view.rec.length === 0 ? <div className="ck-meta">עוד אין מספיק חודשים לזיהוי חיובים קבועים.</div> : (
              <>
                <div className="bd-pairstat">
                  <div><span className="db-note">הכנסות קבועות לחודש</span><b><Amt n={load.inflow} /></b></div>
                  <div><span className="db-note">הוצאות קבועות לחודש</span><b><Amt n={-load.outflow} /></b></div>
                </div>
                <RankBars label="החיובים והתקבולים הקבועים הגדולים"
                  rows={load.rows.slice(0, 6).map((r) => ({
                    key: r.key, label: r.label, value: r.monthly, dim: r.stale,
                    sub: <>{r.catLabel}, {r.cadence === "MONTHLY" ? "חודשי" : "דו חודשי"}{r.stale ? <>, הופסק?</> : <>, הבא ב־<bdi>{dmy(r.next)}</bdi></>}{r.note && <>, {r.note}</>}</>,
                    shown: <Amt n={r.amount} plus={r.amount > 0} />,
                    after: r.changePct != null && r.changePct !== 0 ? <span className={`bd-change ${(r.changePct > 0) === (r.amount > 0) ? "good" : "bad"}`}><bdi dir="ltr">{pctText(r.changePct)}</bdi></span> : undefined,
                  }))} />
              </>
            )}
          </Tile>

          <Tile icon="list" title="תנועות אחרונות" sub={<>14 הימים עד <bdi>{dmy(view.asOf ?? today)}</bdi></>}>
            <DayFlows days={days14} label="נכנס ויצא לפי יום" />
            <ul className="bd-tx">
              {shown.map((l) => (
                <li key={l.id}>
                  <span className="bd-tx-date"><bdi>{dmy(l.value_date).slice(0, 5)}</bdi></span>
                  <span className="bd-tx-name"><span className="fin-name">{(l.description ?? "").trim() || "ללא תיאור"}</span><span className="fin-sub">{l.cat.label}{HOW[l.how] ? `, ${HOW[l.how]}` : ""}</span></span>
                  <Amt n={l.amount} plus />
                </li>
              ))}
            </ul>
            {monthLines.length > 0 && (
              <button type="button" className="ck-btn sm bd-more-btn" onClick={() => setAllLines((v) => !v)} aria-expanded={allLines}>
                {allLines ? "חזרה לתנועות האחרונות" : `כל ${monthLines.length} התנועות של ${monthWord}`}
              </button>
            )}
          </Tile>

          {hasCard && (
            <Tile icon="card" title="כרטיס אשראי" sub={<>{cardRefs.map((r) => <bdi key={r}>{`***${r}`} </bdi>)}רכישות לפי יום הרכישה</>}
              aside={<span className="ck-badge">לפי Financy, לצפייה בלבד</span>}
              foot={<span className="db-note">החיוב החודשי כבר נספר בבנק ביום שנגבה, ולכן הפירוט כאן לא נספר שוב בתזרים. עסקה בתשלומים מופיעה בחודש הרכישה.</span>}>
              <div className="bd-pairstat">
                <div><span className="db-note">חיוב פתוח</span><b><Amt n={liq?.cardDue ?? 0} /></b>
                  <span className="db-note">{liq?.cardDueOn ? <>יורד מהעו״ש ב־<bdi>{dmy(liq.cardDueOn)}</bdi></> : "אין חיוב פתוח ידוע"}</span></div>
                <div><span className="db-note">רכישות ב{monthWord}</span><b><Amt n={cm?.ils ?? 0} /></b>
                  <span className="db-note">{cm ? <>{cm.count} עסקאות{fxText(cm.fx) ? <>, ועוד <bdi>{fxText(cm.fx)}</bdi></> : ""}</> : "אין רכישות"}</span></div>
                <div><span className="db-note">ממוצע לחודש</span><b><Amt n={cardAvg} /></b><span className="db-note">ב־{card12.length} החודשים האחרונים</span></div>
              </div>
              {liq?.cardLimit ? (
                <Meter label="ניצול מסגרת הכרטיס" parts={[
                  { key: "used", label: "בשימוש", value: liq.cardDue, color: OUT },
                  { key: "free", label: "פנוי", value: Math.max(0, liq.cardLimit - liq.cardDue), color: "var(--chart-neutral, #9a968c)" },
                ]} />
              ) : <div className="db-note">המסגרת לא נקראה.</div>}
              <PairCols buckets={cardWin.map((m, i) => barLabel(m.month, i))} active={cardActive >= 0 ? cardActive : undefined} label="רכישות בשקלים לפי חודש" height={170}
                series={[{ label: "רכישות", color: OUT, values: cardWin.map((m) => m.ils) }]} />
            </Tile>
          )}

          {hasCard && (
            <Tile icon="pie" title="רכישות בכרטיס לפי קטגוריה" sub={monthName(sel)} moreLabel="הצגת העסקאות והמנויים"
              more={(cardSel.length > 0 || view.cardRec.length > 0) && (
                <>
                  {cardSel.length > 0 && (
                    <div className="ck-table-wrap"><table className="ck-table">
                      <thead><tr><th>תאריך</th><th>בית עסק</th><th className="fin-num">סכום</th></tr></thead>
                      <tbody>{cardSel.map((l) => (
                        <tr key={l.id}><td><bdi>{dmy(l.txn_date)}</bdi></td>
                          <td className="fin-text"><span className="fin-name"><bdi>{l.description}</bdi></span><span className="fin-sub">{l.cat.label}</span></td>
                          <td className="fin-num"><Fx n={l.amount} cur={l.currency} /></td></tr>
                      ))}</tbody>
                    </table></div>
                  )}
                  {view.cardRec.length > 0 && (
                    <>
                      <div className="ck-meta" style={{ marginTop: 8 }}>מנויים וחיובים קבועים בכרטיס</div>
                      <div className="ck-table-wrap"><table className="ck-table">
                        <thead><tr><th>בית עסק</th><th>קטגוריה</th><th className="fin-num">סכום אחרון</th><th>הבא בתאריך</th></tr></thead>
                        <tbody>{view.cardRec.map((r) => (
                          <tr key={`${r.key}|${r.currency}`}><td className="fin-text"><bdi>{r.label}</bdi></td><td>{r.cat.label}</td><td className="fin-num"><Fx n={r.amount} cur={r.currency} /></td>
                            <td><bdi>{dmy(r.next)}</bdi></td></tr>
                        ))}</tbody>
                      </table></div>
                    </>
                  )}
                </>
              )}>
              {cardCats.length > 0
                ? <ShareDonut parts={topParts(cardCats)} centre={Math.round(cardCats.reduce((s, c) => s + Math.max(0, c.amount), 0)).toLocaleString("he-IL")} sub="₪ בכרטיס" />
                : <div className="ck-meta">אין רכישות בשקלים בחודש הזה.</div>}
            </Tile>
          )}

          <Tile icon="bank" title="חשבונות ומסגרות" wide={halves % 2 === 1}
            foot={<span className="db-note">{facts.length > 0 ? "המסגרות, הערבות וחשבון המט״ח לפי Financy. הלוואות לא מוצגות שם, ולכן גם לא כאן." : "הלוואות ומשכנתאות לא מחוברות. כשיהיה חיבור ישיר לבנק הן יופיעו כאן."}</span>}>
            <ul className="bd-accounts">
              {view.bals.map((b) => {
                const a = accounts.find((x) => x.id === b.accountId);
                return (
                  <li key={b.accountId}>
                    <div className="bd-acc-head"><b>{a?.label || `${BANKS[a?.bank_code ?? ""] ?? `בנק ${a?.bank_code ?? ""}`}`}</b> <span className="fin-sub">עו״ש <bdi>{`***${a?.account_last4 ?? ""}`}</bdi></span></div>
                    <div className="bd-acc-figure"><Amt n={b.balance} /></div>
                    <div className="db-note">{b.source === "STATED" ? "יתרה שהבנק מסר" : b.source === "LINES" ? "לפי שרשרת היתרות בדף הבנק" : "אין עדיין יתרה"}{b.asOf ? <>, <bdi>{dmy(b.asOf)}</bdi></> : ""}</div>
                  </li>
                );
              })}
              {liq?.overdraft != null && (
                <li>
                  <div className="bd-acc-head"><b>מסגרת אשראי בעו״ש</b></div>
                  <div className="bd-acc-figure"><Amt n={liq.overdraft} /></div>
                  <Meter label="יתרה מול מסגרת" parts={[
                    { key: "own", label: "כסף של העסק", value: Math.max(0, liq.balance), color: OK },
                    { key: "od", label: "מסגרת פנויה", value: Math.max(0, liq.overdraft + Math.min(0, liq.balance)), color: "var(--chart-neutral, #9a968c)" },
                  ]} />
                  <div className="db-note">זמין כולל המסגרת: <Amt n={liq.balance + liq.overdraft} />. משיכה מהמסגרת היא הלוואה בריבית, לא כסף של העסק.</div>
                </li>
              )}
              {liq?.guarantees.map((g) => (
                <li key={`${g.account_ref}|${g.as_of}`}>
                  <div className="bd-acc-head"><b>ערבות בנקאית</b> <span className="fin-sub">{g.label ?? ""}</span></div>
                  <div className="bd-acc-figure"><Amt n={g.amount} /></div>
                  <div className="db-note">התחייבות של הבנק כלפי צד אחר, נכון ל־<bdi>{dmy(g.as_of)}</bdi>. היא לא חוב לתשלום עכשיו ולכן לא יורדת מהיתרה. אם הערבות תמומש, הבנק בדרך כלל גובה את הסכום מהלקוח שביקש אותה.</div>
                </li>
              ))}
              {liq?.fx.map((x) => (
                <li key={`${x.account_ref}|${x.as_of}`}>
                  <div className="bd-acc-head"><b>{x.label ?? `חשבון ${x.currency}`}</b></div>
                  <div className="bd-acc-figure"><Fx n={x.amount} cur={x.currency} /></div>
                  <div className="db-note">נכון ל־<bdi>{dmy(x.as_of)}</bdi>, לפי Financy.</div>
                </li>
              ))}
            </ul>
          </Tile>
        </div>

        <div className="ck-meta">לעיון בלבד, לא ייעוץ מס. הסכום שאפשר למשוך הוא הערכה לפי הנתונים שהוזנו, ופרמטרי המס נקבעים מול רואת החשבון.</div>
      </div>
    </div>
  );
}

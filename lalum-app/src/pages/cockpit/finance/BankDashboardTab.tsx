import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { monthPeriod, summarize } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, FinDocument, FinExpense, FinPayment } from "../../../lib/cockpit/finance";
import { buildPnl, DEFAULT_TAX_SETTINGS } from "../../../lib/cockpit/taxPnl";
import type { TaxSettingsRow } from "../../../lib/cockpit/taxPnl";
import type { TaxParams } from "../../../lib/cockpit/taxParams";
import {
  accountBalances, addMonths, balanceSeries, categoryTotals, changePct, classify, defaultReserve, drawable, forecast30, insights,
  monthlyCash, monthOf, monthTaxes, recurring, spendByDay, vatPeriod,
} from "../../../lib/cockpit/bankDashboard";
import type { BankAccount, BankLine, Classified, ReconMatch, StoredBalance, YtdTax } from "../../../lib/cockpit/bankDashboard";
import { Amt } from "../../../components/cockpit/Amt";
import { Donut, GroupedBars } from "../../../components/cockpit/CockpitCharts";
import { MarketChart } from "../../../components/cockpit/MarketChart";
import { pctText } from "../../../lib/cockpit/accounting";
import "../../../styles/cockpit-bank.css";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const dmy = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join(".") : "");
const PALETTE = ["var(--chart-ok, #216f33)", "var(--chart-cat-2, #2a75ba)", "var(--chart-cat-3, #984588)", "var(--chart-ok-l, #559f68)", "var(--chart-neutral, #9a968c)"];
const HOW: Record<Classified["how"], string> = { MATCH: "", RULE: "", LEARNED: "לפי תנועות קודמות", NONE: "לא שויך" };
const BANKS: Record<string, string> = { "10": "לאומי", "12": "הפועלים", "11": "דיסקונט", "20": "מזרחי טפחות", "31": "הבינלאומי", "17": "מרכנתיל", "14": "אוצר החייל" };

/** A percent change under a figure: up or down against the month before, and whether that is good news. */
function Change({ cur, prev, goodWhenUp }: { cur: number; prev: number | null | undefined; goodWhenUp: boolean }) {
  const p = changePct(cur, prev);
  if (p == null) return <div className="fin-note">אין חודש קודם להשוואה</div>;
  const good = p === 0 ? null : (p > 0) === goodWhenUp;
  return <div className={`fin-note bd-change${good == null ? "" : good ? " good" : " bad"}`}><bdi>{pctText(p)}</bdi> לעומת החודש הקודם</div>;
}

export function BankDashboardTab({ firmId, docs, payments, expenses, archive, reserveSaved, onReserveSaved }: {
  firmId: string; docs: FinDocument[]; payments: FinPayment[]; expenses: FinExpense[]; archive: ArchiveDoc[];
  /** lalum_fin_cashflow_settings.safety_reserve, when the firm saved one. */
  reserveSaved: number | null; onReserveSaved: () => void;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [lines, setLines] = useState<BankLine[]>([]);
  const [matches, setMatches] = useState<ReconMatch[]>([]);
  const [stored, setStored] = useState<StoredBalance[]>([]);
  const [settings, setSettings] = useState<TaxSettingsRow | null>(null);
  const [paramsDb, setParamsDb] = useState<TaxParams[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [month, setMonth] = useState<string | null>(null);
  const [side, setSide] = useState<"OUT" | "IN">("OUT");
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
      const [a, m, b, s, p] = await Promise.all([
        sb.from("lalum_fin_bank_accounts").select("id, bank_code, branch, account_last4, label, is_active"),
        sb.from("lalum_fin_recon_matches").select("bank_line_id, target_kind, expense_id, matched_amount, note"),
        // Stated balances arrive with migration 20261028143000; until it is applied the read fails and the lines' own chain is used.
        sb.from("lalum_fin_bank_balances").select("bank_account_id, as_of, balance, fetched_at").order("as_of", { ascending: false }).limit(500),
        sb.from("lalum_fin_tax_settings").select("*").eq("firm_id", firmId).eq("tax_year", new Date().getFullYear()).maybeSingle(),
        sb.from("lalum_tax_params").select("*"),
      ]);
      if (!live) return;
      setLines(all);
      setAccounts((a.data as BankAccount[] | null) ?? []);
      setMatches(((m.data as ReconMatch[] | null) ?? []).map((x) => ({ ...x, matched_amount: x.matched_amount == null ? null : Number(x.matched_amount) })));
      setStored(((b.data as StoredBalance[] | null) ?? []).map((x) => ({ ...x, balance: Number(x.balance) })));
      setSettings((s.data as TaxSettingsRow | null) ?? null);
      setParamsDb(((p.data ?? []) as Array<{ tax_year: number; status: "VERIFIED" | "DRAFT"; verified_at: string | null; sources: string[]; params: Partial<TaxParams> }>)
        .filter((r) => r.params && Array.isArray(r.params.brackets))
        .map((r) => ({ ...(r.params as TaxParams), year: r.tax_year, status: r.status, verifiedAt: r.verified_at, sources: r.sources })));
      setError(err || a.error || m.error ? "שורות הבנק לא נטענו. ודאו שהתחברתם עם אימות דו שלבי כשותף בפירמה." : "");
      setLoaded(true);
    })();
    return () => { live = false; };
  }, [firmId]);

  const view = useMemo(() => {
    const expCat = new Map(expenses.map((e) => [e.id, e.category]));
    const cl = classify(lines, matches, (id) => expCat.get(id));
    const bals = accountBalances(accounts, lines, stored);
    const known = bals.filter((x) => x.balance != null);
    const balance = known.length ? known.reduce((s, x) => s + (x.balance as number), 0) : null;
    const asOf = known.length ? known.map((x) => x.asOf as string).sort()[0] : null;
    const months = monthlyCash(cl, asOf);
    const rec = recurring(cl);
    return { cl, bals, balance, asOf, months, rec, series: balanceSeries(lines) };
  }, [lines, matches, accounts, stored, expenses]);

  const sel = month ?? view.months[view.months.length - 1]?.month ?? monthOf(today);
  const year = Number(sel.slice(0, 4));

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

  const fc = view.balance != null && view.asOf
    ? forecast30(view.cl, view.rec, view.balance, view.asOf, { vatByPeriod: tax.vatByPeriod, incomeTaxByMonth: tax.incomeTaxByMonth }, tax.outstanding)
    : null;

  const suggested = defaultReserve(view.rec);
  const reserve = reserveText != null && reserveText.trim() !== "" && Number.isFinite(Number(reserveText)) ? Math.max(0, Number(reserveText)) : reserveSaved ?? suggested;
  const isNow = view.asOf != null && sel === monthOf(view.asOf);
  const d = tax.cur ? drawable(sel, tax.cur, view.cl, isNow ? fc : null, reserve) : null;
  const ins = insights(view.cl, sel, view.asOf, today, d);

  const saveReserve = async () => {
    if (!supabase) return;
    const { error: e } = await supabase.from("lalum_fin_cashflow_settings").upsert({ firm_id: firmId, safety_reserve: reserve });
    setMsg(e ? { ok: false, text: "הרזרבה לא נשמרה. שמירה דורשת הרשאת שותף מלאה בהנהלת החשבונות." } : { ok: true, text: "הרזרבה נשמרה. אותה רזרבה משמשת גם את תזרים 13 השבועות." });
    if (!e) { setReserveText(null); onReserveSaved(); }
  };

  if (!loaded) return <div className="ck-meta">טוען את נתוני הבנק...</div>;
  if (error) return <div className="ck-err" aria-live="polite">{error}</div>;
  if (lines.length === 0) return <div className="ck-card"><div className="ck-title">אין עדיין שורות בנק</div><div className="ck-meta">הלוח נבנה מדפי הבנק. אחרי שדף הבנק החודשי ייובא, היתרה, התזרים והתחזית יופיעו כאן.</div></div>;

  const mi = view.months.findIndex((x) => x.month === sel);
  const cur = view.months[mi], prev = mi > 0 ? view.months[mi - 1] : null;
  const cats = categoryTotals(view.cl, sel, side);
  const top = cats.slice(0, 4), rest = cats.slice(4).reduce((s, c) => s + Math.max(0, c.amount), 0);
  const segments = [...top.map((c, i) => ({ label: c.label, value: Math.round(Math.max(0, c.amount)), color: PALETTE[i] })), ...(rest > 0 ? [{ label: "שאר הקטגוריות", value: Math.round(rest), color: PALETTE[4] }] : [])];
  const days = spendByDay(view.cl, sel);
  const maxDay = Math.max(1, ...days);
  const firstDow = new Date(`${sel}-01T00:00:00Z`).getUTCDay();
  const recent = [...view.cl].sort((a, b) => b.value_date.localeCompare(a.value_date) || (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 12);
  const series = view.series.slice(-90);
  const profitByMonth = new Map(tax.byMonth.map((x) => [x.month, x]));

  return (
    <div className="ck-stack bd">
      <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="ck-title">לוח בקרה כספי</div>
          <div className="ck-meta">לפי דפי הבנק עד <bdi>{dmy(view.asOf)}</bdi>. Financy משמש לצפייה בלבד, והנתונים כאן מגיעים מדף הבנק החודשי.</div>
        </div>
        <select className="ck-select" aria-label="חודש" value={sel} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 200 }}>
          {[...view.months].reverse().map((m) => <option key={m.month} value={m.month}>{monthName(m.month)}{m.partial ? " (חלקי)" : ""}</option>)}
        </select>
      </div>

      {ins.length > 0 && (
        <div className="bd-insights" aria-label="תובנות">
          {ins.map((i) => <div key={i.title + i.body} className={`ck-card bd-insight ${i.tone}`}><b>{i.title}</b><div className="fin-note">{i.body}</div></div>)}
        </div>
      )}

      <div className="bd-kpis">
        <div className="ck-card fin-stat"><div className="ck-meta">מצב נזיל</div><div className="fin-figure"><Amt n={view.balance} /></div><div className="fin-note">יתרת העו״ש ב־<bdi>{dmy(view.asOf)}</bdi>{view.bals.length > 1 ? `, ${view.bals.length} חשבונות` : ""}.</div></div>
        <div className="ck-card fin-stat fin-inflow"><div className="ck-meta">נכנס ב{MONTHS[Number(sel.slice(5, 7)) - 1]}</div><div className="fin-figure"><Amt n={cur?.inflow ?? 0} /></div><Change cur={cur?.inflow ?? 0} prev={prev?.inflow} goodWhenUp /></div>
        <div className="ck-card fin-stat fin-outflow"><div className="ck-meta">יצא ב{MONTHS[Number(sel.slice(5, 7)) - 1]}</div><div className="fin-figure"><Amt n={cur?.outflow ?? 0} /></div><Change cur={cur?.outflow ?? 0} prev={prev?.outflow} goodWhenUp={false} /></div>
        <div className="ck-card fin-stat"><div className="ck-meta">נטו בבנק</div><div className="fin-figure"><Amt n={cur?.net ?? 0} /></div><Change cur={cur?.net ?? 0} prev={prev?.net} goodWhenUp /></div>
      </div>
      <div className="fin-note">לא כולל העברות בין חשבונות, המרות מטבע ומשיכות בעלים (<bdi><Amt n={cur?.owner ?? 0} /></bdi> בחודש הזה). חיוב כרטיס האשראי נספר ביום החיוב, כי פירוט הכרטיס עוד לא מגיע אלינו.{cur?.partial ? " החודש לא מכוסה במלואו בדפי הבנק." : ""}</div>

      {d && (
        <div className="ck-card bd-draw">
          <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="ck-meta">שכר שאפשר למשוך ב{MONTHS[Number(sel.slice(5, 7)) - 1]}{isNow ? "" : " (לפי הרווח בלבד, החודש עבר)"}</div>
              <div className="fin-figure bd-draw-figure"><Amt n={d.drawable} /></div>
            </div>
            {!tax.final && <span className="ck-badge">הערכה: פרמטרי המס של {year} בטיוטה</span>}
          </div>
          <div className="fin-note">
            {d.cash == null ? "הרווח של החודש אחרי מס הכנסה וביטוח לאומי, פחות מה שכבר נמשך בו."
              : d.binding === "CASH" ? "המגבלה כרגע היא הקופה: הרווח מאפשר יותר, אבל הכסף בחשבון צריך קודם לכסות מסים ורזרבה."
                : "המגבלה כרגע היא הרווח: בקופה יש יותר, אבל חלק ממנו שייך למסים או לחודשים הבאים."}
          </div>
          <div className="bd-wf-grid">
            <table className="bd-wf" aria-label="לפי הרווח">
              <caption>לפי הרווח</caption>
              <tbody>
                <tr><td>רווח החודש לפני מס</td><td><Amt n={d.profit} /></td></tr>
                <tr><td>מס הכנסה על החודש</td><td><Amt n={-d.incomeTax} /></td></tr>
                <tr><td>ביטוח לאומי ובריאות על החודש</td><td><Amt n={-d.bl} /></td></tr>
                <tr className="sub"><td>רווח אחרי מס</td><td><Amt n={d.earned} /></td></tr>
                <tr><td>כבר נמשך החודש (כולל פנסיה)</td><td><Amt n={-d.taken} /></td></tr>
                <tr className="total"><td>נותר לפי הרווח</td><td><Amt n={d.earnedLeft} /></td></tr>
              </tbody>
            </table>
            {d.cash && (
              <table className="bd-wf" aria-label="לפי הקופה">
                <caption>לפי הקופה</caption>
                <tbody>
                  <tr><td>יתרה ב־<bdi>{dmy(d.cash.asOf)}</bdi></td><td><Amt n={d.cash.balance} /></td></tr>
                  <tr><td>מע״מ שעוד לא שולם</td><td><Amt n={-d.cash.vat} /></td></tr>
                  <tr><td>מקדמת מס הכנסה (הערכה)</td><td><Amt n={-d.cash.incomeTax} /></td></tr>
                  <tr><td>ביטוח לאומי ב־30 הימים הקרובים</td><td><Amt n={-d.cash.bl} /></td></tr>
                  <tr>
                    <td>
                      <label htmlFor="bd-reserve">רזרבה תפעולית</label>
                      <div className="bd-reserve">
                        <input id="bd-reserve" className="ck-input" inputMode="decimal" dir="ltr" value={reserveText ?? String(reserve)} onChange={(e) => setReserveText(e.target.value)} aria-describedby="bd-reserve-note" />
                        <button type="button" className="ck-btn sm" onClick={() => void saveReserve()} disabled={reserveText == null}>שמירה</button>
                      </div>
                      <div id="bd-reserve-note" className="fin-note">{reserveSaved == null ? "לא נקבעה רזרבה, ולכן מוצג חודש אחד של חיובים קבועים" : "הרזרבה שנשמרה"} (<bdi><Amt n={suggested} /></bdi> לחודש).</div>
                    </td>
                    <td><Amt n={-d.cash.reserve} /></td>
                  </tr>
                  <tr className="total"><td>הקופה מאפשרת</td><td><Amt n={d.cash.left} /></td></tr>
                </tbody>
              </table>
            )}
          </div>
          {msg && <div className={msg.ok ? "ck-meta" : "ck-err"} aria-live="polite">{msg.text}</div>}
          {tax.problems.length > 0 && <div className="fin-note">{tax.problems.join(". ")}.</div>}
          {tax.warnings.length > 0 && <ul className="fin-note bd-list">{tax.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
      )}

      <div className="ck-grid2">
        <div className="ck-card">
          <div className="ck-title">תזרים מזומנים לפי חודש</div>
          <GroupedBars buckets={view.months.map((m) => MONTHS[Number(m.month.slice(5, 7)) - 1] + (m.partial ? "*" : ""))} unit="₪"
            series={[{ label: "נכנס", color: "var(--fin-inflow)", values: view.months.map((m) => Math.round(m.inflow)) }, { label: "יצא", color: "var(--fin-outflow)", values: view.months.map((m) => Math.round(m.outflow)) }]} />
          <div className="fin-note">* חודש שלא מכוסה במלואו בדפי הבנק.</div>
        </div>
        <div className="ck-card">
          <MarketChart title="יתרה לאורך זמן" labels={series.map((x) => dmy(x.date).slice(0, 5))} height={220}
            series={[{ key: "bal", label: "יתרה", color: "var(--chart-ok, #216f33)", values: series.map((x) => x.balance), kind: "area" }]} />
        </div>
      </div>

      <div className="ck-grid2">
        <div className="ck-card">
          <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div className="ck-title">פילוח לפי קטגוריה</div>
            <div className="fin-subtabs" role="tablist" aria-label="כיוון">
              <button type="button" role="tab" className="fin-subtab" aria-selected={side === "OUT"} onClick={() => setSide("OUT")}>הוצאות</button>
              <button type="button" role="tab" className="fin-subtab" aria-selected={side === "IN"} onClick={() => setSide("IN")}>הכנסות</button>
            </div>
          </div>
          {segments.length > 0
            ? <Donut segments={segments} centre={Math.round(cats.reduce((s, c) => s + Math.max(0, c.amount), 0)).toLocaleString("he-IL")} sub={side === "OUT" ? "₪ יצאו" : "₪ נכנסו"} />
            : <div className="ck-meta">אין תנועות בחודש הזה.</div>}
          {cats.length > 4 && <ul className="fin-note bd-list">{cats.slice(4).map((c) => <li key={c.key}>{c.label}: <bdi><Amt n={c.amount} /></bdi></li>)}</ul>}
        </div>
        <div className="ck-card">
          <div className="ck-title">הוצאות לפי יום</div>
          <div className="bd-heat" role="img" aria-label={days.map((v, i) => `${i + 1}: ${Math.round(v)}`).join(", ")}>
            {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((x) => <span key={x} className="bd-heat-dow">{x}</span>)}
            {Array.from({ length: firstDow }, (_, i) => <span key={`e${i}`} />)}
            {days.map((v, i) => (
              <span key={i} className="bd-heat-day" title={`${i + 1}.${sel.slice(5, 7)}: ${Math.round(v).toLocaleString("he-IL")} ₪`}
                style={{ background: v > 0 ? `color-mix(in srgb, var(--fin-outflow) ${Math.round(15 + 70 * (v / maxDay))}%, var(--card))` : undefined, color: v / maxDay > 0.55 ? "var(--card)" : undefined }}>{i + 1}</span>
            ))}
          </div>
          <div className="fin-note">ככל שהיום כהה יותר, יצא בו יותר כסף לעסק. היום הכבד בחודש: <bdi>{days.indexOf(maxDay) + 1}.{sel.slice(5, 7)}</bdi>, <bdi><Amt n={maxDay === 1 && days.every((v) => v === 0) ? 0 : maxDay} /></bdi>.</div>
        </div>
      </div>

      <div className="ck-card">
        <div className="ck-title">תנועות קבועות</div>
        {view.rec.length === 0 ? <div className="ck-meta">עוד אין מספיק חודשים לזיהוי חיובים קבועים.</div> : (
          <div className="ck-table-wrap"><table className="ck-table">
            <thead><tr><th>תנועה</th><th>קטגוריה</th><th>תדירות</th><th className="fin-num">סכום אחרון</th><th className="fin-num">שינוי</th><th>הבא בתאריך</th></tr></thead>
            <tbody>{view.rec.map((r) => (
              <tr key={r.key}><td className="fin-text">{r.label}</td><td>{r.cat.label}</td><td>{r.cadence === "MONTHLY" ? "חודשי" : "דו חודשי"}</td>
                <td className="fin-num"><Amt n={r.amount} /></td>
                <td className="fin-num">{r.changePct == null || r.changePct === 0 ? "ללא שינוי" : <span className={`bd-change ${(r.changePct > 0) === (r.amount > 0) ? "good" : "bad"}`}><bdi>{pctText(r.changePct)}</bdi></span>}</td>
                <td><bdi>{dmy(r.next)}</bdi>{view.asOf && r.next <= view.asOf && <span className="fin-sub">לא נראה בדף הבנק</span>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {fc && (
        <div className="ck-card">
          <div className="ck-title">תחזית ל־30 יום</div>
          <div className="ck-meta">מ־<bdi>{dmy(fc.startOn)}</bdi> עד <bdi>{dmy(fc.end)}</bdi>, מהיתרה בדף הבנק. נספרים רק חיובים: תקבולים נכנסים לתחזית רק כשהם בחשבון.</div>
          {fc.rows.length === 0 ? <div className="ck-meta">אין חיובים צפויים בתקופה.</div> : (
            <div className="ck-table-wrap"><table className="ck-table">
              <thead><tr><th>תאריך</th><th>תנועה</th><th className="fin-num">סכום</th><th className="fin-num">יתרה</th></tr></thead>
              <tbody>{fc.rows.map((r, i) => (
                <tr key={i}><td><bdi>{dmy(r.date)}</bdi></td><td className="fin-text">{r.label}{r.note && <span className="fin-sub">{r.note}</span>}</td>
                  <td className="fin-num"><Amt n={r.amount} /></td><td className="fin-num"><Amt n={r.balance} /></td></tr>
              ))}</tbody>
            </table></div>
          )}
          <div className={fc.minBalance < 0 ? "ck-warn" : "fin-note"}>
            {fc.minBalance < 0 ? <>אם לא ייכנס כסף, היתרה תרד מתחת לאפס ב־<bdi>{dmy(fc.minOn)}</bdi> ותגיע ל־<bdi><Amt n={fc.minBalance} /></bdi>.</>
              : <>הנקודה הנמוכה בתקופה: <bdi><Amt n={fc.minBalance} /></bdi> ב־<bdi>{dmy(fc.minOn)}</bdi>, גם בלי שייכנס כסף.</>}
          </div>
          {fc.excluded.length > 0 && (
            <>
              <div className="ck-meta" style={{ marginTop: 8 }}>לא נכללו בתחזית</div>
              <ul className="fin-note bd-list">{fc.excluded.map((x) => <li key={x.label}>{x.label}{x.amount ? <>: <bdi><Amt n={x.amount} /></bdi></> : ""}. {x.why}.</li>)}</ul>
            </>
          )}
        </div>
      )}

      <div className="ck-card">
        <div className="ck-title">משיכות מול רווח, לפי חודש</div>
        <div className="ck-table-wrap"><table className="ck-table">
          <thead><tr><th>חודש</th><th className="fin-num">נכנס לבנק</th><th className="fin-num">יצא מהבנק</th><th className="fin-num">נטו בבנק</th><th className="fin-num">רווח אחרי מס</th><th className="fin-num">נמשך</th></tr></thead>
          <tbody>{[...view.months].reverse().map((m) => {
            const p = profitByMonth.get(m.month);
            return (
              <tr key={m.month}><td>{monthName(m.month)}{m.partial ? " (חלקי)" : ""}</td>
                <td className="fin-num"><Amt n={m.inflow} /></td><td className="fin-num"><Amt n={m.outflow} /></td><td className="fin-num"><Amt n={m.net} /></td>
                <td className="fin-num">{p ? <Amt n={p.afterTax} /> : "לא חושב"}</td><td className="fin-num"><Amt n={m.owner} /></td></tr>
            );
          })}</tbody>
        </table></div>
        <div className="fin-note">הרווח אחרי מס מחושב מהחשבוניות וההוצאות בהנהלת החשבונות (לא מהבנק), לפי מנוע המס, לשנה שנבחרה בלבד.</div>
      </div>

      <div className="ck-grid2">
        <div className="ck-card">
          <div className="ck-title">תנועות אחרונות</div>
          <div className="ck-table-wrap"><table className="ck-table">
            <thead><tr><th>תאריך</th><th>תנועה</th><th className="fin-num">סכום</th></tr></thead>
            <tbody>{recent.map((l) => (
              <tr key={l.id}><td><bdi>{dmy(l.value_date)}</bdi></td>
                <td className="fin-text"><span className="fin-name">{(l.description ?? "").trim() || "ללא תיאור"}</span><span className="fin-sub">{l.cat.label}{HOW[l.how] ? `, ${HOW[l.how]}` : ""}</span></td>
                <td className="fin-num"><Amt n={l.amount} plus /></td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="ck-card">
          <div className="ck-title">חשבונות</div>
          <ul className="bd-accounts">
            {view.bals.map((b) => {
              const a = accounts.find((x) => x.id === b.accountId);
              return (
                <li key={b.accountId}>
                  <div><b>{a?.label || `${BANKS[a?.bank_code ?? ""] ?? `בנק ${a?.bank_code ?? ""}`}`}</b> <span className="fin-sub">עו״ש <bdi>{`***${a?.account_last4 ?? ""}`}</bdi></span></div>
                  <div className="bd-acc-figure"><Amt n={b.balance} /></div>
                  <div className="fin-note">{b.source === "STATED" ? "יתרה שהבנק מסר" : b.source === "LINES" ? "לפי שרשרת היתרות בדף הבנק" : "אין עדיין יתרה"}{b.asOf ? <>, <bdi>{dmy(b.asOf)}</bdi></> : ""}</div>
                </li>
              );
            })}
          </ul>
          <div className="fin-note">הלוואות ומשכנתאות לא מחוברות. כשיהיה חיבור ישיר לבנק הן יופיעו כאן.</div>
        </div>
      </div>

      <div className="ck-meta">לעיון בלבד, לא ייעוץ מס. הסכום שאפשר למשוך הוא הערכה לפי הנתונים שהוזנו, ופרמטרי המס נקבעים מול רואת החשבון.</div>
    </div>
  );
}

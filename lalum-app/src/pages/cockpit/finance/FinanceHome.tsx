import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { DOC_TYPE, monthPeriod, receivable, summarize } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, FinCustomer, FinDocument, FinExpense, FinPayment, TrustAccount, TrustTx } from "../../../lib/cockpit/finance";
import { CustomersTab } from "./CustomersTab";
import { DocumentsTab } from "./DocumentsTab";
import { ExpensesTab } from "./ExpensesTab";
import { ArchiveTab } from "./ArchiveTab";
import { ShaamExportTab } from "./ShaamExportTab";
import { TrustTab } from "./TrustTab";
import type { MatterRef } from "./TrustTab";
import { ArAgingTab } from "./ArAgingTab";
import { CashFlowTab } from "./CashFlowTab";
import type { SettingsRow } from "./CashFlowTab";
import type { DunningEntry } from "../../../lib/cockpit/arAging";
import type { ManualRow } from "../../../lib/cockpit/cashFlow";

import { PermissionsTab } from "./PermissionsTab";
import { Gate } from "./Gate";
import { ReportsTab } from "./ReportsTab";
import { RevenueView } from "./RevenueView";
import { allocationGaps, ALLOCATION_VERIFIED_ON } from "../../../lib/cockpit/financeAllocation";
import { incomeRows } from "../../../lib/cockpit/financeReports";

type Tab = "overview" | "documents" | "customers" | "expenses" | "trust" | "archive" | "shaam" | "reports" | "permissions" | "aging" | "cashflow";
const TABS: Array<[Tab, string]> = [["overview", "סקירה"], ["documents", "מסמכים"], ["customers", "לקוחות"], ["expenses", "הוצאות"], ["trust", "כספי נאמנות"], ["reports", "דוחות"], ["aging", "גיול חובות"], ["cashflow", "תזרים 13 שבועות"], ["archive", "ארכיון Invoice4U"], ["shaam", "קובץ מבנה אחיד"], ["permissions", "הרשאות"]];
const ARCHIVE_COLS = "id, i4u_doc_id, i4u_doc_type, doc_number, issue_date, i4u_client_id, subject, currency, subtotal, vat_amount, total, allocation_number, status_id, paid, balance, rate:raw->>ConversionRate, gname:raw->GeneralCustomer->>Name";
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export function FinanceHome({ firmId, firmName }: { firmId: string; firmName: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [customers, setCustomers] = useState<FinCustomer[]>([]);
  const [docs, setDocs] = useState<FinDocument[]>([]);
  const [payments, setPayments] = useState<FinPayment[]>([]);
  const [expenses, setExpenses] = useState<FinExpense[]>([]);
  const [trust, setTrust] = useState<TrustTx[]>([]);
  const [trustAccounts, setTrustAccounts] = useState<TrustAccount[]>([]);
  const [matters, setMatters] = useState<MatterRef[]>([]);
  const [archive, setArchive] = useState<ArchiveDoc[]>([]);
  const [dunning, setDunning] = useState<DunningEntry[]>([]);
  const [cashSettings, setCashSettings] = useState<SettingsRow | null>(null);
  const [cashRows, setCashRows] = useState<ManualRow[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  // Finance level of the signed-in user: 0 none, 1 view, 2 drafts, 3 issue, 4 admin. The database enforces it.
  const [level, setLevel] = useState(0);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const load = useCallback(async () => {
    if (!supabase) return;
    const lv = await supabase.rpc("lalum_fin_level", { p_firm: firmId });
    setLevel(typeof lv.data === "number" ? lv.data : 0);
    const [c, d, p, e, tr, ta, mt, mf, dl, cs, ci] = await Promise.all([
      supabase.from("lalum_fin_customers").select("*").order("name"),
      supabase.from("lalum_fin_documents").select("*").order("issue_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("lalum_fin_payments").select("*").order("paid_on", { ascending: false }),
      supabase.from("lalum_fin_expenses").select("*").order("spent_on", { ascending: false }),
      supabase.from("lalum_trust_ledger").select("*").order("id", { ascending: false }),
      supabase.from("lalum_trust_accounts").select("id, bank_name, branch, account_number, closed_on, opened_on").order("bank_name"),
      supabase.from("lalum_cockpit_matters").select("id, title"),
      supabase.from("lalum_matter_fees").select("matter_id, fin_customer_id"),
      supabase.from("lalum_fin_dunning_log").select("id, customer_id, tier, channel, sent_on, note").order("sent_on", { ascending: false }),
      supabase.from("lalum_fin_cashflow_settings").select("opening_balance, balance_as_of, credit_facility, safety_reserve").maybeSingle(),
      supabase.from("lalum_cash_forecast_items").select("week_ending, category, projected_amount").gte("week_ending", new Date().toISOString().slice(0, 10)),
    ]);
    // The reminder log and cash settings arrive with migration 0031; until it is applied they read empty and the tabs still render.
    setDunning((dl.data as DunningEntry[] | null) ?? []);
    setCashSettings(cs.data ? { ...(cs.data as SettingsRow), opening_balance: Number((cs.data as SettingsRow).opening_balance), credit_facility: Number((cs.data as SettingsRow).credit_facility), safety_reserve: Number((cs.data as SettingsRow).safety_reserve) } : null);
    setCashRows(((ci.data as Array<ManualRow & { projected_amount: number | string }> | null) ?? []).map((r) => ({ ...r, projected_amount: Number(r.projected_amount) })));
    // The archive can exceed the 1000 row page limit, so it is read page by page.
    const arch: ArchiveDoc[] = [];
    let archErr = false;
    for (let off = 0; ; off += 1000) {
      const r = await supabase.from("lalum_fin_archive").select(ARCHIVE_COLS).order("issue_date", { ascending: false }).range(off, off + 999);
      if (r.error) { archErr = true; break; }
      arch.push(...((r.data as ArchiveDoc[] | null) ?? []));
      if (!r.data || r.data.length < 1000) break;
    }
    setArchive(arch);
    const err = c.error ?? d.error ?? p.error ?? e.error ?? (archErr ? { message: "archive" } : null);
    setError(err ? "הנתונים לא נטענו. ודאו שהתחברתם עם אימות דו שלבי כשותף במשרד." : "");
    setCustomers((c.data as FinCustomer[] | null) ?? []);
    setDocs((d.data as FinDocument[] | null) ?? []);
    setPayments((p.data as FinPayment[] | null) ?? []);
    setExpenses((e.data as FinExpense[] | null) ?? []);
    setTrust((tr.data as TrustTx[] | null) ?? []);
    setTrustAccounts((ta.data as TrustAccount[] | null) ?? []);
    // Trust data needs finance level 4. A lower level gets an empty tab (behind the Gate), not a failed screen.
    const cust = new Map(((mf.data as Array<{ matter_id: string; fin_customer_id: string | null }> | null) ?? []).map((x) => [x.matter_id, x.fin_customer_id]));
    setMatters((((mt.data as Array<{ id: string; title: string }> | null) ?? [])).map((m) => ({ ...m, customer_id: cust.get(m.id) ?? null })));
    setLoaded(true);
  }, [firmId]);
  // Initial fetch from the database; setState happens after the awaited queries resolve.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const per = monthPeriod(year, month);
  const s = summarize(docs, payments, expenses, per, archive);
  const allIncome = incomeRows(docs, archive, customers, { from: "2000-01-01", to: "2100-12-31" });
  const hasTest = docs.some((d) => d.is_test);
  const allocGaps = allocationGaps(docs, customers);
  const overdue = docs.filter((d) => receivable(d, docs, payments) > 0 && (d.due_date ?? d.issue_date) < new Date().toISOString().slice(0, 10));

  return (
    <div className="ck-stack ck-fin">
      <div className="fin-subtabs" role="tablist" aria-label="הנהלת חשבונות">
        {TABS.filter(([k]) => k !== "permissions" || level >= 4).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className="fin-subtab" onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {error && <div className="ck-err" aria-live="polite">{error}</div>}
      {hasTest && <div className="ck-warn">במערכת יש מסמכי בדיקה מסביבת הניסוי של Invoice4U. הם מסומנים ואינם נספרים בדוחות.</div>}
      {!loaded && !error && <div className="ck-meta">טוען...</div>}

      {tab === "overview" && loaded && (
        <>
          <RevenueView rows={allIncome} />
          <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <div className="ck-title">תמונת מצב לתקופה</div>
            <div className="ck-row">
              <select className="ck-select" aria-label="חודש" value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ maxWidth: 160 }}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
              <select className="ck-select" aria-label="שנה" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ maxWidth: 120 }}>{[0, 1, 2, 3].map((k) => <option key={k} value={now.getFullYear() - k}>{now.getFullYear() - k}</option>)}</select>
            </div>
          </div>
          <div className="fin-grid3">
            <div className="ck-card fin-stat fin-inflow"><div className="ck-meta">הכנסות לפני מע"מ</div><div className="fin-figure">{money(s.revenueNet)}</div><div className="fin-note">חשבוניות מס וחשבוניות מס קבלה, בניכוי זיכויים, לפי תאריך המסמך.{s.archiveNet !== 0 && <> מתוכם מהארכיון של Invoice4U: <bdi>{money(s.archiveNet)}</bdi>.</>}</div></div>
            <div className="ck-card fin-stat fin-outflow"><div className="ck-meta">הוצאות לפני מע"מ</div><div className="fin-figure">{money(s.expenses)}</div>{s.expenses === 0 && <div className="fin-note">לא הוזנו הוצאות בתקופה הזאת.</div>}</div>
            <div className="ck-card fin-stat"><div className="ck-meta">הכנסות פחות הוצאות</div><div className="fin-figure">{money(s.profit)}</div><div className="fin-note">{s.expenses === 0 ? "כל עוד לא הוזנו הוצאות, הסכום הזה שווה להכנסות." : "לפני מס הכנסה ולפני הוצאות שלא הוזנו."}</div></div>
          </div>
          <div className="ck-grid2">
            <div className="ck-card fin-stat"><div className="ck-meta">מע"מ לתשלום (עסקאות פחות תשומות)</div><div className="fin-figure">{money(s.vatPayable)}</div><div className="fin-note">עסקאות <bdi>{money(s.vatOut)}</bdi>, תשומות לניכוי <bdi>{money(s.vatIn)}</bdi>.{s.archiveVat !== 0 && <> מתוך העסקאות, מהארכיון של Invoice4U: <bdi>{money(s.archiveVat)}</bdi>.</>}</div></div>
            <div className="ck-card fin-stat"><div className="ck-meta">חובות פתוחים של לקוחות</div><div className="fin-figure">{money(s.outstanding)}</div><div className="fin-note">חשבונות עסקה שהופקו במערכת הזאת ועוד לא שולמו. חשבונית מס וחשבונית מס קבלה מעידות על קבלת הכסף ולכן אינן חוב. חשבונות עסקה מהארכיון של Invoice4U אינם נכללים.</div>
              {overdue.length > 0 && <div className="ck-warn">{overdue.length} חשבונות עסקה עברו את מועד התשלום. ראו בלשונית "מסמכים".</div>}</div>
          </div>
          {allocGaps.length > 0 && (
            <div className="ck-warn" role="alert">
              <b>{allocGaps.length} חשבוניות מעל הסף ללא מספר הקצאה.</b> בדוק אם החיבור של Invoice4U לרשות המסים פעיל (נדרש חידוש בערך אחת לרבעון).
              <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
                {allocGaps.slice(0, 5).map((g) => <li key={g.doc.id}>{DOC_TYPE[g.doc.doc_type]} {g.doc.doc_number ?? ""}, {g.doc.issue_date}, <bdi>{money(g.doc.subtotal)}</bdi> לפני מע"מ{g.customerHasTaxId ? "" : " (ללקוח אין ת.ז. או ח.פ. בכרטיס)"}</li>)}
              </ul>
              <div className="fin-note">הסף נבדק מול רשות המסים ב-{ALLOCATION_VERIFIED_ON}. המספר נדרש כשהלקוח עוסק מורשה ודורש אותו.</div>
            </div>
          )}
          <div className="ck-meta">דוח לעיון בלבד. תקופת הדיווח למע"מ ושיטת ההכרה בהכנסה נקבעות מול רואה החשבון.</div>
        </>
      )}
      {tab === "documents" && loaded && <Gate level={level} need={2}><DocumentsTab level={level} firmId={firmId} customers={customers} docs={docs} payments={payments} archiveCount={archive.length} onOpenArchive={() => setTab("archive")} onChange={() => void load()} /></Gate>}
      {tab === "customers" && loaded && <Gate level={level} need={2}><CustomersTab firmId={firmId} customers={customers} onChange={() => void load()} /></Gate>}
      {tab === "trust" && loaded && <Gate level={level} need={4}><TrustTab firmId={firmId} customers={customers} matters={matters} accounts={trustAccounts} rows={trust} docs={docs} payments={payments} onChange={() => void load()} /></Gate>}
      {tab === "archive" && loaded && <ArchiveTab docs={archive} customers={customers} onChange={() => void load()} />}
      {tab === "expenses" && loaded && <Gate level={level} need={3}><ExpensesTab firmId={firmId} expenses={expenses} onChange={() => void load()} /></Gate>}
      {tab === "reports" && loaded && <ReportsTab docs={docs} archive={archive} customers={customers} payments={payments} expenses={expenses} />}
      {tab === "permissions" && level >= 4 && <PermissionsTab />}
      {tab === "aging" && loaded && <Gate level={level} need={3}><ArAgingTab customers={customers} docs={docs} payments={payments} dunning={dunning} canOverride={level >= 4} onChange={() => void load()} /></Gate>}
      {tab === "cashflow" && loaded && <Gate level={level} need={4}><CashFlowTab firmId={firmId} customers={customers} docs={docs} payments={payments} settings={cashSettings} rows={cashRows} onChange={() => void load()} /></Gate>}
      {tab === "shaam" && loaded && <ShaamExportTab docs={docs} customers={customers} firmName={firmName} />}
    </div>
  );
}

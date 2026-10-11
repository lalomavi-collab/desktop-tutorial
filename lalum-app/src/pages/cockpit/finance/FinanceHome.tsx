import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { monthPeriod, summarize } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, FinCustomer, FinDocument, FinExpense, FinPayment } from "../../../lib/cockpit/finance";
import { CustomersTab } from "./CustomersTab";
import { DocumentsTab } from "./DocumentsTab";
import { ExpensesTab } from "./ExpensesTab";
import { ArchiveTab } from "./ArchiveTab";
import { ShaamExportTab } from "./ShaamExportTab";
import { ArAgingTab } from "./ArAgingTab";
import { CashFlowTab } from "./CashFlowTab";
import type { SettingsRow } from "./CashFlowTab";
import type { DunningEntry } from "../../../lib/cockpit/arAging";
import type { ManualRow } from "../../../lib/cockpit/cashFlow";

import { PermissionsTab } from "./PermissionsTab";
import { Gate } from "./Gate";

type Tab = "overview" | "documents" | "customers" | "expenses" | "archive" | "shaam" | "permissions" | "aging" | "cashflow";
const TABS: Array<[Tab, string]> = [["overview", "סקירה"], ["documents", "מסמכים"], ["customers", "לקוחות"], ["expenses", "הוצאות"], ["aging", "גיול חובות"], ["cashflow", "תזרים 13 שבועות"], ["archive", "ארכיון Invoice4U"], ["shaam", "קובץ מבנה אחיד"], ["permissions", "הרשאות"]];
const ARCHIVE_COLS = "id, i4u_doc_id, i4u_doc_type, doc_number, issue_date, i4u_client_id, subject, currency, subtotal, vat_amount, total, allocation_number, status_id, paid, balance, rate:raw->>ConversionRate, gname:raw->GeneralCustomer->>Name";
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export function FinanceHome({ firmId, firmName }: { firmId: string; firmName: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [customers, setCustomers] = useState<FinCustomer[]>([]);
  const [docs, setDocs] = useState<FinDocument[]>([]);
  const [payments, setPayments] = useState<FinPayment[]>([]);
  const [expenses, setExpenses] = useState<FinExpense[]>([]);
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
    const [c, d, p, e, dl, cs, ci] = await Promise.all([
      supabase.from("lalum_fin_customers").select("*").order("name"),
      supabase.from("lalum_fin_documents").select("*").order("issue_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("lalum_fin_payments").select("*").order("paid_on", { ascending: false }),
      supabase.from("lalum_fin_expenses").select("*").order("spent_on", { ascending: false }),
      supabase.from("lalum_fin_dunning_log").select("id, customer_id, tier, channel, sent_on, note").order("sent_on", { ascending: false }),
      supabase.from("lalum_fin_cashflow_settings").select("opening_balance, balance_as_of, credit_facility, safety_reserve").maybeSingle(),
      supabase.from("lalum_cash_forecast_items").select("week_ending, category, projected_amount").gte("week_ending", new Date().toISOString().slice(0, 10)),
    ]);
    // The reminder log and cash settings arrive with migration 0026; until it is applied they read empty and the tabs still render.
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
    setLoaded(true);
  }, [firmId]);
  // Initial fetch from the database; setState happens after the awaited queries resolve.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const per = monthPeriod(year, month);
  const s = summarize(docs, payments, expenses, per, archive);
  const hasTest = docs.some((d) => d.is_test);
  const overdue = docs.filter((d) => d.doc_type === "INVOICE" && d.status === "ISSUED" && !d.is_test && d.due_date && d.due_date < new Date().toISOString().slice(0, 10));

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
          <div className="ck-row">
            <select className="ck-select" aria-label="חודש" value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ maxWidth: 160 }}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
            <select className="ck-select" aria-label="שנה" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ maxWidth: 120 }}>{[0, 1, 2, 3].map((k) => <option key={k} value={now.getFullYear() - k}>{now.getFullYear() - k}</option>)}</select>
          </div>
          <div className="ck-grid2">
            <div className="ck-card fin-stat"><div className="ck-meta">הכנסות לפני מע"מ</div><div className="fin-figure">{money(s.revenueNet)}</div><div className="fin-note">חשבוניות מס וחשבוניות מס קבלה, בניכוי זיכויים, לפי תאריך המסמך.{s.archiveNet !== 0 && <> מתוכם מארכיון Invoice4U: <bdi>{money(s.archiveNet)}</bdi>.</>}</div></div>
            <div className="ck-card fin-stat"><div className="ck-meta">הוצאות לפני מע"מ</div><div className="fin-figure">{money(s.expenses)}</div></div>
            <div className="ck-card fin-stat"><div className="ck-meta">רווח לפני מס</div><div className="fin-figure">{money(s.profit)}</div></div>
            <div className="ck-card fin-stat"><div className="ck-meta">מע"מ לתשלום (עסקאות פחות תשומות)</div><div className="fin-figure">{money(s.vatPayable)}</div><div className="fin-note">עסקאות <bdi>{money(s.vatOut)}</bdi>, תשומות לניכוי <bdi>{money(s.vatIn)}</bdi>.</div>{s.archiveVat !== 0 && <div className="fin-note">מתוך העסקאות, מארכיון Invoice4U: <bdi>{money(s.archiveVat)}</bdi>.</div>}</div>
          </div>
          <div className="ck-card fin-stat"><div className="ck-meta">יתרות פתוחות מלקוחות (כל התקופות)</div><div className="fin-figure">{money(s.outstanding)}</div>
            {overdue.length > 0 && <div className="ck-warn">{overdue.length} חשבוניות עברו את מועד התשלום. ראו בלשונית "מסמכים".</div>}</div>
          <div className="ck-meta">דוח לעיון בלבד. תקופת הדיווח למע"מ ושיטת ההכרה בהכנסה נקבעות מול רואה החשבון.</div>
        </>
      )}
      {tab === "documents" && loaded && <Gate level={level} need={2}><DocumentsTab level={level} firmId={firmId} customers={customers} docs={docs} payments={payments} archiveCount={archive.length} onOpenArchive={() => setTab("archive")} onChange={() => void load()} /></Gate>}
      {tab === "customers" && loaded && <Gate level={level} need={2}><CustomersTab firmId={firmId} customers={customers} onChange={() => void load()} /></Gate>}
      {tab === "archive" && loaded && <ArchiveTab docs={archive} customers={customers} onChange={() => void load()} />}
      {tab === "expenses" && loaded && <Gate level={level} need={3}><ExpensesTab firmId={firmId} expenses={expenses} onChange={() => void load()} /></Gate>}
      {tab === "permissions" && level >= 4 && <PermissionsTab />}
      {tab === "aging" && loaded && <Gate level={level} need={3}><ArAgingTab customers={customers} docs={docs} payments={payments} dunning={dunning} onChange={() => void load()} /></Gate>}
      {tab === "cashflow" && loaded && <Gate level={level} need={4}><CashFlowTab firmId={firmId} customers={customers} docs={docs} payments={payments} settings={cashSettings} rows={cashRows} onChange={() => void load()} /></Gate>}
      {tab === "shaam" && loaded && <ShaamExportTab docs={docs} customers={customers} firmName={firmName} />}
    </div>
  );
}

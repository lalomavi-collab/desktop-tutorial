import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { monthPeriod, summarize } from "../../../lib/cockpit/finance";
import type { FinCustomer, FinDocument, FinExpense, FinPayment } from "../../../lib/cockpit/finance";
import { CustomersTab } from "./CustomersTab";
import { DocumentsTab } from "./DocumentsTab";
import { ExpensesTab } from "./ExpensesTab";
import { ArchiveTab } from "./ArchiveTab";

type Tab = "overview" | "documents" | "customers" | "expenses" | "archive";
const TABS: Array<[Tab, string]> = [["overview", "סקירה"], ["documents", "מסמכים"], ["customers", "לקוחות"], ["expenses", "הוצאות"], ["archive", "ארכיון Invoice4U"]];
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export function FinanceHome({ firmId }: { firmId: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [customers, setCustomers] = useState<FinCustomer[]>([]);
  const [docs, setDocs] = useState<FinDocument[]>([]);
  const [payments, setPayments] = useState<FinPayment[]>([]);
  const [expenses, setExpenses] = useState<FinExpense[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [c, d, p, e] = await Promise.all([
      supabase.from("lalum_fin_customers").select("*").order("name"),
      supabase.from("lalum_fin_documents").select("*").order("issue_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("lalum_fin_payments").select("*").order("paid_on", { ascending: false }),
      supabase.from("lalum_fin_expenses").select("*").order("spent_on", { ascending: false }),
    ]);
    const err = c.error ?? d.error ?? p.error ?? e.error;
    setError(err ? "הנתונים לא נטענו. ודאו שהתחברתם עם אימות דו שלבי כשותף במשרד." : "");
    setCustomers((c.data as FinCustomer[] | null) ?? []);
    setDocs((d.data as FinDocument[] | null) ?? []);
    setPayments((p.data as FinPayment[] | null) ?? []);
    setExpenses((e.data as FinExpense[] | null) ?? []);
    setLoaded(true);
  }, []);
  // Initial fetch from the database; setState happens after the awaited queries resolve.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const per = monthPeriod(year, month);
  const s = summarize(docs, payments, expenses, per);
  const hasTest = docs.some((d) => d.is_test);
  const overdue = docs.filter((d) => d.doc_type === "INVOICE" && d.status === "ISSUED" && !d.is_test && d.due_date && d.due_date < new Date().toISOString().slice(0, 10));

  return (
    <div className="ck-stack">
      <div className="ck-row" role="tablist" aria-label="הנהלת חשבונות" style={{ flexWrap: "wrap" }}>
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`ck-btn${tab === k ? " primary" : ""}`} onClick={() => setTab(k)}>{label}</button>
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
            <div className="ck-card"><div className="ck-meta">הכנסות לפני מע"מ</div><div className="ck-title">{money(s.revenueNet)}</div><div className="ck-meta">חשבוניות מס וחשבוניות מס קבלה, בניכוי זיכויים, לפי תאריך המסמך</div></div>
            <div className="ck-card"><div className="ck-meta">הוצאות לפני מע"מ</div><div className="ck-title">{money(s.expenses)}</div></div>
            <div className="ck-card"><div className="ck-meta">רווח לפני מס</div><div className="ck-title">{money(s.profit)}</div></div>
            <div className="ck-card"><div className="ck-meta">מע"מ לתשלום (עסקאות פחות תשומות)</div><div className="ck-title">{money(s.vatPayable)}</div><div className="ck-meta">עסקאות {money(s.vatOut)} · תשומות לניכוי {money(s.vatIn)}</div></div>
          </div>
          <div className="ck-card"><div className="ck-meta">יתרות פתוחות מלקוחות (כל התקופות)</div><div className="ck-title">{money(s.outstanding)}</div>
            {overdue.length > 0 && <div className="ck-warn">{overdue.length} חשבוניות עברו את מועד התשלום. ראו בלשונית "מסמכים".</div>}</div>
          <div className="ck-meta">דוח לעיון בלבד. תקופת הדיווח למע"מ ושיטת ההכרה בהכנסה נקבעות מול רואה החשבון.</div>
        </>
      )}
      {tab === "documents" && loaded && <DocumentsTab firmId={firmId} customers={customers} docs={docs} payments={payments} onChange={() => void load()} />}
      {tab === "customers" && loaded && <CustomersTab firmId={firmId} customers={customers} onChange={() => void load()} />}
      {tab === "archive" && loaded && <ArchiveTab />}
      {tab === "expenses" && loaded && <ExpensesTab firmId={firmId} expenses={expenses} onChange={() => void load()} />}
    </div>
  );
}

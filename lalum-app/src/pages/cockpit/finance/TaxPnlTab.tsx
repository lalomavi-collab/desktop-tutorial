import { useEffect, useMemo, useState } from "react";
import { money } from "../../../lib/cockpit/shared";
import { supabase } from "../../../lib/supabase";
import { monthPeriod } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, FinDocument, FinExpense, FinPayment, Period } from "../../../lib/cockpit/finance";
import { buildPnl, DEFAULT_TAX_SETTINGS } from "../../../lib/cockpit/taxPnl";
import type { TaxSettingsRow } from "../../../lib/cockpit/taxPnl";
import type { EntityType } from "../../../lib/cockpit/taxEngine";
import type { TaxParams } from "../../../lib/cockpit/taxParams";
import { advisorError, cfoAudit } from "../../../lib/cockpit/taxAdvisorAgent";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const ENTITY: Record<EntityType, string> = { OSEK_MURSHE: "עוסק מורשה", LTD_COMPANY: "חברה בע\"מ", OSEK_PATUR: "עוסק פטור" };
type Form = Record<"credit_points" | "vat_paid_ytd" | "mikdamot_income_tax_paid_ytd" | "mikdamot_bituach_leumi_paid_ytd" | "keren_hishtalmut_deposited_ytd" | "pension_deposited_ytd", string>;
const toForm = (s: TaxSettingsRow | typeof DEFAULT_TAX_SETTINGS): Form => ({
  credit_points: String(s.credit_points), vat_paid_ytd: String(s.vat_paid_ytd), mikdamot_income_tax_paid_ytd: String(s.mikdamot_income_tax_paid_ytd),
  mikdamot_bituach_leumi_paid_ytd: String(s.mikdamot_bituach_leumi_paid_ytd), keren_hishtalmut_deposited_ytd: String(s.keren_hishtalmut_deposited_ytd),
  pension_deposited_ytd: String(s.pension_deposited_ytd),
});
const FIELDS: Array<[keyof Form, string]> = [
  ["credit_points", "נקודות זיכוי"], ["vat_paid_ytd", "מע\"מ ששולם לרשות המסים מתחילת השנה"], ["mikdamot_income_tax_paid_ytd", "מקדמות מס הכנסה ששולמו מתחילת השנה"],
  ["mikdamot_bituach_leumi_paid_ytd", "מקדמות ביטוח לאומי ששולמו מתחילת השנה"], ["keren_hishtalmut_deposited_ytd", "הפקדות לקרן השתלמות"], ["pension_deposited_ytd", "הפקדות לפנסיה"],
];

const Row = ({ sign, label, value, strong }: { sign: string; label: string; value: number; strong?: boolean }) => (
  <tr><td style={{ width: 36 }}><bdi>{sign}</bdi></td><td>{strong ? <b>{label}</b> : label}</td><td className="fin-ltr">{strong ? <b>{money(value)}</b> : money(value)}</td></tr>
);

export function TaxPnlTab({ firmId, docs, payments, expenses, archive }: { firmId: string; docs: FinDocument[]; payments: FinPayment[]; expenses: FinExpense[]; archive: ArchiveDoc[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [upTo, setUpTo] = useState(now.getMonth() + 1); // the period runs from January to this month
  const [entity, setEntity] = useState<EntityType>("OSEK_MURSHE");
  const [basis, setBasis] = useState<"CASH" | "ACCRUAL">("CASH");
  const [form, setForm] = useState<Form>(toForm(DEFAULT_TAX_SETTINGS));
  const [paramsDb, setParamsDb] = useState<TaxParams[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [audit, setAudit] = useState<string | null>(null);
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    void (async () => {
      const [s, p] = await Promise.all([
        supabase!.from("lalum_fin_tax_settings").select("*").eq("firm_id", firmId).eq("tax_year", year).maybeSingle(),
        supabase!.from("lalum_tax_params").select("*"),
      ]);
      if (!live) return;
      const row = s.data as (TaxSettingsRow & { tax_year: number }) | null;
      setForm(toForm(row ?? DEFAULT_TAX_SETTINGS));
      setEntity(row?.entity_type ?? "OSEK_MURSHE");
      setBasis(row?.reporting_basis ?? "CASH");
      // The table stores the figures as JSON next to their status; a malformed row is ignored rather than trusted.
      setParamsDb(((p.data ?? []) as Array<{ tax_year: number; status: "VERIFIED" | "DRAFT"; verified_at: string | null; sources: string[]; params: Partial<TaxParams> }>)
        .filter((r) => r.params && Array.isArray(r.params.brackets))
        .map((r) => ({ ...(r.params as TaxParams), year: r.tax_year, status: r.status, verifiedAt: r.verified_at, sources: r.sources })));
    })();
    return () => { live = false; };
  }, [firmId, year]);

  const num = (k: keyof Form) => { const n = Number(form[k]); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const period: Period = { from: `${year}-01-01`, to: monthPeriod(year, upTo).to };
  const report = useMemo(() => buildPnl(docs, payments, expenses, archive, period, {
    entity_type: entity, credit_points: num("credit_points"), vat_paid_ytd: num("vat_paid_ytd"), mikdamot_income_tax_paid_ytd: num("mikdamot_income_tax_paid_ytd"),
    mikdamot_bituach_leumi_paid_ytd: num("mikdamot_bituach_leumi_paid_ytd"), keren_hishtalmut_deposited_ytd: num("keren_hishtalmut_deposited_ytd"),
    pension_deposited_ytd: num("pension_deposited_ytd"),
  }, basis, paramsDb),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [docs, payments, expenses, archive, year, upTo, entity, basis, form, paramsDb]);
  const { pnl, problems, final, vatPeriod } = report;
  const isCo = entity === "LTD_COMPANY";

  async function save() {
    if (!supabase) return;
    const { error } = await supabase.from("lalum_fin_tax_settings").upsert({
      firm_id: firmId, tax_year: year, entity_type: entity, reporting_basis: basis, credit_points: num("credit_points"), vat_paid_ytd: num("vat_paid_ytd"),
      mikdamot_income_tax_paid_ytd: num("mikdamot_income_tax_paid_ytd"), mikdamot_bituach_leumi_paid_ytd: num("mikdamot_bituach_leumi_paid_ytd"),
      keren_hishtalmut_deposited_ytd: num("keren_hishtalmut_deposited_ytd"), pension_deposited_ytd: num("pension_deposited_ytd"),
    }, { onConflict: "firm_id,tax_year" });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "פרופיל המס נשמר." });
  }
  async function runAudit() {
    if (!pnl) return;
    setAuditing(true); setAudit(null);
    const r = await cfoAudit(firmId, pnl, final);
    setAuditing(false);
    setAudit(r.ok && r.data ? r.data.report : advisorError(r.code));
  }

  return (
    <div className="ck-stack">
      <div className="ck-row">
        <select className="ck-select" aria-label="שנת מס" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ maxWidth: 120 }}>
          {[0, 1, 2].map((k) => <option key={k} value={now.getFullYear() - k}>{now.getFullYear() - k}</option>)}
        </select>
        <select className="ck-select" aria-label="עד חודש" value={upTo} onChange={(e) => setUpTo(Number(e.target.value))} style={{ maxWidth: 200 }}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>מינואר עד {m}</option>)}
        </select>
        <button className="ck-btn" onClick={() => window.print()}>הדפסה או שמירה כ-PDF</button>
      </div>

      {!final && <div className="ck-warn" role="alert">
        המספרים אינם סופיים: {problems.join(". ")}. הפרמטרים הסטטוטוריים נשמרים כנתונים ב-`lalum_tax_params`, ורק שורה שאומתה משני מקורות הופכת את הדוח לסופי.
      </div>}
      {pnl?.warnings.map((w) => <div key={w} className="ck-meta">{w}</div>)}

      <div className="ck-card ck-stack">
        <div className="ck-title">פרופיל מס, {year}</div>
        <div className="ck-grid2">
          <label className="ck-field">סוג עסק<select className="ck-select" value={entity} onChange={(e) => setEntity(e.target.value as EntityType)}>{Object.entries(ENTITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="ck-field">בסיס דיווח<select className="ck-select" value={basis} onChange={(e) => setBasis(e.target.value as "CASH" | "ACCRUAL")}><option value="CASH">מזומן</option><option value="ACCRUAL">מצטבר</option></select></label>
          {FIELDS.map(([k, l]) => <label key={k} className="ck-field">{l}<input className="ck-input" dir="ltr" inputMode="decimal" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>)}
        </div>
        <div className="ck-row"><button className="ck-btn primary" onClick={() => void save()}>שמירת הפרופיל</button>{msg && <span className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</span>}</div>
      </div>

      {pnl && <>
        <div className="fin-kpis">
          <div className="ck-card fin-stat"><div className="ck-meta">הכנסות לפני מע"מ</div><div className="fin-kpi">{money(pnl.accounting.revenue)}</div><div className="fin-note">בצנרת (חשבונות עסקה פתוחים): {money(pnl.vat.pipelineNet)}, מע"מ {money(pnl.vat.pipeline)}</div></div>
          <div className="ck-card fin-stat"><div className="ck-meta">רווח חשבונאי לפני מס</div><div className="fin-kpi">{money(pnl.accounting.profit)}</div><div className="fin-note">שולי רווח <bdi>{pnl.accounting.margin}%</bdi></div></div>
          <div className="ck-card fin-stat"><div className="ck-meta">סך חבות מס וביטוח לאומי</div><div className="fin-kpi">{money(pnl.tax.total)}</div><div className="fin-note">שיעור אפקטיבי <bdi>{pnl.tax.effectiveRate}%</bdi></div></div>
          <div className="ck-card fin-stat"><div className="ck-meta">רווח נקי אחרי מס</div><div className="fin-kpi" style={{ color: "var(--ck-ok, inherit)" }}>{money(pnl.net.afterTax)}</div></div>
          <div className="ck-card fin-stat"><div className="ck-meta">נטו פנוי אחרי הפרשות</div><div className="fin-kpi">{money(pnl.vaults.safeToSpend)}</div></div>
        </div>

        <div className="ck-card ck-stack">
          <div className="ck-title">רווח והפסד לפני ואחרי מס, מינואר עד {MONTHS[upTo - 1]} {year}</div>
          <div className="ck-table-wrap"><table className="ck-table"><tbody>
            <tr><td colSpan={3}><b>חלק א: רווח והפסד חשבונאי (לפני מס)</b></td></tr>
            <Row sign="(+)" label="הכנסות מעסק ומשירותים (ללא מע&quot;מ)" value={pnl.accounting.revenue} />
            <Row sign="(-)" label="הוצאות תפעול וניהול (בסכומן המלא, לפני תיאומי מס)" value={pnl.accounting.expenses} />
            <Row sign="(=)" label="רווח חשבונאי לפני מס" value={pnl.accounting.profit} strong />
            <tr><td colSpan={3}><b>חלק ב: דוח התאמה למס</b></td></tr>
            <Row sign="(+)" label="תיאום הוצאות לא מוכרות או מוכרות חלקית" value={pnl.reconciliation.addBack} />
            {!isCo && <Row sign="(-)" label="ניכוי 52% מדמי הביטוח הלאומי" value={pnl.reconciliation.niDeduction} />}
            {!isCo && <Row sign="(-)" label="ניכוי הפקדות לקרן השתלמות ולפנסיה" value={pnl.reconciliation.hishtalmutDeduction + pnl.reconciliation.pensionDeduction} />}
            <Row sign="(=)" label="הכנסה חייבת במס" value={pnl.reconciliation.taxable} strong />
            <tr><td colSpan={3}><b>חלק ג: חישוב מס ורווח נקי אחרי מס</b></td></tr>
            {isCo
              ? <Row sign="(-)" label="מס חברות" value={pnl.tax.corporateTax} />
              : <>
                <Row sign="(-)" label="מס הכנסה ברוטו לפי מדרגות" value={pnl.tax.grossIncomeTax} />
                <Row sign="(+)" label="קיזוז נקודות זיכוי" value={pnl.tax.creditPointsValue} />
                <Row sign="(+)" label="זיכוי פנסיה" value={pnl.tax.pensionCredit} />
                <Row sign="(-)" label="מס יסף" value={pnl.tax.surtax} />
                <Row sign="(-)" label="מס הכנסה נטו לתשלום" value={pnl.tax.netIncomeTax} strong />
                <Row sign="(-)" label="דמי ביטוח לאומי ומס בריאות" value={pnl.tax.bl.total} />
              </>}
            <Row sign="(=)" label="רווח נקי אחרי מס" value={pnl.net.afterTax} strong />
            {pnl.net.afterDividend != null && <Row sign="(=)" label="אחרי חלוקת דיבידנד" value={pnl.net.afterDividend} />}
          </tbody></table></div>
          <div className="ck-meta">
            בתקופה קצרה משנה, המדרגות השנתיות מוחלות על ההכנסה המשוערכת לשנה ואז מוקטנות חזרה לאורך התקופה. מע"מ עסקאות <bdi>{money(pnl.vat.out)}</bdi>, מע"מ תשומות מוכר <bdi>{money(pnl.vat.in)}</bdi>. נתוני עזר לרואה החשבון, לא דיווח.
          </div>
        </div>

        <div className="ck-card ck-stack">
          <div className="ck-title">מודל הכספות</div>
          <div className="ck-table-wrap"><table className="ck-table"><tbody>
            <tr><td>כספת מע"מ: יתרה לתשלום מתחילת השנה אחרי מה ששולם</td><td className="fin-ltr">{money(pnl.vaults.vatVault)}</td></tr>
            {vatPeriod && <tr><td>דוח המע"מ הדו חודשי הנוכחי, <bdi>{vatPeriod.from}</bdi> עד <bdi>{vatPeriod.to}</bdi>, לדיווח ולתשלום עד <bdi>{vatPeriod.due}</bdi>: עסקאות <bdi>{money(vatPeriod.out)}</bdi>, תשומות <bdi>{money(vatPeriod.in)}</bdi></td><td className="fin-ltr">{money(vatPeriod.payable)}</td></tr>}
            <tr><td>מס הכנסה: חבות <bdi>{money(pnl.vaults.incomeTaxDue)}</bdi> מול מקדמות <bdi>{money(pnl.vaults.incomeTaxPaid)}</bdi></td><td className="fin-ltr">{pnl.vaults.incomeTaxBalance >= 0 ? "לשריון: " : "החזר צפוי: "}{money(Math.abs(pnl.vaults.incomeTaxBalance))}</td></tr>
            <tr><td>ביטוח לאומי: חבות <bdi>{money(pnl.vaults.blDue)}</bdi> מול מקדמות <bdi>{money(pnl.vaults.blPaid)}</bdi></td><td className="fin-ltr">{pnl.vaults.blBalance >= 0 ? "לשריון: " : "החזר צפוי: "}{money(Math.abs(pnl.vaults.blBalance))}</td></tr>
            <tr><td><b>נטו אמיתי פנוי למשיכה</b></td><td className="fin-ltr"><b>{money(pnl.vaults.safeToSpend)}</b></td></tr>
          </tbody></table></div>
          <div className="ck-row"><button className="ck-btn" disabled={auditing} onClick={() => void runAudit()}>{auditing ? "מכינים דוח…" : "דוח מנהל כספים (AI)"}</button></div>
          {audit && <div className="ck-card" style={{ whiteSpace: "pre-wrap" }}>{audit}</div>}
        </div>
      </>}
    </div>
  );
}

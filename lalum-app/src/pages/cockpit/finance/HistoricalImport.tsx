import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { EXPENSE_CATEGORY, r2 } from "../../../lib/cockpit/finance";

const vatIncluded = (total: number) => r2((total * 18) / 118);

/**
 * One-time pilot catch-up: expenses for January, March, June and August 2026 found in the three
 * bookkeeping mailboxes and independently cross-checked against the underlying receipts (not just
 * the monthly summary emails sent to the bookkeeper). January's own summary email claimed an
 * attached report that does not actually exist, so every January row here was rebuilt from the
 * primary notices (Meta, Apple, invoice4u, Azrieli) found directly in the mailboxes, not from that
 * summary.
 *
 * What is NOT here, and why:
 * - The Anthropic, OpenRouter, MainFunc/Genspark and Airalo charges (USD) are left out. lalum_fin_expenses
 *   has no currency column, and the house rule for a foreign-currency document (see archiveRevenueEffect
 *   in finance.ts) is to convert at a rate actually on record, never a guessed one. No sourced NIS rate
 *   for these dates was reachable this round.
 * - The March "Link" invoice (142864) and the June UCO thesis fee, Haim Friedrich invoice 30151,
 *   and Google Ads/Wix charge: a real document exists for each, but no email gave a shekel amount.
 * - The August Azrieli rent (SI260200001644), Herzliya management fee (SI260210003176) and water
 *   charge (SI260210003188), and their four credit notes: these belong to the same-month lease
 *   termination and net out at or near zero, which lalum_fin_expenses cannot represent (total must
 *   be a positive number). They need the bookkeeper's own reconciliation, not an invented net figure.
 * - Cellcom Energy (377724412) and the Booking.com / Radisson Odesa charge: no invoice was found
 *   for either (the booking confirmation is not a tax invoice).
 * - January's Cellcom mobile invoice (period 14.12.2025 to 13.1.2026): the notification email carries
 *   only a binary PDF with no amount in the text, and no "charge notice" email with a figure was found
 *   this round. The Fiverr charge (thesis proofreading, ₪832.77) is left out as personal, by the same
 *   call made on the June UCO fee. The Azrieli water invoice (SI260210000489, ₪142.00) is dated 1.2.2026,
 *   so it belongs to February, not January, and the office is disputing that water charge outright.
 */
type Row = {
  spent_on: string; supplier: string; category: string; description: string;
  total: number; vat_amount: number; vat_recoverable_pct: number; ref: string; source: string;
};

const ROWS: Row[] = [
  { spent_on: "2026-01-03", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-31.12.2025 עד 3.1.2026",
    total: 482.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25694053963617651-25517579297931780", source: "הודעת תשלום Meta (לא חשבונית), 3.1.2026" },
  { spent_on: "2026-01-04", supplier: "Apple (iCloud+)", category: "SOFTWARE", description: "iCloud+ 50GB",
    total: 3.90, vat_amount: 0, vat_recoverable_pct: 100, ref: "MMQGH86D9J", source: "קבלת Apple, 4.1.2026" },
  { spent_on: "2026-01-04", supplier: "לינק ניהול תקשורת לעסקים", category: "COMMUNICATION", description: "",
    total: 58.73, vat_amount: vatIncluded(58.73), vat_recoverable_pct: 100, ref: "140179", source: "חשבונית מס קבלה, invoice4u, 4.1.2026" },
  { spent_on: "2026-01-06", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-2.1.2026 עד 6.1.2026",
    total: 510.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25600440132979036-25719991074357273", source: "הודעת תשלום Meta (לא חשבונית), 6.1.2026" },
  { spent_on: "2026-01-11", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-5.1.2026 עד 9.1.2026",
    total: 543.69, vat_amount: 0, vat_recoverable_pct: 100, ref: "25792394397116936-25681479828208391", source: "הודעת תשלום Meta (לא חשבונית), 11.1.2026" },
  { spent_on: "2026-01-13", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-11.1.2026 עד 13.1.2026",
    total: 539.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25699344813088565-25652460671110306", source: "הודעת תשלום Meta (לא חשבונית), 13.1.2026" },
  { spent_on: "2026-01-16", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-13.1.2026 עד 16.1.2026",
    total: 570.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25680322278324145-25808059798883733", source: "הודעת תשלום Meta (לא חשבונית), 16.1.2026" },
  { spent_on: "2026-01-21", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "שכירות 2/2026",
    total: 8530.00, vat_amount: 1301.19, vat_recoverable_pct: 100, ref: "SI260200000183", source: "חשבונית עזריאלי, 21.1.2026" },
  { spent_on: "2026-01-21", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "דמי ניהול 2/2026",
    total: 2341.00, vat_amount: 357.10, vat_recoverable_pct: 100, ref: "SI260210000338", source: "חשבונית עזריאלי, 21.1.2026" },
  { spent_on: "2026-01-30", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-15.1.2026 עד 30.1.2026",
    total: 603.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25761424516880590-25868210446201994", source: "הודעת תשלום Meta (לא חשבונית), 30.1.2026" },
  { spent_on: "2026-01-31", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-29.1.2026 עד 30.1.2026",
    total: 9.47, vat_amount: 0, vat_recoverable_pct: 100, ref: "25950878987935146-25891815013841542", source: "הודעת תשלום Meta (לא חשבונית), 31.1.2026" },

  { spent_on: "2026-03-04", supplier: "Apple (iCloud+)", category: "SOFTWARE", description: "iCloud+ 50GB",
    total: 3.90, vat_amount: 0, vat_recoverable_pct: 100, ref: "MMQGNH8X3H", source: "קבלת Apple, 4.3.2026" },

  { spent_on: "2026-06-13", supplier: "Gett", category: "TRAVEL", description: "נסיעה (לבדוק עסקי/פרטי)",
    total: 76.50, vat_amount: vatIncluded(76.50), vat_recoverable_pct: 100, ref: "", source: "קבלת Gett, 13.6.2026" },

  { spent_on: "2026-08-04", supplier: "Apple (iCloud+)", category: "SOFTWARE", description: "iCloud+ 50GB",
    total: 3.90, vat_amount: 0, vat_recoverable_pct: 100, ref: "MMQH3W25Z7", source: "קבלת Apple, 4.8.2026" },
  { spent_on: "2026-08-15", supplier: "Google One / AI Pro", category: "SOFTWARE", description: "מינוי AI Pro 5TB",
    total: 74.90, vat_amount: 0, vat_recoverable_pct: 100, ref: "SOP.3377-1494-8056", source: "קבלת Google Play, 15.8.2026" },
  { spent_on: "2026-08-05", supplier: "Gett", category: "TRAVEL", description: "נסיעה, ת\"א–הרצליה (לבדוק עסקי/פרטי)",
    total: 91.60, vat_amount: vatIncluded(91.60), vat_recoverable_pct: 100, ref: "", source: "קבלת Gett, 5.8.2026" },
  { spent_on: "2026-08-05", supplier: "Gett", category: "TRAVEL", description: "נסיעה, נתניה–בית יהושע (לבדוק עסקי/פרטי)",
    total: 46.70, vat_amount: vatIncluded(46.70), vat_recoverable_pct: 100, ref: "", source: "קבלת Gett, 5.8.2026" },
  { spent_on: "2026-08-03", supplier: "לינק ניהול תקשורת לעסקים", category: "COMMUNICATION", description: "",
    total: 58.87, vat_amount: vatIncluded(58.87), vat_recoverable_pct: 100, ref: "149750", source: "חשבונית מס קבלה, invoice4u" },
  { spent_on: "2026-08-04", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "חשמל סייטק 7/2026",
    total: 96.00, vat_amount: vatIncluded(96.00), vat_recoverable_pct: 100, ref: "SI260210002998", source: "חשבונית עזריאלי" },
  { spent_on: "2026-08-05", supplier: "ניהול חשבונות ישיר", category: "OFFICE", description: "שעון נוכחות",
    total: 53.00, vat_amount: vatIncluded(53.00), vat_recoverable_pct: 100, ref: "1094778", source: "חשבונית מס קבלה, invoice4u" },
  { spent_on: "2026-08-09", supplier: "חיים פרידריך עו\"ד", category: "OFFICE", description: "חשבון עסקה (אינו חשבונית מס, אין לנכות תשומות)",
    total: 389.00, vat_amount: 0, vat_recoverable_pct: 0, ref: "90048", source: "חשבון עסקה, ezcount" },
  { spent_on: "2026-08-14", supplier: "סלקום ישראל", category: "COMMUNICATION", description: "חיוב לתקופה 14.7–13.8",
    total: 216.77, vat_amount: vatIncluded(216.77), vat_recoverable_pct: 100, ref: "377532756", source: "הודעת חיוב סלקום, 20.8.2026" },
  { spent_on: "2026-08-17", supplier: "חיים פרידריך עו\"ד", category: "OFFICE", description: "סלקום 7/2026 + יתרת חוב",
    total: 943.00, vat_amount: vatIncluded(943.00), vat_recoverable_pct: 100, ref: "30158", source: "חשבונית מס קבלה, ezcount" },
  { spent_on: "2026-08-17", supplier: "חיים פרידריך עו\"ד", category: "OFFICE", description: "ארנונה (קבלה בלבד, אינה מזכה בניכוי תשומות)",
    total: 1635.00, vat_amount: 0, vat_recoverable_pct: 0, ref: "20010", source: "קבלה, ezcount" },
  { spent_on: "2026-08-23", supplier: "BF ביטחון", category: "COMMUNICATION", description: "אינטרנט למשרד",
    total: 1672.00, vat_amount: vatIncluded(1672.00), vat_recoverable_pct: 100, ref: "50183", source: "חשבונית מס" },
];

export function HistoricalImport({ firmId, onImported }: { firmId: string; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(ROWS);
  const [checked, setChecked] = useState<boolean[]>(() => ROWS.map(() => true));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const selectedCount = checked.filter(Boolean).length;

  async function importSelected() {
    if (!supabase) return;
    setBusy(true); setMsg(null);
    const picked = rows.filter((_, i) => checked[i]);
    const { error } = await supabase.from("lalum_fin_expenses").insert(
      picked.map((r) => ({
        firm_id: firmId, spent_on: r.spent_on, supplier: r.supplier, category: r.category,
        description: r.description.trim() || null, total: r.total, vat_amount: r.vat_amount,
        vat_recoverable_pct: r.vat_recoverable_pct, supplier_doc_ref: r.ref.trim() || null,
      })),
    );
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `יובאו ${picked.length} הוצאות.` });
    onImported();
    setDone(true);
  }

  if (!open) {
    return (
      <div className="ck-card">
        <div className="ck-row" style={{ justifyContent: "space-between" }}>
          <div className="ck-meta">ייבוא הוצאות היסטוריות מינואר, מרץ, יוני ואוגוסט 2026 (פיילוט), אומת מול המיילים המקוריים.</div>
          <button className="ck-btn" onClick={() => setOpen(true)}>פתיחה לבדיקה</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ck-card ck-stack">
      <div className="ck-title">ייבוא הוצאות היסטוריות (פיילוט)</div>
      <div className="ck-warn">
        הוצאות ב-דולר (Anthropic, OpenRouter, MainFunc/Genspark, Airalo) הושארו בצד: אין שדה מטבע בטבלה ואין שער המרה
        מתועד, ועדיף לא לייבא מאשר לנחש שער. שלוש חשבוניות עזריאלי/הרצליה שקוזזו באותו חודש בסיום השכירות, וזיכויי
        invoice4u/הרצליה (142864, אגרת UCO, חיים פרידריך 30151, Wix/Google Ads) חסרי סכום מאומת, הושארו גם הם בצד. מינואר:
        חשבונית הסלקום החודשית, שירות Fiverr לתיקון עבודת תזה (פרטי, לא עסקי) וחשבונית המים של עזריאלי (SI260210000489,
        מתוארכת 1.2.2026 ותחת מחלוקת של המשרד) הושארו בצד גם הם.
      </div>
      <div className="ck-table-wrap">
        <table className="ck-table" data-cards="off">
          <thead><tr><th></th><th>תאריך</th><th>ספק</th><th>קטגוריה</th><th>תיאור</th><th className="fin-num">סכום</th><th className="fin-num">מע"מ</th><th>מקור</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input type="checkbox" checked={checked[i]} onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} /></td>
                <td><input className="ck-input" type="date" value={r.spent_on} onChange={(e) => setRow(i, { spent_on: e.target.value })} /></td>
                <td className="fin-text">{r.supplier}</td>
                <td><select className="ck-select" value={r.category} onChange={(e) => setRow(i, { category: e.target.value })}>{Object.entries(EXPENSE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td className="fin-text">{r.description}</td>
                <td className="fin-num"><input className="ck-input" dir="ltr" inputMode="decimal" style={{ width: 80, minWidth: 80 }} value={r.total} onChange={(e) => setRow(i, { total: Number(e.target.value) || 0 })} /></td>
                <td className="fin-num"><input className="ck-input" dir="ltr" inputMode="decimal" style={{ width: 70, minWidth: 70 }} value={r.vat_amount} onChange={(e) => setRow(i, { vat_amount: Number(e.target.value) || 0 })} /></td>
                <td className="ck-meta">{r.source}{r.ref ? ` · ${r.ref}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
      <div className="ck-row">
        <button className="ck-btn primary" disabled={busy || selectedCount === 0} onClick={() => void importSelected()}>
          {busy ? "מייבאים…" : `ייבוא ${selectedCount} הוצאות שנבחרו`}
        </button>
        <button className="ck-btn" onClick={() => setOpen(false)}>סגירה</button>
      </div>
    </div>
  );
}

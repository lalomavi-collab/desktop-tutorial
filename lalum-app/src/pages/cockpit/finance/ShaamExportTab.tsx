import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { buildShaamReport, LALUM_TAX_ID } from "../../../lib/cockpit/shaamExport";
import type { FinCustomer, FinDocument } from "../../../lib/cockpit/finance";
import { addressOn, loadBusiness } from "../../../lib/cockpit/businessProfile";
import type { BusinessAddress, BusinessProfile } from "../../../lib/cockpit/businessProfile";

// The uniform-structure file is filed quarterly (the owner's own cadence, matching how Invoice4U's
// equivalent screen already works: a period and an e-mail, then "produce"). Default to the quarter
// that just ended, since a real filing is always for a completed period, never the one in progress.
function lastQuarter(): { from: string; to: string } {
  const now = new Date();
  const curStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const from = new Date(curStart.getFullYear(), curStart.getMonth() - 3, 1);
  const to = new Date(curStart.getFullYear(), curStart.getMonth(), 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function ShaamExportTab({ docs, customers, firmName, firmId }: { docs: FinDocument[]; customers: FinCustomer[]; firmName: string; firmId: string }) {
  const q = lastQuarter();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [addresses, setAddresses] = useState<BusinessAddress[]>([]);
  useEffect(() => { void loadBusiness(firmId).then((b) => { setProfile(b.profile); setAddresses(b.addresses); }); }, [firmId]);
  const [from, setFrom] = useState(q.from);
  const [to, setTo] = useState(q.to);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ counts: Record<string, number> } | null>(null);

  // Only SEALED documents are reportable: the own engine's number-and-seal step (lalum_fin_seal_document)
  // only reaches SEALING today, since the Tax Authority edge function is deliberately not built yet
  // (finance-engine-design.md). Until that is live, this will correctly find nothing to export: Invoice4U
  // is still the real issuer and already files its own uniform-structure file for this period.
  const sealed = docs.filter((d) => d.status === "SEALED" && d.issue_date >= from && d.issue_date <= to);

  function run() {
    setError(""); setDone(null);
    if (from > to) { setError("טווח התאריכים לא תקין."); return; }
    const customersById: Record<string, FinCustomer> = {};
    for (const c of customers) customersById[c.id] = c;
    try {
      const { iniText, dataText, counts } = buildShaamReport(
        {
          taxId: profile?.taxId ?? LALUM_TAX_ID, name: profile?.legalName ?? firmName, softwareRegNumber: profile?.softwareRegNumber,
          address: ((a) => (a ? { street: a.street, houseNum: a.houseNum, city: a.city, zip: a.zip } : undefined))(addressOn(addresses, "FINANCE", to)),
          taxYear: from.slice(0, 4), periodStart: from, periodEnd: to,
        },
        sealed,
        customersById,
      );
      download("INI.TXT", iniText);
      download("BKMVDATA.TXT", dataText);
      void supabase?.rpc("lalum_fin_log_export", { p_kind: "shaam_uniform_format", p_meta: { from, to, counts } });
      setDone({ counts });
    } catch (e) {
      setError(e instanceof Error ? e.message : "הייצוא נכשל.");
    }
  }

  return (
    <div className="ck-stack">
      <div className="ck-ok">
        קובץ מבנה אחיד (שע"ם) לתקופה הנבחרת, ממסמכים שהופקו ונחתמו כבר במערכת זו (SEALED) בלבד. כל עוד ההפקה
        בפועל עוברת ב-Invoice4U, הרשימה כאן תהיה ריקה בכוונה: Invoice4U מגיש כבר קובץ מבנה אחיד משלו לתקופה הזו,
        ואין לדווח פעמיים על אותם מסמכים.
      </div>
      <div className="ck-card ck-stack">
        <div className="ck-title">הפקת קובץ</div>
        <div className="ck-grid2">
          <label className="ck-field">מתאריך<input className="ck-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="ck-field">עד תאריך<input className="ck-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="ck-meta">{sealed.length} מסמכים חתומים בטווח שנבחר.</div>
        <div className="ck-row">
          <button className="ck-btn primary" disabled={from > to} onClick={run}>הפקת INI.TXT ו-BKMVDATA.TXT</button>
        </div>
        {error && <div className="ck-err" aria-live="polite">{error}</div>}
        {done && (
          <div className="ck-ok" aria-live="polite">
            הקבצים הורדו. רשומות: {Object.entries(done.counts).map(([k, v]) => `${k} ${v}`).join(", ")}.
            לפני כל שימוש בפועל: הריצו את הקובץ דרך בודק הקבצים הרשמי של רשות המסים (misim.gov.il). מעבר
            ל-round trip שעובר כאן דרך הפרסר של החבילה עצמה (<code>npm run shaam-check</code>), אין לכך תחליף.
          </div>
        )}
      </div>
    </div>
  );
}

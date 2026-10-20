import { useState } from "react";
import type { Membership } from "../../lib/cockpit/shared";
import { exportErrorText } from "../../lib/cockpit/firmExportCore.ts";
import { exportFirmPackage } from "../../lib/cockpit/firmExport";
import { CockpitFrame } from "./CockpitFrame";

type Result = { ok: boolean; text: string; warn?: string[] };

function Body({ member }: { member: Membership }) {
  const partner = ["FIRM_PARTNER", "ADMIN"].includes(member.role);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);

  async function run() {
    if (!window.confirm("לייצא את כל נתוני המשרד לקובץ אחד? הקובץ כולל נתונים פיננסיים ונתוני תיקים, והפעולה נרשמת ביומן הביקורת.")) return;
    setBusy(true); setRes(null); setProgress("מכין...");
    try {
      const built = await exportFirmPackage(member.firm_id, (done, total, table) => setProgress(table ? `קורא ${done + 1} מתוך ${total}` : "מאמת וארוז"));
      const warn: string[] = [];
      if (!built.manifest.chain.verified) warn.push("שרשרת יומן הביקורת נמצאה שבורה בעת הייצוא. יש לבדוק לפני כל הסתמכות עליה.");
      if (!built.handoverComplete) warn.push(`המסמכים המקוריים (${built.manifest.originals.count}) אינם כלולים בקובץ. עד שיימסרו, החבילה אינה שלמה למסירה.`);
      setRes({ ok: true, text: "הקובץ ירד. כל קובץ בתוכו אומת מול החתימה שנרשמה במסד הנתונים.", warn });
    } catch (e) {
      const denied = /FORBIDDEN|MANIFEST/.test(String((e as Error)?.message ?? ""));
      setRes({ ok: false, text: denied ? "אין הרשאה לייצוא. נדרשים שותף או מנהל המשרד, אימות דו שלבי והרשאה פיננסית." : exportErrorText(e) });
    } finally { setBusy(false); setProgress(null); }
  }

  if (!partner) return <div className="ck-card"><div className="ck-meta">הייצוא זמין לשותפים ולמנהלי המשרד בלבד.</div></div>;
  return (
    <div className="ck-stack">
      <div className="ck-card">
        <div className="ck-meta">חבילה אחת עם כל נתוני המשרד, לקראת מסירה בסגירת משרד או לגיבוי: תיקים, מסמכים, כספים, נאמנות, זמן, חתימות ויומן הביקורת. כל קובץ בחבילה מגיע עם חתימת SHA-256 שאפשר לאמת בלי לסמוך על הפלטפורמה.</div>
        <div className="ck-meta">לא כלולים: אישורי גישה, חיבורי מס, תורי משלוח ורישומים פנימיים של הפלטפורמה. הרשימה המלאה, עם הסיבה, בקובץ README שבחבילה.</div>
        <div className="ck-meta">המסמכים המקוריים אינם כלולים עדיין. הקובץ יציין זאת במפורש.</div>
        <button className="ck-btn primary" disabled={busy} onClick={() => void run()}>{busy ? (progress ?? "מכין...") : "ייצוא כל נתוני המשרד (ZIP)"}</button>
      </div>
      {res && (
        <div className="ck-card" aria-live="polite">
          <div className={res.ok ? "ck-ok" : "ck-err"}>{res.text}</div>
          {res.warn?.map((w) => <div key={w} className="ck-meta">{w}</div>)}
        </div>
      )}
    </div>
  );
}

export function FirmExport() {
  return (
    <CockpitFrame title="ייצוא נתוני המשרד" description="חבילת מסירה מאומתת של כל נתוני המשרד." path="/workspace/export">
      {({ member }) => (member ? <Body member={member} /> : null)}
    </CockpitFrame>
  );
}

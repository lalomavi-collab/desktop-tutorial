import { useState } from "react";
import type { Membership } from "../../lib/cockpit/shared";
import { ExportError, exportErrorText, manifestErrorText } from "../../lib/cockpit/firmExportCore.ts";
import { exportFirmPackage, exportOriginalsEnabled } from "../../lib/cockpit/firmExport";
import { CockpitFrame } from "./CockpitFrame";

type Result = { ok: boolean; text: string; warn?: string[] };

function Body({ member }: { member: Membership }) {
  const partner = ["FIRM_PARTNER", "ADMIN"].includes(member.role);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);

  async function run() {
    if (!window.confirm("לייצא את כל נתוני הפירמה? הקובץ כולל נתונים פיננסיים ונתוני תיקים, והפעולה נרשמת ביומן הביקורת.")) return;
    setBusy(true); setRes(null); setProgress("מכין...");
    try {
      const built = await exportFirmPackage(
        member.firm_id,
        (done, total, table) => setProgress(table ? `קורא טבלה ${done + 1} מתוך ${total}` : "מאמת"),
        (done, total) => setProgress(`מוריד מקורי ${done} מתוך ${total}`),
        (index, last) => { if (!last) setProgress(`קובץ ZIP ${index} ירד, ממשיך`); });
      const warn: string[] = [];
      if (!built.manifest.chain.verified) warn.push("שרשרת יומן הביקורת נמצאה שבורה בעת הייצוא. יש לבדוק לפני כל הסתמכות עליה.");
      const o = built.originals;
      if (!built.handoverComplete) {
        if (!o) warn.push(`המסמכים המקוריים (${built.manifest.originals.count}) אינם כלולים בקובץ. עד שיימסרו, החבילה אינה שלמה למסירה.`);
        else if (o.listError === "TOO_LARGE") warn.push(`נפח המסמכים המקוריים (${Math.round(built.manifest.originals.bytes / 1024 / 1024 / 1024)} GB) גדול מדי לייצוא מהדפדפן, והם אינם כלולים. יש לבקש מסירה של המקוריים בנפרד. החבילה אינה שלמה למסירה.`);
        else if (o.listError) warn.push(`קבלת המסמכים המקוריים (${built.manifest.originals.count}) נכשלה, והם אינם כלולים בקובץ. כדאי לנסות שוב. החבילה אינה שלמה למסירה.`);
        else warn.push(`נכללו ${o.filesInZip} מתוך ${built.manifest.originals.count} מסמכים מקוריים, ומהם אומתו ${o.verified}. הפירוט ב-PACKAGE.json. החבילה אינה שלמה למסירה.`);
      }
      if (built.volumes > 1) warn.push(`החבילה ירדה כ-${built.volumes} קבצי ZIP (part-01 עד part-${String(built.volumes).padStart(2, "0")}). הטבלאות, PACKAGE.json וה-README נמצאים בקובץ האחרון. יש לשמור את כולם יחד: חבילה שחסר בה קובץ אינה שלמה. אם הדפדפן ביקש אישור להורדות מרובות, יש לאשר.`);
      const what = built.volumes > 1 ? "הקבצים ירדו" : "הקובץ ירד";
      setRes({ ok: true, text: built.handoverComplete ? `${what}. כל קובץ בתוכם אומת מול החתימה שנרשמה במסד הנתונים.` : `${what}. קבצי הטבלאות אומתו מול החתימה שנרשמה במסד הנתונים. ראו את ההערה שלמטה.`, warn });
    } catch (e) {
      // A plain Error from outside the package builder (a network failure inside the browser) has no code; its text still says whether it was a permission.
      const text = e instanceof Error && !(e instanceof ExportError) ? manifestErrorText(e.message) : exportErrorText(e);
      setRes({ ok: false, text });
    } finally { setBusy(false); setProgress(null); }
  }

  if (!partner) return <div className="ck-card"><div className="ck-meta">הייצוא זמין לשותפים ולמנהלי הפירמה בלבד.</div></div>;
  return (
    <div className="ck-stack">
      <div className="ck-card">
        <div className="ck-meta">חבילה אחת עם כל נתוני הפירמה, לקראת מסירה בסגירת פירמה או לגיבוי: תיקים, מסמכים, כספים, נאמנות, זמן, חתימות ויומן הביקורת. כל קובץ בחבילה מגיע עם חתימת SHA-256 שאפשר לאמת בלי לסמוך על הפלטפורמה.</div>
        <div className="ck-meta">לא כלולים: אישורי גישה, חיבורי מס, תורי משלוח ורישומים פנימיים של הפלטפורמה. הרשימה המלאה, עם הסיבה, בקובץ README שבחבילה.</div>
        <div className="ck-meta">{exportOriginalsEnabled()
          ? "המסמכים המקוריים נכללים בקובץ, כל אחד מאומת מול החתימה והגודל שנרשמו. הייצוא עשוי לקחת כמה דקות. חבילה גדולה מ-256 MB מתחלקת למספר קבצי ZIP, כדי שהדפדפן לא יחזיק הכול בזיכרון."
          : "המסמכים המקוריים אינם כלולים עדיין. הקובץ יציין זאת במפורש."}</div>
        <button className="ck-btn primary" disabled={busy} onClick={() => void run()}>{busy ? (progress ?? "מכין...") : "ייצוא כל נתוני הפירמה (ZIP)"}</button>
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
    <CockpitFrame title="ייצוא נתוני הפירמה" description="חבילת מסירה מאומתת של כל נתוני הפירמה." path="/workspace/export">
      {({ member }) => (member ? <Body member={member} /> : null)}
    </CockpitFrame>
  );
}

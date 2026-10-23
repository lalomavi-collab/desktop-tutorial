import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { verifyCode } from "../../lib/cockpit/mfa";
import type { Membership } from "../../lib/cockpit/shared";
import { ExportError, exportErrorText, manifestErrorText } from "../../lib/cockpit/firmExportCore.ts";
import { exportFirmPackage, exportOriginalsEnabled, exportStatus } from "../../lib/cockpit/firmExport";
import { CockpitFrame } from "./CockpitFrame";

type Result = { ok: boolean; text: string; warn?: string[] };

function Body({ member }: { member: Membership }) {
  const partner = ["FIRM_PARTNER", "ADMIN"].includes(member.role);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [stepUp, setStepUp] = useState<{ factors: { id: string; name: string }[] } | "enroll" | null>(null);
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  /** The export needs a second factor entered in the last 10 minutes (0080). Ask the server first; if a code is due, show the code box instead of starting. */
  async function begin() {
    setRes(null); setCodeErr(null); setConfirming(false);
    const st = await exportStatus(member.firm_id);
    if (!st) { setRes({ ok: false, text: "לא ניתן היה לבדוק את ההרשאה לייצוא. יש לרענן את הדף, להתחבר מחדש ולנסות שוב." }); return; }
    if (!st.eligible) { setRes({ ok: false, text: "אין הרשאה לייצוא. נדרשים שותף או מנהל הפירמה והרשאה פיננסית." }); return; }
    // A fresh factor skips the code, so this click alone would start the export. Ask on the page: a native confirm() is invisible to browser automation, which accepts it silently (22.10).
    if (st.fresh) { setStepUp(null); setConfirming(true); return; }
    const f = await supabase!.auth.mfa.listFactors();
    const verified = (f.data?.totp ?? []).filter((x) => x.status === "verified").sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    if (verified.length === 0) { setStepUp("enroll"); return; }
    const factors = verified.map((x) => ({ id: x.id, name: x.friendly_name ?? "TOTP" }));
    setFactorId(factors[0].id); setStepUp({ factors });
  }
  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true); setCodeErr(null);
    const err = await verifyCode(factorId, code);
    if (err) { setBusy(false); setCodeErr(err); return; }
    setCode("");
    const st = await exportStatus(member.firm_id);
    setBusy(false);
    if (!st?.fresh) { setCodeErr("הקוד אומת, אך השרת לא קלט אותו. יש לרענן את הדף ולנסות שוב."); return; }
    setStepUp(null);
    await run();
  }

  async function run() {
    setConfirming(false);
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
        <div className="ck-meta">הייצוא דורש קוד אימות דו שלבי בן 6 ספרות שהוזן בעשר הדקות שלפניו, גם אם אתם כבר מחוברים.</div>
        <button className="ck-btn primary" disabled={busy} onClick={() => void begin()}>{busy ? (progress ?? "מכין...") : "ייצוא כל נתוני הפירמה (ZIP)"}</button>
      </div>
      {confirming && (
        <div className="ck-card" role="alertdialog" aria-labelledby="export-confirm-title" aria-describedby="export-confirm-text">
          <div className="ck-title" id="export-confirm-title">לייצא את כל נתוני הפירמה?</div>
          <div className="ck-meta" id="export-confirm-text">הקובץ כולל נתונים פיננסיים ונתוני תיקים, והפעולה נרשמת ביומן הביקורת.</div>
          <div className="ck-row">
            <button type="button" className="ck-btn primary" disabled={busy} onClick={() => void run()}>כן, לייצא</button>
            <button type="button" className="ck-btn" disabled={busy} autoFocus onClick={() => setConfirming(false)}>ביטול</button>
          </div>
        </div>
      )}
      {stepUp === "enroll" && (
        <div className="ck-card"><div className="ck-err">אין לחשבון אימות דו שלבי פעיל, ובלעדיו אי אפשר לייצא. יש להפעיל אותו ב<Link to="/settings/security">אבטחת חשבון</Link> ולחזור לכאן.</div></div>
      )}
      {stepUp && stepUp !== "enroll" && (
        <form className="ck-card mfa-box" onSubmit={(e) => void submitCode(e)}>
          <div className="ck-title">אימות לפני ייצוא</div>
          <div className="ck-meta">הזינו את הקוד בן 6 הספרות מאפליקציית האימות. אחרי האימות הייצוא יתחיל, ויהיה תקף עשר דקות.</div>
          {stepUp.factors.length > 1 && (
            <div className="ck-row" style={{ flexWrap: "wrap" }}>
              {stepUp.factors.map((f) => (
                <button type="button" key={f.id} className={"ck-btn" + (f.id === factorId ? " primary" : "")} onClick={() => { setFactorId(f.id); setCodeErr(null); }}>{f.name}</button>
              ))}
            </div>
          )}
          <label className="mfa-label" htmlFor="export-code">קוד בן 6 ספרות</label>
          <input id="export-code" className="field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" aria-label="קוד אימות" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          {codeErr && <div className="ck-err" aria-live="polite">{codeErr}</div>}
          <div className="ck-row">
            <button className="ck-btn primary" disabled={busy || code.length !== 6}>{busy ? "מאמת..." : "אימות והתחלת ייצוא"}</button>
            <button type="button" className="ck-btn" disabled={busy} onClick={() => { setStepUp(null); setCode(""); setCodeErr(null); }}>ביטול</button>
          </div>
        </form>
      )}
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

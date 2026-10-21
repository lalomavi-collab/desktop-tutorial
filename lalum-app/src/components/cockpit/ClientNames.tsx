import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { casualLabel, customerLabel, displayName, idleExpired, maskedText, matchesQuery, reasonError, reasonLabel, REVEAL_REASONS, REASON_NOTE_MAX, type CustomerLike, type Named, type RevealReasonCode } from "../../lib/cockpit/clientNames";

export interface RevealReason { code: RevealReasonCode; note: string }
type HideHow = "USER" | "IDLE" | "AWAY";
interface Ctx {
  canReveal: boolean; revealed: boolean;
  /** Why the names are on screen now, and whether the database recorded it (false until migration 0072 is applied). */
  reason: RevealReason | null; reasonRecorded: boolean;
  reveal: (code: string, note: string) => Promise<string | null>; hide: () => void;
  name: (m: Named | null | undefined) => string; match: (m: Named, q: string) => boolean; text: (t: string | null | undefined) => string;
  /** A customer in the bookkeeping screens: the name while revealed, a neutral label (the invoicing number) while hidden. */
  customer: (c: CustomerLike | null | undefined) => string;
  /** A free typed customer name (a casual customer, an archived document). */
  casual: (text: string | null | undefined) => string;
}

/** Without a provider the safe state applies: hidden, and no way to reveal. */
const NONE: Ctx = { canReveal: false, revealed: false, reason: null, reasonRecorded: true, reveal: async () => "לא זמין", hide: () => {}, name: (m) => displayName(false, m), match: (m, q) => matchesQuery(false, m, q), text: (t) => maskedText(false, t), customer: (c) => customerLabel(false, c), casual: (t) => casualLabel(false, t) };
const C = createContext<Ctx>(NONE);
export const useClientNames = (): Ctx => useContext(C);

/** Memory only: nothing is stored, so a reload, a new tab or a locked screen starts hidden. */
export function ClientNamesProvider({ children }: { children: ReactNode }) {
  const [canReveal, setCanReveal] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reason, setReason] = useState<RevealReason | null>(null);
  const [reasonRecorded, setReasonRecorded] = useState(true);
  const last = useRef(Date.now());
  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data, error } = await supabase.rpc("lalum_can_see_client_names");
      if (live) setCanReveal(!error && data === true);
    })();
    return () => { live = false; };
  }, []);
  /** Ends the window and writes its end to the log (best effort: hiding never fails because the log did). */
  const endWindow = useCallback((how: HideHow) => {
    setRevealed(false); setReason(null);
    if (supabase && reasonRecorded) void supabase.rpc("lalum_hide_client_names", { p_how: how }).then(() => undefined, () => undefined);
  }, [reasonRecorded]);
  const hide = useCallback(() => endWindow("USER"), [endWindow]);
  const reveal = useCallback(async (code: string, note: string): Promise<string | null> => {
    const bad = reasonError(code, note);
    if (bad) return bad;
    if (!supabase) return "לא זמין";
    const clean = note.trim();
    let recorded = true;
    let { error } = await supabase.rpc("lalum_reveal_client_names", { p_reason_code: code, p_note: clean || null });
    // Database not yet on migration 0072: the old call (no reason argument) still logs the reveal, without the reason.
    if (error && (error.code === "PGRST202" || /could not find the function/i.test(error.message ?? ""))) {
      recorded = false;
      ({ error } = await supabase.rpc("lalum_reveal_client_names"));
    }
    if (error) return /reason|note too long/i.test(error.message ?? "") ? "הסיבה לא התקבלה. בדקו אותה ונסו שוב." : /e-mail|personal/i.test(error.message ?? "") ? "ההערה כוללת כתובת דוא\"ל או פרט אישי. נסחו בלי שמות ופרטי קשר." : "אין הרשאה להצגת שמות, או שנדרש אימות דו שלבי.";
    last.current = Date.now(); setReasonRecorded(recorded); setReason({ code: code as RevealReasonCode, note: clean }); setRevealed(true); return null;
  }, []);
  useEffect(() => {
    if (!revealed) return;
    const touch = () => { last.current = Date.now(); };
    const away = () => { if (document.visibilityState === "hidden") endWindow("AWAY"); };
    const tick = window.setInterval(() => { if (idleExpired(last.current, Date.now())) endWindow("IDLE"); }, 15000);
    const evs = ["pointerdown", "keydown", "scroll"] as const;
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", away);
    return () => { window.clearInterval(tick); evs.forEach((e) => window.removeEventListener(e, touch)); document.removeEventListener("visibilitychange", away); };
  }, [revealed, endWindow]);
  const value = useMemo<Ctx>(() => ({ canReveal, revealed, reason, reasonRecorded, reveal, hide, name: (m) => displayName(revealed, m), match: (m, q) => matchesQuery(revealed, m, q), text: (t) => maskedText(revealed, t), customer: (c) => customerLabel(revealed, c), casual: (t) => casualLabel(revealed, t) }), [canReveal, revealed, reason, reasonRecorded, reveal, hide]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** The control in the page header, on every cockpit screen (bookkeeping included): always says which state the screen is in. Showing names asks for a reason, and the reason is what the log keeps. */
export function ClientNamesToggle() {
  const { canReveal, revealed, reason, reasonRecorded, reveal, hide } = useClientNames();
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState<string>("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canReveal) return <span className="ck-chip" title="שמות הלקוחות מוסתרים. הצגתם מותרת לשותף או לעורך דין עם אימות דו שלבי.">שמות לקוחות מוסתרים</span>;
  const close = () => { setAsking(false); setCode(""); setNote(""); setMsg(""); };
  const submit = async () => {
    setBusy(true); const e = await reveal(code, note); setBusy(false);
    if (e) setMsg(e); else close();
  };
  if (asking && !revealed) {
    return (
      <form className="ck-row" style={{ gap: 8, flexWrap: "wrap" }} role="group" aria-label="סיבה להצגת שמות לקוחות" onSubmit={(ev) => { ev.preventDefault(); void submit(); }}>
        <select className="ck-select" aria-label="סיבה להצגת השמות" value={code} onChange={(e) => { setCode(e.target.value); setMsg(""); }} style={{ maxWidth: 230 }}>
          <option value="">למה להציג שמות? (חובה)</option>
          {REVEAL_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <input className="ck-input" aria-label="פירוט הסיבה" placeholder={code === "OTHER" ? "פירוט (חובה), בלי שם לקוח" : "פירוט (לא חובה), בלי שם לקוח"} maxLength={REASON_NOTE_MAX} value={note} onChange={(e) => { setNote(e.target.value); setMsg(""); }} style={{ maxWidth: 260 }} />
        <button type="submit" className="ck-btn primary" disabled={busy || !code}>הצגה ורישום ביומן</button>
        <button type="button" className="ck-btn" onClick={close}>ביטול</button>
        {msg && <span className="ck-err" role="alert">{msg}</span>}
      </form>
    );
  }
  return (
    <span className="ck-row" style={{ gap: 8, flexWrap: "wrap" }}>
      <span className={`ck-chip${revealed ? " warn" : ""}`} role="status">
        {revealed ? `שמות לקוחות מוצגים${reason ? ` · ${reasonLabel(reason.code)}${reason.code === "OTHER" && reason.note ? `: ${reason.note}` : ""}` : ""}` : "שמות לקוחות מוסתרים"}
        {revealed && !reasonRecorded ? " · הסיבה לא נרשמה ביומן (עדכון מסד הנתונים ממתין)" : ""}
      </span>
      <button type="button" className="ck-btn" aria-pressed={revealed} onClick={() => { if (revealed) hide(); else setAsking(true); }}>
        {revealed ? "הסתרת השמות" : "הצגת שמות (נרשם ביומן)"}
      </button>
    </span>
  );
}

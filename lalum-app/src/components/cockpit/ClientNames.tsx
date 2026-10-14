import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { displayName, idleExpired, maskedText, matchesQuery, type Named } from "../../lib/cockpit/clientNames";

interface Ctx { canReveal: boolean; revealed: boolean; reveal: () => Promise<string | null>; hide: () => void; name: (m: Named | null | undefined) => string; match: (m: Named, q: string) => boolean; text: (t: string | null | undefined) => string }

/** Without a provider the safe state applies: hidden, and no way to reveal. */
const NONE: Ctx = { canReveal: false, revealed: false, reveal: async () => "לא זמין", hide: () => {}, name: (m) => displayName(false, m), match: (m, q) => matchesQuery(false, m, q), text: (t) => maskedText(false, t) };
const C = createContext<Ctx>(NONE);
export const useClientNames = (): Ctx => useContext(C);

/** Memory only: nothing is stored, so a reload, a new tab or a locked screen starts hidden. */
export function ClientNamesProvider({ children }: { children: ReactNode }) {
  const [canReveal, setCanReveal] = useState(false);
  const [revealed, setRevealed] = useState(false);
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
  const hide = useCallback(() => setRevealed(false), []);
  const reveal = useCallback(async (): Promise<string | null> => {
    if (!supabase) return "לא זמין";
    const { error } = await supabase.rpc("lalum_reveal_client_names");
    if (error) return "אין הרשאה להצגת שמות, או שנדרש אימות דו שלבי.";
    last.current = Date.now(); setRevealed(true); return null;
  }, []);
  useEffect(() => {
    if (!revealed) return;
    const touch = () => { last.current = Date.now(); };
    const away = () => { if (document.visibilityState === "hidden") setRevealed(false); };
    const tick = window.setInterval(() => { if (idleExpired(last.current, Date.now())) setRevealed(false); }, 15000);
    const evs = ["pointerdown", "keydown", "scroll"] as const;
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", away);
    return () => { window.clearInterval(tick); evs.forEach((e) => window.removeEventListener(e, touch)); document.removeEventListener("visibilitychange", away); };
  }, [revealed]);
  const value = useMemo<Ctx>(() => ({ canReveal, revealed, reveal, hide, name: (m) => displayName(revealed, m), match: (m, q) => matchesQuery(revealed, m, q), text: (t) => maskedText(revealed, t) }), [canReveal, revealed, reveal, hide]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** The control in the page header: always says which state the screen is in. */
export function ClientNamesToggle() {
  const { canReveal, revealed, reveal, hide } = useClientNames();
  const [msg, setMsg] = useState("");
  if (!canReveal) return <span className="ck-chip" title="שמות הלקוחות מוסתרים. הצגתם מותרת לשותף או לעורך דין עם אימות דו שלבי.">שמות לקוחות מוסתרים</span>;
  return (
    <span className="ck-row" style={{ gap: 8 }}>
      <span className={`ck-chip${revealed ? " warn" : ""}`} role="status">{revealed ? "שמות לקוחות מוצגים" : "שמות לקוחות מוסתרים"}</span>
      <button type="button" className="ck-btn" aria-pressed={revealed} onClick={() => { if (revealed) { hide(); setMsg(""); } else void reveal().then((e) => setMsg(e ?? "")); }}>
        {revealed ? "הסתרת השמות" : "הצגת שמות (נרשם ביומן)"}
      </button>
      {msg && <span className="ck-err" role="alert">{msg}</span>}
    </span>
  );
}

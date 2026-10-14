import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

export type MfaFactor = { id: string; name: string };
export type MfaState = { state: "loading" } | { state: "ok" } | { state: "challenge"; factorId: string; factors: MfaFactor[] } | { state: "enroll" } | { state: "unavailable" };

/** Where the session stands against the TOTP second factor (Supabase assurance levels). */
export function useMfaState(): { mfa: MfaState; refresh: () => Promise<void> } {
  const [mfa, setMfa] = useState<MfaState>({ state: "loading" });
  const refresh = useCallback(async () => {
    if (!supabase) { setMfa({ state: "unavailable" }); return; }
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) { setMfa({ state: "unavailable" }); return; }
    if (data.currentLevel === "aal2") { setMfa({ state: "ok" }); return; }
    if (data.nextLevel === "aal2") {
      const f = await supabase.auth.mfa.listFactors();
      const verified = (f.data?.totp ?? []).filter((x) => x.status === "verified");
      if (verified.length === 0) { setMfa({ state: "enroll" }); return; }
      // The challenge used to take whatever factor listFactors() returned
      // first, which is not necessarily the one live in the visitor's current
      // authenticator app: re-enrolling (a new phone, a reinstalled app)
      // leaves the old factor "verified" too, and its code never matches the
      // new one. The most recently created factor is the one most likely to
      // still be live, so it goes first; if more than one factor exists the
      // visitor can also pick explicitly, rather than guess which is current.
      const sorted = [...verified].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      const factors: MfaFactor[] = sorted.map((x) => ({ id: x.id, name: x.friendly_name ?? "TOTP" }));
      setMfa({ state: "challenge", factorId: factors[0].id, factors });
      return;
    }
    setMfa({ state: "enroll" });
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { mfa, refresh };
}

/** Challenge and verify a 6 digit code. Returns an error text, or null on success. */
export async function verifyCode(factorId: string, code: string): Promise<string | null> {
  if (!supabase) return "אין חיבור.";
  const c = await supabase.auth.mfa.challenge({ factorId });
  if (c.error || !c.data) return "לא ניתן להתחיל אימות.";
  const v = await supabase.auth.mfa.verify({ factorId, challengeId: c.data.id, code: code.trim() });
  if (!v.error) return null;
  // Tell a wrong code apart from a failure that more typing cannot fix, so a
  // locked-out admin is not left guessing codes against a rate limit or a dead network.
  const status = (v.error as { status?: number }).status;
  if (v.error.name === "AuthRetryableFetchError" || status === 0) return "אין חיבור לשרת. בדקו את הרשת ונסו שוב.";
  if (status === 429) return "יותר מדי ניסיונות. המתינו כמה דקות ונסו שוב.";
  return "הקוד שגוי או שפג תוקפו. בדקו שהשעה בטלפון מוגדרת אוטומטית.";
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

export type MfaState = { state: "loading" } | { state: "ok" } | { state: "challenge"; factorId: string } | { state: "enroll" } | { state: "unavailable" };

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
      const factor = f.data?.totp?.[0];
      setMfa(factor ? { state: "challenge", factorId: factor.id } : { state: "enroll" });
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
  return v.error ? "הקוד שגוי או שפג תוקפו." : null;
}

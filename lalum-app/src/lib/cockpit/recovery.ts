import { supabase } from "../supabase";

/** Mint a fresh set of one-time recovery codes (needs an aal2 session). Plain text is returned once. */
export async function generateRecoveryCodes(): Promise<{ codes: string[] | null; error: string | null }> {
  if (!supabase) return { codes: null, error: "אין חיבור." };
  const { data, error } = await supabase.functions.invoke("lalum-mfa-recovery", { body: { action: "generate" } });
  if (error || !Array.isArray(data?.codes)) return { codes: null, error: "לא ניתן להפיק קודי שחזור כרגע." };
  return { codes: data.codes as string[], error: null };
}

/** Spend one recovery code: removes the lost authenticator so a new one can be enrolled. */
export async function redeemRecoveryCode(code: string): Promise<string | null> {
  if (!supabase) return "אין חיבור.";
  const { data, error } = await supabase.functions.invoke("lalum-mfa-recovery", { body: { action: "redeem", code } });
  if (!error && data?.ok) return null;
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  if (status === 429) return "יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.";
  return "קוד השחזור שגוי או שכבר נוצל.";
}

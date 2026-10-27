// Client of the `lalum-fin-tax-advisor` edge function. The system prompt lives in the function (server side only).
// Two modes: classify one expense, and a CFO audit of the engine's figures. Neither writes anything: a classification
// pre-fills the expense form and a person confirms it, the same contract as the receipt scan.
import { supabase } from "../supabase";
import type { Pnl, TaxCategory } from "./taxEngine";

export interface Classification {
  expense_category: TaxCategory; vat_recognition_pct: number; income_tax_recognition_pct: number;
  needs_review: boolean; legal_reasoning_hebrew: string;
}
export interface AdvisorReply<T> { ok: boolean; code?: string; data?: T }

const ERRORS: Record<string, string> = {
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.", forbidden: "אין הרשאה. נדרשת רמת הוצאות.", too_many_requests: "יותר מדי בקשות בשעה האחרונה.",
  upstream_error: "היועץ לא זמין כרגע. אפשר לסווג ידנית.", fetch_failed: "שגיאת תקשורת. אפשר לנסות שוב.", not_configured: "היועץ לא הוגדר בשרת.",
};
export const advisorError = (code?: string): string => ERRORS[code ?? ""] ?? "הבקשה נכשלה.";

async function call<T>(body: Record<string, unknown>): Promise<AdvisorReply<T>> {
  if (!supabase) return { ok: false, code: "fetch_failed" };
  const { data } = await supabase.auth.getSession();
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-tax-advisor`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    return res.ok ? { ok: true, data: j as T } : { ok: false, code: j?.code ?? "fetch_failed" };
  } catch { return { ok: false, code: "fetch_failed" }; } finally { clearTimeout(timer); }
}

export const classifyExpense = (firmId: string, e: { supplier: string; description: string; total: number; vat_amount: number }) =>
  call<{ classification: Classification | null }>({ firm_id: firmId, mode: "classify", ...e });

export const cfoAudit = (firmId: string, pnl: Pnl, final: boolean) =>
  call<{ report: string; final: boolean }>({ firm_id: firmId, mode: "audit", pnl, final });

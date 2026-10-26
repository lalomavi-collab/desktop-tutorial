// Calls behind /workspace/campaigns: the summary RPC (admin only, null for anyone else), the sync function's refresh button, and the
// two hand-entry RPCs for channels without an API. Every number the screen shows comes from the database; campaignsCore does the math.
import { supabase } from "../supabase";
import { rpcFailure } from "./billingWipCore.ts";
import { parseSummary } from "./campaignsCore.ts";
import type { CampaignSummary } from "./campaignsCore.ts";

export type SummaryState = { state: "loading" | "denied" | "unavailable" } | { state: "ready"; data: CampaignSummary };

export async function loadCampaignSummary(code: string, days: number): Promise<SummaryState> {
  if (!supabase) return { state: "unavailable" };
  const { data, error } = await supabase.rpc("lalum_campaign_summary", { p_code: code, p_days: days });
  if (error) return { state: rpcFailure(error) };
  const parsed = parseSummary(data);
  return parsed ? { state: "ready", data: parsed } : { state: "denied" };
}

/** Runs the daily sync now. The function admits the admin at most once in 10 minutes and answers which sources succeeded. */
export async function refreshCampaigns(): Promise<{ ok: boolean; text: string }> {
  if (!supabase) return { ok: false, text: "אין חיבור לשרת." };
  const { data, error } = await supabase.functions.invoke("lalum-campaign-sync", { body: {} });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    if (body?.code === "cooldown") return { ok: false, text: `הרענון האחרון היה לפני פחות מ-10 דקות. אפשר שוב בעוד ${Math.ceil(Number(body.retry_in_s ?? 60) / 60)} דקות.` };
    if (body?.code === "forbidden") return { ok: false, text: "הרענון זמין למנהל המערכת עם אימות דו-שלבי בלבד." };
    return { ok: false, text: "פונקציית הסנכרון לא זמינה עדיין (טרם נפרסה)." };
  }
  const sources = (data as { sources?: Record<string, { status?: string }> } | null)?.sources ?? {};
  const ok = Object.values(sources).filter((x) => x.status === "ok").length;
  return { ok: true, text: `הסנכרון רץ: ${ok} מתוך ${Object.keys(sources).length} מקורות עודכנו.` };
}

export async function saveManualPost(p: { platform: string; permalink: string; title: string; publishedOn: string; day: string; metrics: Record<string, number | null> }): Promise<string | null> {
  if (!supabase) return "אין חיבור לשרת.";
  const { error } = await supabase.rpc("lalum_campaign_manual_post", {
    p_platform: p.platform, p_permalink: p.permalink, p_title: p.title || null, p_published_on: p.publishedOn || null, p_day: p.day, p_metrics: p.metrics,
  });
  return error ? manualError(error) : null;
}

export async function saveManualPaid(p: { channel: string; periodEnd: string; metrics: Record<string, number | null> }): Promise<string | null> {
  if (!supabase) return "אין חיבור לשרת.";
  const { error } = await supabase.rpc("lalum_campaign_manual_paid", { p_channel: p.channel, p_period_end: p.periodEnd, p_metrics: p.metrics });
  return error ? manualError(error) : null;
}

function manualError(error: { message?: string; code?: string }): string {
  const m = error.message ?? "";
  if (error.code === "42501" || /not allowed/.test(m)) return "השמירה זמינה למנהל המערכת עם אימות דו-שלבי בלבד.";
  if (/https/.test(m)) return "יש להדביק קישור לפוסט שמתחיל ב-https://.";
  if (/today or earlier/.test(m)) return "התאריך לא יכול להיות עתידי.";
  if (/number|range/.test(m)) return "כל ערך צריך להיות מספר חיובי.";
  return "השמירה נכשלה.";
}

// The server side of the intake brief: the deep matter map (edge function lalum-matter-brief, cached in lalum_matter_briefs)
// and the answers to the brief's questions (lalum_matter_brief_answers, closed ids only). Every call is behind RLS, so a
// member who may not see the matter gets nothing back, and the brief keeps working on what the browser has.
import { supabase } from "../supabase";
import type { Answers, MatterMap } from "./intakeBrief";

export interface MapResult { map: MatterMap; docIds: string[]; createdAt: string }

const ERR: Record<string, string> = {
  no_documents: "אין בתיק מסמכים עם טקסט לניתוח.",
  too_many_requests: "הגעתם למכסת הניתוחים לשעה הקרובה. נסו שוב מאוחר יותר.",
  daily_cap: "הגעתם למכסת הניתוחים היומית של המערכת.",
  not_found: "התיק לא נמצא או שאין הרשאה.",
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.",
};

/** The cached map, if one was made. Read straight from the table, so opening the brief never triggers a model call. */
export async function loadMatterMap(matterId: string): Promise<MapResult | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("lalum_matter_briefs").select("map, doc_ids, created_at").eq("matter_id", matterId).maybeSingle();
  const row = data as { map: MatterMap; doc_ids: string[]; created_at: string } | null;
  return row ? { map: row.map, docIds: row.doc_ids, createdAt: row.created_at } : null;
}

export async function runMatterMap(matterId: string, refresh: boolean): Promise<{ ok: true; result: MapResult } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "המערכת לא מחוברת." };
  const { data, error } = await supabase.functions.invoke("lalum-matter-brief", { body: { matter_id: matterId, refresh } });
  if (error || !data?.map) {
    let code = (data as { code?: string } | null)?.code;
    try { code = code ?? (await (error as { context?: Response })?.context?.json())?.code; } catch { /* no body */ }
    return { ok: false, error: (code && ERR[code]) ?? "הניתוח העמוק לא הצליח כרגע. הניתוח המקומי ממשיך לעבוד." };
  }
  return { ok: true, result: { map: data.map as MatterMap, docIds: data.doc_ids as string[], createdAt: data.created_at as string } };
}

export async function loadServerAnswers(matterId: string): Promise<Answers | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("lalum_matter_brief_answers").select("question_id, option_id").eq("matter_id", matterId);
  if (error) return null;
  return Object.fromEntries(((data as Array<{ question_id: string; option_id: string }> | null) ?? []).map((r) => [r.question_id, r.option_id]));
}

/** Who answered and when are stamped by the database (trigger), not sent from here. */
export async function saveServerAnswer(matterId: string, questionId: string, optionId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("lalum_matter_brief_answers").upsert({ matter_id: matterId, question_id: questionId, option_id: optionId });
  return !error;
}

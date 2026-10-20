// Data access for the hours screen: the attendance clock, the matter timer, the entries a person writes, and the partner
// report. Writes go through the database functions (the clock and the timer are not directly writable), so the rules live
// in one place: 0058 for attendance, 0021a for the timer, 0019 for entries.
import { supabase } from "../supabase";
import { useRpc } from "./billingWip.ts";
import type { Loaded } from "./billingWip.ts";
import { clockError, parseHoursIndex } from "./hoursIndexCore.ts";
import type { HoursIndex } from "./hoursIndexCore.ts";

/** `version` is bumped by the screen to re-read the same period after a correction. */
export const useHoursIndex = (from: string, to: string, version: number, enabled: boolean): Loaded<HoursIndex> =>
  useRpc(enabled, `${from}|${to}|${version}`, () => supabase!.rpc("lalum_hours_index", { p_from: from, p_to: to }), parseHoursIndex);

/** Runs an RPC and returns null on success or a Hebrew message on failure. */
async function call(fn: string, args?: Record<string, unknown>): Promise<string | null> {
  if (!supabase) return "לא זמין.";
  const { error } = await supabase.rpc(fn, args);
  return error ? clockError(error) : null;
}

export const clockIn = () => call("lalum_clock_in");
export const clockOut = () => call("lalum_clock_out");
export const timerStart = (matter: string, narrative: string) => call("lalum_timer_start", { p_matter: matter, p_narrative: narrative });
export const timerStop = (narrative: string) => call("lalum_timer_stop", { p_narrative: narrative });
export const correctSession = (id: string, from: string, to: string, reason: string) => call("lalum_attendance_correct", { p_id: id, p_in: from, p_out: to, p_reason: reason });
export const addSession = (user: string, from: string, to: string, reason: string) => call("lalum_attendance_add", { p_user: user, p_in: from, p_out: to, p_reason: reason });

export interface Session { id: string; user_id: string; clock_in: string; clock_out: string | null; adjust_reason: string | null }
export interface Timer { matter_id: string; narrative: string; started_at: string }
export interface Entry { id: string; matter_id: string; work_date: string; worked_minutes: number; billable_minutes: number; narrative: string; status: string }
export interface MatterOption { matter_id: string; matter_code: string | null; title: string | null }

export async function loadSessions(sinceIso: string, userId?: string): Promise<Session[]> {
  if (!supabase) return [];
  let q = supabase.from("lalum_attendance").select("id, user_id, clock_in, clock_out, adjust_reason").gte("clock_in", sinceIso).order("clock_in", { ascending: false }).limit(80);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  return (data as Session[] | null) ?? [];
}
export async function loadTimer(userId: string): Promise<Timer | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("lalum_time_timers").select("matter_id, narrative, started_at").eq("user_id", userId).maybeSingle();
  return (data as Timer | null) ?? null;
}
export async function loadEntries(userId: string): Promise<Entry[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("lalum_time_entries").select("id, matter_id, work_date, worked_minutes, billable_minutes, narrative, status").eq("timekeeper_id", userId).order("work_date", { ascending: false }).order("created_at", { ascending: false }).limit(40);
  return (data as Entry[] | null) ?? [];
}
export async function loadMatters(): Promise<MatterOption[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("lalum_v_admin_matters").select("matter_id, matter_code, title").limit(300);
  return (data as MatterOption[] | null) ?? [];
}
export async function loadMembers(firmId: string): Promise<{ user_id: string; name: string }[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("lalum_firm_members").select("user_id, name").eq("firm_id", firmId);
  return (data as { user_id: string; name: string }[] | null) ?? [];
}

export async function addEntry(e: { firmId: string; matterId: string; workDate: string; worked: number; billable: number; narrative: string }): Promise<string | null> {
  if (!supabase) return "לא זמין.";
  const { error } = await supabase.from("lalum_time_entries").insert({ firm_id: e.firmId, matter_id: e.matterId, work_date: e.workDate, worked_minutes: e.worked, billable_minutes: e.billable, narrative: e.narrative, status: "draft" });
  return error ? clockError(error) : null;
}
export async function submitEntry(id: string, narrative: string): Promise<string | null> {
  if (!supabase) return "לא זמין.";
  if (narrative.trim().length < 15) return "לפני ההגשה יש לתאר את העבודה ב-15 תווים לפחות.";
  const { error } = await supabase.from("lalum_time_entries").update({ status: "submitted", narrative }).eq("id", id);
  return error ? clockError(error) : null;
}

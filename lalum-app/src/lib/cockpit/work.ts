// Client work areas: inquiries with reply log, matter tasks, responsiveness scorecard (LALUMap migration lalum_work_areas).
// A reply is logged as "that and when", never its content. Scores are an internal management measure and the formula is shown beside them.
import { supabase } from "../supabase";

export const VIA: Record<string, string> = { PHONE: "טלפון", EMAIL: 'דוא"ל', WHATSAPP: "וואטסאפ", MEETING: "פגישה", PORTAL: "פורטל" };
export const CHANNEL: Record<string, string> = { WHATSAPP: "וואטסאפ", EMAIL: 'דוא"ל', WEB_FORM: "טופס באתר", PORTAL: "פורטל" };

export interface Inquiry { id: string; matter_id: string | null; channel: string; received_at: string; body_masked: string; attachment_count: number; status: string; handled_at: string | null }
export interface Reply { inquiry_id: string; replied_by: string; replied_at: string; via: string }
export interface Task { id: string; matter_id: string; title: string; due_at: string | null; assignee: string; status: string; created_at: string; closed_at: string | null }
export interface Person { user_id: string; display_name: string; role: string }
export interface PersonScore { user_id: string; replies: number; replies_in_target: number; median_minutes: number | null; tasks_open: number; tasks_overdue: number; tasks_judged: number; tasks_on_time: number; score: number | null }
export interface Scorecard { days: number; target_minutes: number; partner_view: boolean; firm: { inquiries: number; unanswered: number; unanswered_over_target: number; tasks_open: number; tasks_overdue: number }; people: PersonScore[] }

export async function listInquiries(): Promise<{ inquiries: Inquiry[]; replies: Reply[]; titles: Map<string, string> }> {
  if (!supabase) return { inquiries: [], replies: [], titles: new Map() };
  const [i, r] = await Promise.all([
    supabase.from("lalum_matter_inquiries").select("id, matter_id, channel, received_at, body_masked, attachment_count, status, handled_at").order("received_at", { ascending: false }).limit(200),
    supabase.from("lalum_inquiry_replies").select("inquiry_id, replied_by, replied_at, via").order("replied_at", { ascending: true }).limit(1000),
  ]);
  const inquiries = (i.data as Inquiry[] | null) ?? [];
  const ids = [...new Set(inquiries.map((x) => x.matter_id).filter((x): x is string => !!x))];
  const titles = await matterTitles(ids);
  return { inquiries, replies: (r.data as Reply[] | null) ?? [], titles };
}

export async function matterTitles(ids: string[]): Promise<Map<string, string>> {
  if (!supabase || !ids.length) return new Map();
  const { data } = await supabase.from("lalum_cockpit_matters").select("id, title").in("id", ids);
  return new Map(((data as Array<{ id: string; title: string }> | null) ?? []).map((m) => [m.id, m.title]));
}

export async function logReply(inquiry: string, via: string): Promise<string | null> {
  if (!supabase) return "אין חיבור.";
  const { error } = await supabase.rpc("lalum_log_reply", { p_inquiry: inquiry, p_via: via });
  return error ? "רישום המענה נכשל." : null;
}
export async function handleInquiry(inquiry: string): Promise<string | null> {
  if (!supabase) return "אין חיבור.";
  const { error } = await supabase.rpc("lalum_handle_inquiry", { p_inquiry: inquiry, p_matter: null });
  return error ? "הפעולה נכשלה." : null;
}
export async function openRaw(inquiry: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("lalum_open_inquiry", { p_inquiry: inquiry });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as { body_raw?: string } | null;
  return row?.body_raw ?? null;
}

export async function listTasks(): Promise<{ tasks: Task[]; titles: Map<string, string>; people: Person[] }> {
  if (!supabase) return { tasks: [], titles: new Map(), people: [] };
  const [t, p] = await Promise.all([
    supabase.from("lalum_matter_tasks").select("id, matter_id, title, due_at, assignee, status, created_at, closed_at").order("due_at", { ascending: true, nullsFirst: false }).limit(500),
    supabase.rpc("lalum_firm_people"),
  ]);
  const tasks = (t.data as Task[] | null) ?? [];
  return { tasks, titles: await matterTitles([...new Set(tasks.map((x) => x.matter_id))]), people: (p.data as Person[] | null) ?? [] };
}
export async function createTask(matter: string, title: string, due: string | null, assignee: string | null): Promise<string | null> {
  if (!supabase) return "אין חיבור.";
  const { error } = await supabase.rpc("lalum_task_create", { p_matter: matter, p_title: title, p_due: due, p_assignee: assignee });
  return error ? "יצירת המשימה נכשלה." : null;
}
export async function closeTask(id: string, status: "DONE" | "CANCELLED"): Promise<string | null> {
  if (!supabase) return "אין חיבור.";
  const { error } = await supabase.rpc("lalum_task_close", { p_task: id, p_status: status });
  return error ? "הפעולה נכשלה." : null;
}
export async function matterOptions(): Promise<Array<{ id: string; title: string }>> {
  if (!supabase) return [];
  const { data } = await supabase.from("lalum_cockpit_matters").select("id, title").order("created_at", { ascending: false }).limit(500);
  return (data as Array<{ id: string; title: string }> | null) ?? [];
}

export async function scorecard(days: number): Promise<Scorecard | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("lalum_scorecard", { p_days: days });
  return error ? null : (data as Scorecard);
}
export async function firmPeople(): Promise<Person[]> {
  if (!supabase) return [];
  const { data } = await supabase.rpc("lalum_firm_people");
  return (data as Person[] | null) ?? [];
}

/** Human duration for a number of minutes. */
export function dur(mins: number | null | undefined): string {
  if (mins == null) return "";
  if (mins < 60) return `${Math.round(mins)} דק'`;
  if (mins < 60 * 48) return `${(mins / 60).toFixed(mins < 600 ? 1 : 0)} שע'`;
  return `${Math.round(mins / 1440)} ימים`;
}

/** Date and time down to the second: reply times are evidence of service levels, so they are shown exactly. */
export const fmtExact = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "medium" }) : "";

/** The firm's inbound e-mail address for client inquiries. */
export async function myInquiryAddress(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("lalum_my_inquiry_address");
  return error ? null : (data as string);
}

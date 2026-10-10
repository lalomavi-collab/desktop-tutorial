// Data for the cockpit dashboard: counts and series computed in the browser from rows the signed-in member may already read (RLS applies).
import { supabase } from "../supabase";
import { scorecard } from "./work";
import type { Scorecard } from "./work";

export interface DashMatter { matter_id: string; title: string; practice_area: string; matter_status: string; conflict_status: string; risk_level: string | null; dispatched_at: string; sla_breached: boolean }
export interface DashData {
  matters: DashMatter[];
  inquiries: Array<{ received_at: string; status: string }>;
  tasks: Array<{ status: string; due_at: string | null; created_at: string; closed_at: string | null }>;
  docs: number;
  score: Scorecard | null;
}

export async function loadDashboard(): Promise<DashData> {
  const empty: DashData = { matters: [], inquiries: [], tasks: [], docs: 0, score: null };
  if (!supabase) return empty;
  const since = new Date(Date.now() - 200 * 86400000).toISOString();
  const [m, i, t, d, score] = await Promise.all([
    supabase.from("lalum_v_admin_matters").select("matter_id, title, practice_area, matter_status, conflict_status, risk_level, dispatched_at, sla_breached").order("dispatched_at", { ascending: false }).limit(500),
    supabase.from("lalum_matter_inquiries").select("received_at, status").gte("received_at", since).limit(1000),
    supabase.from("lalum_matter_tasks").select("status, due_at, created_at, closed_at").limit(1000),
    supabase.from("lalum_matter_documents").select("id", { count: "exact", head: true }),
    scorecard(30),
  ]);
  return {
    matters: (m.data as DashMatter[] | null) ?? [],
    inquiries: (i.data as DashData["inquiries"] | null) ?? [],
    tasks: (t.data as DashData["tasks"] | null) ?? [],
    docs: d.count ?? 0,
    score,
  };
}

const DAY = 86400000;
/** Counts per bucket, oldest first. weekly: the last n weeks; monthly: the last n calendar months. */
export function series(dates: string[], mode: "weekly" | "monthly", n: number): { values: number[]; labels: string[] } {
  const now = new Date();
  const values = new Array<number>(n).fill(0);
  const labels: string[] = [];
  if (mode === "weekly") {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() + DAY;
    for (let k = 0; k < n; k++) { const s = new Date(end - (n - k) * 7 * DAY); labels.push(`${s.getDate()}/${s.getMonth() + 1}`); }
    for (const d of dates) { const idx = n - 1 - Math.floor((end - new Date(d).getTime()) / (7 * DAY)); if (idx >= 0 && idx < n) values[idx]++; }
  } else {
    const names = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
    for (let k = 0; k < n; k++) { const s = new Date(now.getFullYear(), now.getMonth() - (n - 1 - k), 1); labels.push(names[s.getMonth()]); }
    for (const d of dates) { const x = new Date(d); const idx = n - 1 - ((now.getFullYear() - x.getFullYear()) * 12 + now.getMonth() - x.getMonth()); if (idx >= 0 && idx < n) values[idx]++; }
  }
  return { values, labels };
}

/** Percent change of the last bucket against the one before it; null when there is nothing to compare. */
export function delta(values: number[]): number | null {
  const a = values[values.length - 1] ?? 0, b = values[values.length - 2] ?? 0;
  return b === 0 ? null : Math.round(((a - b) / b) * 100);
}

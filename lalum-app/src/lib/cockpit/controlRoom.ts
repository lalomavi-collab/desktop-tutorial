// Calls behind the control room. Every read is RLS bound: lalum_ops_snapshots and the campaign metrics answer only the platform admin
// with a second factor, so for anyone else the strip has nothing to draw and stays out of the way. controlRoomCore does the rules.
// The strip loads this module on every cockpit screen, so the bookkeeping engine stays out of it (the wall loads that itself).
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { parseSnapshot, webDays } from "./controlRoomCore.ts";
import type { HistoryPoint, MetricRow, Snapshot, WebDay } from "./controlRoomCore.ts";

/** The snapshot is written every 15 minutes, so reading it more often than this buys nothing. */
export const POLL_MS = 5 * 60000;
/** History and the daily metrics move once a day; an hour is plenty. */
const SLOW_MS = 60 * 60000;

export async function loadSnapshot(): Promise<Snapshot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("lalum_ops_snapshots").select("taken_at, data").order("taken_at", { ascending: false }).limit(1).maybeSingle();
  return error ? null : parseSnapshot(data);
}

/** Three numbers per snapshot for the sparklines, not the whole document: about 300 small rows over 30 days. */
export async function loadHistory(): Promise<HistoryPoint[]> {
  if (!supabase) return [];
  const since = new Date(Date.now() - 31 * 86400000).toISOString();
  const { data, error } = await supabase.from("lalum_ops_snapshots")
    .select("taken_at, definer:data->sec->>definer_callable, live:data->matters->>live, cron:data->>cron_failed_7d")
    .gte("taken_at", since).order("taken_at", { ascending: true }).limit(1000);
  if (error || !data) return [];
  const n = (x: unknown) => (x === null || x === undefined ? null : Number.isFinite(Number(x)) ? Number(x) : null);
  return (data as Array<Record<string, unknown>>).map((r) => ({ takenAt: String(r.taken_at), definer: n(r.definer), live: n(r.live), cronFailed7d: n(r.cron) }));
}

/** The site summary rows only (key ''), never the breakdowns by page or query. */
export async function loadWeb(days = 35): Promise<WebDay[]> {
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from("lalum_campaign_metrics_daily").select("day, source, scope, key, metric, value")
    .eq("scope", "site").eq("key", "").in("source", ["gsc", "facebook", "instagram"]).in("metric", ["impressions", "clicks", "followers"])
    .gte("day", since).limit(1000);
  return error || !data ? [] : webDays(data as MetricRow[]);
}

export interface ControlData { loaded: boolean; snapshot: Snapshot | null; history: HistoryPoint[]; web: WebDay[]; now: Date }

/** Polls while the tab is visible: the snapshot every 5 minutes, history and metrics every hour. */
export function useControlRoom(enabled: boolean): ControlData {
  const [d, setD] = useState<ControlData>({ loaded: false, snapshot: null, history: [], web: [], now: new Date() });
  const last = useRef({ fast: 0, slow: 0 });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const tick = async (force: boolean) => {
      const now = Date.now();
      if (!force && (document.visibilityState !== "visible" || now - last.current.fast < POLL_MS - 5000)) return;
      const slow = force || now - last.current.slow > SLOW_MS;
      last.current.fast = now;
      if (slow) last.current.slow = now;
      const [snapshot, history, web] = await Promise.all([loadSnapshot(), slow ? loadHistory() : Promise.resolve(null), slow ? loadWeb() : Promise.resolve(null)]);
      if (!live) return;
      setD((s) => ({ ...s, loaded: true, snapshot, history: history ?? s.history, web: web ?? s.web, now: new Date() }));
    };
    void tick(true);
    const t = window.setInterval(() => void tick(false), POLL_MS);
    const vis = () => { if (document.visibilityState === "visible") void tick(false); };
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; window.clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [enabled]);
  return d;
}

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// The matters the entry gate searches and lists: the same view and columns the dashboard reads, under the member's own access (RLS).
export interface GateMatter { matter_id: string; matter_code: string | null; title: string; practice_area: string; dispatched_at: string }

export function useGateMatters(enabled: boolean): GateMatter[] | null {
  const [rows, setRows] = useState<GateMatter[] | null>(null);
  useEffect(() => {
    if (!enabled || !supabase) return;
    let live = true;
    void supabase.from("lalum_v_admin_matters").select("matter_id, matter_code, title, practice_area, dispatched_at").order("dispatched_at", { ascending: false }).limit(500)
      .then((r) => { if (live) setRows((r.data as GateMatter[] | null) ?? []); });
    return () => { live = false; };
  }, [enabled]);
  return rows;
}

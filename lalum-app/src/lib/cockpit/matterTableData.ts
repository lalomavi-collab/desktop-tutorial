import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { buildExtras, type ExtraSources, type MatterExtra } from "./matterTable";

// What the matters table shows beyond the matters view: the responsible member, the nearest date, the last activity.
// Every read runs under the member's own access (RLS), so a lawyer sees owners and dates of their own matters only.
// A read that fails (a role without access, a table not there yet) arrives empty and its column reads "not set".
export interface MatterExtras { extras: Map<string, MatterExtra>; me: string | null; ready: boolean }

const rows = <T,>(r: { data: unknown; error: unknown }): T[] => (r.error ? [] : ((r.data as T[] | null) ?? []));

export async function loadMatterExtras(): Promise<Omit<MatterExtras, "ready">> {
  if (!supabase) return { extras: new Map(), me: null };
  const [s, m, team, dl, tk, docs, people] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from("lalum_cockpit_matters").select("id, updated_at, created_by").limit(1000),
    supabase.from("lalum_matter_team").select("matter_id, user_id, created_at").limit(3000),
    supabase.from("lalum_deadlines").select("matter_id, due_date, kind").eq("status", "PENDING").order("due_date").limit(2000),
    supabase.from("lalum_matter_tasks").select("matter_id, due_at").eq("status", "OPEN").not("due_at", "is", null).order("due_at").limit(2000),
    supabase.from("lalum_matter_documents").select("matter_id, created_at").order("created_at", { ascending: false }).limit(2000),
    supabase.rpc("lalum_firm_people"),
  ]);
  const src: ExtraSources = {
    matters: rows(m), team: rows(team), deadlines: rows(dl), tasks: rows(tk), docs: rows(docs), people: rows(people),
  };
  return { extras: buildExtras(src), me: s.data.session?.user.id ?? null };
}

export function useMatterExtras(enabled: boolean): MatterExtras {
  const [v, setV] = useState<MatterExtras>({ extras: new Map(), me: null, ready: false });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadMatterExtras().then((x) => { if (live) setV({ ...x, ready: true }); }).catch(() => { if (live) setV((p) => ({ ...p, ready: true })); });
    return () => { live = false; };
  }, [enabled]);
  return v;
}

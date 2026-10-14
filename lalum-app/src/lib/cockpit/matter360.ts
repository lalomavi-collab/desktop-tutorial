// Loads one matter with its fee terms, client, hours and documents. Read only; every table is behind RLS,
// so a member who may not see something simply gets less back.
import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { isUuid } from "./matter360Core.ts";
import type { TimeRow } from "./matter360Core.ts";

export interface MatterRow { id: string; title: string; practice_area: string; status: string; conflict_status: string; created_at: string }
export interface FeeRow { fee_model: string; fixed_fee: number | null; fee_cap: number | null; retainer_monthly: number | null; billing_active: boolean; fin_customer_id: string | null }
export interface DocRow { id: string; file_name: string; doc_type: string | null; doc_date: string | null; created_at: string }
export interface Matter360Data { matter: MatterRow; fee: FeeRow | null; clientName: string | null; time: TimeRow[]; docs: DocRow[]; trustHeld: number }
export type Matter360State = { state: "loading" } | { state: "missing" } | { state: "ready"; data: Matter360Data };

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export async function loadMatter360(id: string): Promise<Matter360State> {
  if (!supabase || !isUuid(id)) return { state: "missing" };
  const m = await supabase.from("lalum_cockpit_matters").select("id, title, matter_code, practice_area, status, conflict_status, created_at").eq("id", id).maybeSingle();
  if (m.error || !m.data) return { state: "missing" };
  const [f, t, d, tr] = await Promise.all([
    supabase.from("lalum_matter_fees").select("fee_model, fixed_fee, fee_cap, retainer_monthly, billing_active, fin_customer_id").eq("matter_id", id).maybeSingle(),
    supabase.from("lalum_time_entries").select("id, work_date, billable_minutes, narrative, status").eq("matter_id", id).order("work_date", { ascending: false }).limit(200),
    supabase.from("lalum_matter_documents").select("id, file_name, doc_type, doc_date, created_at").eq("matter_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("lalum_trust_ledger").select("amount").eq("matter_id", id),
  ]);
  const fr = f.data as (Omit<FeeRow, "fixed_fee" | "fee_cap" | "retainer_monthly"> & { fixed_fee: unknown; fee_cap: unknown; retainer_monthly: unknown }) | null;
  const fee: FeeRow | null = fr ? { ...fr, fixed_fee: num(fr.fixed_fee), fee_cap: num(fr.fee_cap), retainer_monthly: num(fr.retainer_monthly) } : null;
  let clientName: string | null = null;
  if (fee?.fin_customer_id) {
    const c = await supabase.from("lalum_fin_customers").select("name").eq("id", fee.fin_customer_id).maybeSingle();
    clientName = (c.data as { name: string } | null)?.name ?? null;
  }
  const trustHeld = Math.round(((tr.data as Array<{ amount: number | string }> | null) ?? []).reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
  return { state: "ready", data: { matter: m.data as MatterRow, fee, clientName, time: (t.data as TimeRow[] | null) ?? [], docs: (d.data as DocRow[] | null) ?? [], trustHeld } };
}

export function useMatter360(id: string): Matter360State {
  const [s, setS] = useState<Matter360State>({ state: "loading" });
  useEffect(() => { let on = true; void loadMatter360(id).then((r) => { if (on) setS(r); }); return () => { on = false; }; }, [id]);
  return s;
}

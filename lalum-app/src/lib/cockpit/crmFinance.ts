// Loads the ledger rows the partner view needs and shapes them with crmFinanceCore.
import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { todayIL } from "./arAging";
import { partnerFinance } from "./crmFinanceCore.ts";
import type { PartnerFinance, SettingsRow } from "./crmFinanceCore.ts";
import type { ManualRow } from "./cashFlow";
import type { FinCustomer, FinDocument, FinPayment } from "./finance";

export type PartnerFinanceState = { state: "loading" } | { state: "denied" } | { state: "ready"; data: PartnerFinance };

/** Finance data is gated by RLS (level 2 and up for documents). A refusal or an empty client reads as "denied", never as zeros. */
export async function loadPartnerFinance(): Promise<PartnerFinanceState> {
  if (!supabase) return { state: "denied" };
  const today = todayIL();
  const [c, d, p, cs, ci] = await Promise.all([
    supabase.from("lalum_fin_customers").select("*").order("name"),
    supabase.from("lalum_fin_documents").select("*"),
    supabase.from("lalum_fin_payments").select("*"),
    supabase.from("lalum_fin_cashflow_settings").select("opening_balance, balance_as_of, credit_facility, safety_reserve").maybeSingle(),
    supabase.from("lalum_cash_forecast_items").select("week_ending, category, projected_amount").gte("week_ending", today),
  ]);
  if (c.error || d.error || p.error) return { state: "denied" };
  const s = cs.data as SettingsRow | null;
  const settings = s ? { ...s, opening_balance: Number(s.opening_balance), credit_facility: Number(s.credit_facility), safety_reserve: Number(s.safety_reserve) } : null;
  const rows = ((ci.data as Array<ManualRow & { projected_amount: number | string }> | null) ?? []).map((r) => ({ ...r, projected_amount: Number(r.projected_amount) }));
  return { state: "ready", data: partnerFinance((c.data as FinCustomer[]) ?? [], (d.data as FinDocument[]) ?? [], (p.data as FinPayment[]) ?? [], settings, rows, today) };
}

export function usePartnerFinance(): PartnerFinanceState {
  const [s, setS] = useState<PartnerFinanceState>({ state: "loading" });
  useEffect(() => { void loadPartnerFinance().then(setS); }, []);
  return s;
}

// Trust (client money) figure for the partner view, from the real ledger instead of the demo data.
// A firm that holds no client money has no trust account, and then the card is not shown at all:
// a permanent "0" under a "client funds" heading would suggest a duty the firm does not have.
import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { summarizeTrust } from "./crm.ts";
import type { TrustSummary } from "./crm.ts";

export type { TrustSummary };

/** Readable only at finance level 4 (RLS); anyone else, an unconfigured client or an error reads as "none". */
export async function loadTrustSummary(): Promise<TrustSummary> {
  if (!supabase) return { state: "none" };
  const acc = await supabase.from("lalum_trust_accounts").select("id", { count: "exact", head: true });
  if (acc.error || !acc.count) return { state: "none" };
  const led = await supabase.from("lalum_trust_ledger").select("amount");
  if (led.error) return { state: "none" };
  return summarizeTrust(acc.count, (led.data ?? []).map((r: { amount: number | string }) => Number(r.amount)));
}

/** Loads once; the three CRM screens share it so none of them shows trust to a firm that holds none. */
export function useTrustSummary(): TrustSummary {
  const [s, setS] = useState<TrustSummary>({ state: "loading" });
  useEffect(() => { void loadTrustSummary().then(setS); }, []);
  return s;
}

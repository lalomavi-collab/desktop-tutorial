// Calls the billing RPCs. Both are finance gated (RLS level) and audited by the database as viewed financials,
// so the matter one is only called when the billing tab is opened.
import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { parseMatterWip, parseOverview, rpcFailure } from "./billingWipCore.ts";
import type { MatterWip, Overview } from "./billingWipCore.ts";

export type Loaded<T> = { state: "idle" | "loading" | "denied" | "unavailable" } | { state: "ready"; data: T };

function useRpc<T>(enabled: boolean, key: string, call: () => PromiseLike<{ data: unknown; error: unknown }>, parse: (j: unknown) => T | null): Loaded<T> {
  const [s, setS] = useState<Loaded<T>>({ state: enabled && supabase ? "loading" : "idle" });
  useEffect(() => {
    if (!enabled || !supabase) return;
    let on = true;
    void call().then(({ data, error }) => {
      const parsed = error ? null : parse(data);
      if (on) setS(parsed ? { state: "ready", data: parsed } : { state: error ? rpcFailure(error) : "denied" });
    });
    return () => { on = false; };
  }, [enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

export const usePartnerOverview = (): Loaded<Overview> => useRpc(true, "overview", () => supabase!.rpc("lalum_partner_overview"), parseOverview);
export const useMatterWip = (matterId: string, enabled: boolean): Loaded<MatterWip> =>
  useRpc(enabled, matterId, () => supabase!.rpc("lalum_billing_unbilled_wip", { p_matter: matterId }), parseMatterWip);

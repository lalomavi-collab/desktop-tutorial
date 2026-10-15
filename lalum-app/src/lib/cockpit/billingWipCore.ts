// Parses the two billing RPCs that price hours with the firm's rate cards, so the screens show the amounts the
// database computed (matter rate card first, then the firm card, by the timekeeper's role) and never a client-side guess.
// Pure: covered by crm-check.

const n = (v: unknown): number => (v == null || v === "" ? 0 : Number(v));
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export interface LowRetainer { matterId: string; title: string; balance: number; threshold: number }
export interface Overview {
  /** Value of submitted and approved hours on hourly, capped and hybrid matters, at the resolved rate. */
  wipValue: number; wipHours: number;
  /** Entries with no rate card behind them: left out of the value, and said so. */
  entriesWithoutRate: number; awaitingApproval: number;
  /** Hours on fixed, retainer, subscription and success-fee matters: tracked, not priced by the hour. */
  nonHourlyHours: number;
  lowRetainers: LowRetainer[];
}

/** lalum_partner_overview() */
export function parseOverview(j: unknown): Overview | null {
  const o = obj(j);
  if (!o) return null;
  return {
    wipValue: n(o.wip_value), wipHours: n(o.wip_hours), entriesWithoutRate: n(o.entries_without_rate), awaitingApproval: n(o.entries_awaiting_approval),
    nonHourlyHours: n(o.unbilled_hours_non_hourly_matters),
    lowRetainers: arr(o.trust_below_threshold).map((x) => obj(x)).filter((x): x is Record<string, unknown> => !!x)
      .map((x) => ({ matterId: String(x.matter_id), title: String(x.title ?? ""), balance: n(x.balance), threshold: n(x.threshold) })),
  };
}

export interface WipEntry { id: string; workDate: string; timekeeper: string | null; minutes: number; rate: number | null; amount: number | null; narrative: string; status: string; reserved: boolean }
export interface MatterWip { entries: WipEntry[]; billableValue: number; disbursementsTotal: number; entriesWithoutRate: number; awaitingApproval: number }

/** lalum_billing_unbilled_wip(matter) */
export function parseMatterWip(j: unknown): MatterWip | null {
  const o = obj(j);
  if (!o) return null;
  return {
    entries: arr(o.time_entries).map((x) => obj(x)).filter((x): x is Record<string, unknown> => !!x).map((x) => ({
      id: String(x.id), workDate: String(x.work_date), timekeeper: x.timekeeper == null ? null : String(x.timekeeper), minutes: n(x.billable_minutes),
      rate: x.rate == null ? null : n(x.rate), amount: x.amount == null ? null : n(x.amount), narrative: String(x.narrative ?? ""), status: String(x.status), reserved: x.reserved === true,
    })),
    billableValue: n(o.billable_time_value), disbursementsTotal: n(o.disbursements_total), entriesWithoutRate: n(o.entries_without_rate), awaitingApproval: n(o.awaiting_approval),
  };
}

/** Why an RPC call failed: the function is not in the database yet (migration not applied), or the caller may not see it. */
export function rpcFailure(error: unknown): "unavailable" | "denied" {
  const e = obj(error);
  const code = String(e?.code ?? ""), msg = String(e?.message ?? "");
  return code === "PGRST202" || code === "42883" || /could not find the function|does not exist/i.test(msg) ? "unavailable" : "denied";
}

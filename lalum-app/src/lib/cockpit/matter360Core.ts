// Pure helpers for the Matter 360 screen: no network, covered by crm-check.

export const isUuid = (s: string | null | undefined): s is string => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const FEE_MODEL_LABEL: Record<string, string> = {
  hourly: "לפי שעה", fixed: "מחיר קבוע", capped: "לפי שעה עם תקרה", retainer: "ריטיינר חודשי",
  subscription: "מנוי", success: "תשלום בהצלחה", hybrid: "משולב",
};
export const TIME_STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה", submitted: "הוגש", approved: "אושר", billed: "חויב", written_off: "נמחק",
};

export interface TimeRow { id: string; work_date: string; billable_minutes: number; narrative: string; status: string }
export interface TimeSummary { draft: number; submitted: number; approvedUnbilled: number; billed: number; writtenOff: number; totalBillable: number }

/** Minutes to hours, two decimals. */
export const hours = (minutes: number): number => Math.round((minutes / 60) * 100) / 100;

/** Billable minutes by status. "approvedUnbilled" is the work ready to invoice; written-off time is not part of the billable total. */
export function timeSummary(rows: TimeRow[]): TimeSummary {
  const s: TimeSummary = { draft: 0, submitted: 0, approvedUnbilled: 0, billed: 0, writtenOff: 0, totalBillable: 0 };
  for (const r of rows) {
    if (r.status === "draft") s.draft += r.billable_minutes;
    else if (r.status === "submitted") s.submitted += r.billable_minutes;
    else if (r.status === "approved") s.approvedUnbilled += r.billable_minutes;
    else if (r.status === "billed") s.billed += r.billable_minutes;
    else if (r.status === "written_off") s.writtenOff += r.billable_minutes;
  }
  s.totalBillable = s.draft + s.submitted + s.approvedUnbilled + s.billed;
  return s;
}

/** The four intake states in order, for the progress chips. -1 for an unknown status. */
export const MATTER_STAGES = ["INTAKE_PENDING", "ACTIVE_REVIEW", "APPROVED_BY_PARTNER", "ARCHIVED"] as const;
export const stageIndex = (status: string): number => MATTER_STAGES.indexOf(status as (typeof MATTER_STAGES)[number]);

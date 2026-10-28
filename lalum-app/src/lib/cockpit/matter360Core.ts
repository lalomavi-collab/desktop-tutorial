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

// Fee terms. The fields each model uses, the rest is stored empty. Mirrors the CHECK constraints on lalum_matter_fees so the
// form explains a refusal before the database raises it.
export const FEE_MODELS = ["hourly", "fixed", "capped", "retainer", "subscription", "success", "hybrid"] as const;
export type FeeAmountField = "fixed_fee" | "fee_cap" | "retainer_monthly";
export const FEE_FIELDS: Record<string, FeeAmountField[]> = {
  hourly: [], fixed: ["fixed_fee"], capped: ["fee_cap"], retainer: ["retainer_monthly"], subscription: ["retainer_monthly"],
  success: [], hybrid: ["fixed_fee", "fee_cap", "retainer_monthly"],
};
const FEE_REQUIRED: Record<string, FeeAmountField | undefined> = { fixed: "fixed_fee", capped: "fee_cap", retainer: "retainer_monthly", subscription: "retainer_monthly" };
export const FEE_FIELD_LABEL: Record<FeeAmountField, string> = { fixed_fee: "שכר קבוע", fee_cap: "תקרה", retainer_monthly: "ריטיינר חודשי" };

export interface FeeForm { fee_model: string; fixed_fee: string; fee_cap: string; retainer_monthly: string; cap_alert_pct: string }
export interface FeeTerms { fee_model: string; fixed_fee: number | null; fee_cap: number | null; retainer_monthly: number | null; cap_alert_pct: number }
export type FeeParse = { ok: true; terms: FeeTerms } | { ok: false; error: string };

/** An amount typed by the attorney: empty is "not set", otherwise a non-negative number kept to the agorot. */
export function parseAmount(s: string): number | null | "bad" {
  const t = s.replace(/[,\s₪]/g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return "bad";
  const n = Math.round(Number(t) * 100) / 100;
  return n > 999_999_999_999.99 ? "bad" : n;
}

export function parseFeeForm(f: FeeForm): FeeParse {
  if (!(FEE_MODELS as readonly string[]).includes(f.fee_model)) return { ok: false, error: "בחרו מודל שכר טרחה." };
  const terms: FeeTerms = { fee_model: f.fee_model, fixed_fee: null, fee_cap: null, retainer_monthly: null, cap_alert_pct: 80 };
  for (const k of FEE_FIELDS[f.fee_model]) {
    const v = parseAmount(f[k]);
    if (v === "bad") return { ok: false, error: `${FEE_FIELD_LABEL[k]}: סכום לא תקין. מספר חיובי בלבד, עד שתי ספרות אחרי הנקודה.` };
    terms[k] = v;
  }
  const need = FEE_REQUIRED[f.fee_model];
  if (need && terms[need] == null) return { ok: false, error: `במודל "${FEE_MODEL_LABEL[f.fee_model]}" חובה למלא ${FEE_FIELD_LABEL[need]}.` };
  if (f.cap_alert_pct.trim() !== "") {
    const p = Number(f.cap_alert_pct);
    if (!Number.isInteger(p) || p < 1 || p > 100) return { ok: false, error: "אחוז ההתרעה לפני התקרה: מספר שלם בין 1 ל-100." };
    terms.cap_alert_pct = p;
  }
  return { ok: true, terms };
}

export const feeFormFrom = (t: Partial<FeeTerms> | null): FeeForm => ({
  fee_model: t?.fee_model ?? "hourly",
  fixed_fee: t?.fixed_fee == null ? "" : String(t.fixed_fee),
  fee_cap: t?.fee_cap == null ? "" : String(t.fee_cap),
  retainer_monthly: t?.retainer_monthly == null ? "" : String(t.retainer_monthly),
  cap_alert_pct: String(t?.cap_alert_pct ?? 80),
});

// Matter deadlines (lalum_deadlines). Mirrors its CHECK constraints.
export const DEADLINE_KINDS = ["FILING", "HEARING", "INTERNAL"] as const;
export const DEADLINE_KIND_LABEL: Record<string, string> = { FILING: "הגשה", HEARING: "דיון", INTERNAL: "פנימי" };
export const DEADLINE_STATUS_LABEL: Record<string, string> = { PENDING: "פתוח", DONE: "בוצע", DISMISSED: "בוטל" };
export interface DeadlineRow { id: string; title: string; kind: string; due_date: string; status: string; is_client_visible: boolean; source_note: string | null; created_at: string }

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export function deadlineError(title: string, due: string, kind: string): string | null {
  const t = title.trim();
  if (t.length < 1 || t.length > 255) return "כותרת המועד: בין תו אחד ל-255 תווים.";
  if (!isDay(due)) return "תאריך המועד אינו תקין.";
  if (!(DEADLINE_KINDS as readonly string[]).includes(kind)) return "סוג המועד אינו תקין.";
  return null;
}

/** How the date was reached, stored with the deadline so a later reader can check the count. No legal rule is implied. */
export function calcNote(c: { eventDate: string; days: number; countEventDay: boolean; rollForward: boolean; frozen: Array<{ from: string; to: string }>; computedDue: string; due: string }): string {
  if (c.due !== c.computedDue) return `הוזן ידנית (המחשבון הציע ${c.computedDue}).`;
  const parts = [`חושב במחשבון: אירוע ${c.eventDate}, ${c.days} ימים`, c.countEventDay ? "יום האירוע נספר" : "יום האירוע לא נספר", c.rollForward ? "נדחה משבת" : "בלי דחייה משבת"];
  if (c.frozen.length) parts.push(`תקופות מוקפאות: ${c.frozen.map((p) => `${p.from} עד ${p.to}`).join(", ")}`);
  return `${parts.join(", ")}. הכללים הוזנו ידנית ולא אומתו במערכת.`;
}

/** Open deadlines first, nearest first; then done and dismissed, latest first. */
export function sortDeadlines(rows: DeadlineRow[]): DeadlineRow[] {
  const open = rows.filter((r) => r.status === "PENDING").sort((a, b) => a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at));
  const closed = rows.filter((r) => r.status !== "PENDING").sort((a, b) => b.due_date.localeCompare(a.due_date));
  return [...open, ...closed];
}

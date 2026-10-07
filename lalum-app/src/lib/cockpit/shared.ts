// Shared pieces of the case cockpit: labels, types, the pipeline call, the
// word-level diff used for track changes, and the membership lookup. The
// cockpit is Hebrew only: it is a working tool for the firm's partners.
import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../../context/AuthContext";

export const PRACTICE: Record<string, string> = {
  REAL_ESTATE: 'נדל"ן / תמ"א 38',
  COMMERCIAL_MA: "מסחרי / M&A",
  LABOR_LAW: "דיני עבודה",
  AI_GOVERNANCE: "ממשל AI",
  LITIGATION: "ליטיגציה",
};
export const RESPONSE: Record<string, string> = {
  PENDING_REVIEW: "ממתין לבדיקה",
  ACCEPTED: "התקבל",
  DECLINED: "נדחה",
  CLIENT_CONTACTED: "נוצר קשר עם הלקוח",
};
export const CONFLICT: Record<string, [string, string]> = {
  CLEAN: ["green", "נקי"],
  POTENTIAL: ["yellow", "בדיקה ידנית"],
  DIRECT_CONFLICT: ["red", "ניגוד ישיר"],
};
export const MATTER_STATUS: Record<string, string> = {
  INTAKE_PENDING: "ממתין לקליטה",
  ACTIVE_REVIEW: "בבדיקה פעילה",
  APPROVED_BY_PARTNER: "אושר על ידי שותף",
  ARCHIVED: "בארכיון",
};
export const ROLE: Record<string, string> = {
  FIRM_PARTNER: "שותף במשרד",
  ATTORNEY: "עורך דין",
  COMPLIANCE_OFFICER: "ממונה ציות",
  ADMIN: "מנהל משרד",
};
export const KIND_HE: Record<string, string> = {
  ID_NUMBER: "ת.ז. / דרכון",
  COMPANY_REG: "ח.פ. / ח.צ.",
  EMAIL: 'דוא"ל',
  PHONE: "טלפון",
  LAND_PARCEL: "גוש / חלקה",
  CLIENT_NAME: "שם צד",
  BANK_ACCOUNT: "חשבון בנק",
};
export const STEPS: Array<[string, string]> = [
  ["FACT_VERIFICATION", "אימות עובדות"],
  ["CITATION_CHECK", "בדיקת אסמכתאות"],
  ["REDLINE_REVIEW", "סקירת שינויים (Redline)"],
  ["PARTNER_APPROVAL", "אישור שותף"],
];

export type Severity = "RED" | "YELLOW" | "GREEN";
export interface Finding {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  description: string;
  fallbackClause: string | null;
  citation: string | null;
  citationUrl: string | null;
  span: { start: number; end: number } | null;
  excerpt: string | null;
}
export interface Risk { level: string; score: number; red: number; yellow: number; green: number }
export interface MatterDoc {
  id: string;
  file_name: string;
  baseline_content: string;
  editor_content: string;
  entity_counts: Record<string, number>;
  analysis: { findings?: Finding[]; risk?: Risk };
  created_at: string;
}
export interface Membership {
  firm_id: string;
  name: string;
  role: string;
  lalum_firms: { firm_name: string; status: string; subscription_tier: string; monthly_fee: number | null; seat_limit: number };
}
export interface PipelineReply {
  ok?: boolean;
  code?: string;
  message?: string;
  matter_id?: string;
  document_id?: string;
  entities?: Array<{ token: string; kind: string; start: number; end: number }>;
  findings?: Finding[];
  risk?: Risk;
  saved_text?: string;
  changed?: boolean;
  content?: string;
  file_name?: string;
}

export const fmt = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "";

export const money = (n: number | null | undefined): string =>
  n == null ? "לפי הסכם" : Number(n).toLocaleString("he-IL", { style: "currency", currency: "ILS" });

const ERRORS: Record<string, string> = {
  PII_LEAK_BLOCKED: "הטקסט נחסם: זוהה מידע מזהה שלא ניתן היה להסתיר. הסירו אותו ונסו שוב.",
  FIRM_INACTIVE: "מנוי המשרד אינו פעיל.",
  TOO_LARGE: "הטקסט גדול מדי.",
  EMPTY_INPUT: "לא הוזן טקסט.",
  UNAUTHENTICATED: "פג תוקף ההתחברות. התחברו מחדש.",
  SIGN_OFF_REQUIRED: "הייצוא חסום עד להשלמת ארבעת שלבי האישור על הטקסט הנוכחי.",
  PIPELINE_UNAVAILABLE: "השירות אינו זמין כרגע. לא נשלח דבר לגורם חיצוני. נסו שוב.",
  NETWORK: "שגיאת רשת. נסו שוב.",
  LLM_UNAVAILABLE: "שירות ה-AI אינו זמין כרגע.",
};
export const errorText = (r: PipelineReply): string =>
  (r.code === "CONFLICT_HALT" && r.message) || ERRORS[r.code ?? ""] || "הפעולה נכשלה. נסו שוב.";

/** Calls the lalum-pipeline edge function with the signed-in user's token. */
export async function callPipeline(path: string, body: unknown): Promise<PipelineReply> {
  if (!supabase) return { ok: false, code: "NETWORK" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 55000);
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-pipeline${path}`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify(body),
    });
    try { return (await res.json()) as PipelineReply; } catch { return { ok: false, code: "BAD_RESPONSE" }; }
  } catch {
    return { ok: false, code: "NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}

export type DiffOp = "=" | "+" | "-";
/** Word level diff. Trims the common prefix and suffix, then an LCS over the middle (guarded for size). */
export function diffWords(a: string, b: string): Array<[DiffOp, string]> {
  const A = a.split(/(\s+)/).filter((x) => x !== "");
  const B = b.split(/(\s+)/).filter((x) => x !== "");
  let s = 0;
  while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let ea = A.length;
  let eb = B.length;
  while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
  const midA = A.slice(s, ea);
  const midB = B.slice(s, eb);
  const ops: Array<[DiffOp, string]> = A.slice(0, s).map((t) => ["=", t]);
  if (midA.length * midB.length > 4e6) {
    midA.forEach((t) => ops.push(["-", t]));
    midB.forEach((t) => ops.push(["+", t]));
  } else {
    const n = midA.length;
    const m = midB.length;
    const w = m + 1;
    const dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = midA[i] === midB[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) { ops.push(["=", midA[i]]); i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) ops.push(["-", midA[i++]]);
      else ops.push(["+", midB[j++]]);
    }
    while (i < n) ops.push(["-", midA[i++]]);
    while (j < m) ops.push(["+", midB[j++]]);
  }
  A.slice(ea).forEach((t) => ops.push(["=", t]));
  return ops;
}

export type Access =
  | { state: "loading" }
  | { state: "none" }
  | { state: "ok"; member: Membership | null; platformAdmin: boolean };

/** Firm membership and platform admin status for the signed-in user. */
export function useCockpitAccess(): Access {
  const { user } = useAuth();
  const [access, setAccess] = useState<Access>({ state: "loading" });
  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase || !user) { if (live) setAccess({ state: "none" }); return; }
      const [m, a] = await Promise.all([
        supabase.from("lalum_firm_members")
          .select("firm_id, name, role, lalum_firms(firm_name, status, subscription_tier, monthly_fee, seat_limit)")
          .eq("user_id", user.id).maybeSingle(),
        supabase.rpc("lalum_is_admin"),
      ]);
      if (!live) return;
      const member = (m.data as unknown as Membership | null) ?? null;
      const platformAdmin = a.data === true;
      setAccess(member || platformAdmin ? { state: "ok", member, platformAdmin } : { state: "none" });
    })();
    return () => { live = false; };
  }, [user]);
  return access;
}

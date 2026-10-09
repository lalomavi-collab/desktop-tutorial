// Calls from the finance screens to the database and to the lalum-fin-issue edge function.
import { supabase } from "../supabase";

export interface IssueReply {
  ok?: boolean; code?: string; doc_number?: number; allocation_number?: string | null; pdf_url?: string | null;
  is_test?: boolean; total_mismatch?: boolean; hint?: string; detail?: string;
  errors?: Array<{ id?: number; error?: string }>; status?: string;
}

const ISSUE_ERRORS: Record<string, string> = {
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.",
  not_found: "המסמך לא נמצא.",
  already_issued: "המסמך כבר הופק.",
  bad_related_document: "מסמך המקור חייב להיות מסמך שהופק לאותו לקוח, מהסוג המתאים ובאותה סביבה.",
  customer_not_found: "הלקוח לא נמצא.",
  customer_sync_failed: "פתיחת הלקוח ב-Invoice4U נכשלה. אם הלקוח כבר קיים שם, הזינו את מספר הלקוח שלו בכרטיס הלקוח.",
  invoice4u_rejected: "Invoice4U דחה את המסמך. הפרטים מופיעים בשורת המסמך.",
  invoice4u_not_configured: "החיבור ל-Invoice4U לא הוגדר בשרת.",
  outcome_uncertain: "לא התקבלה תשובה סופית. אל תפיקו שוב. לחצו על בדיקת סטטוס מול Invoice4U.",
  not_found_at_provider: "Invoice4U לא מכיר מסמך עם המזהה הזה. אפשר להפיק מחדש.",
  never_attempted: "לא בוצע ניסיון הפקה למסמך הזה.",
  fetch_failed: "שגיאת תקשורת. אל תפיקו שוב לפני בדיקת סטטוס מול Invoice4U.",
  network: "שגיאת רשת. אם ההפקה כבר נשלחה, בדקו סטטוס לפני ניסיון חוזר.",
};
export const issueError = (r: IssueReply): string => ISSUE_ERRORS[r.code ?? ""] ?? "הפעולה נכשלה. נסו שוב.";

const RPC_ERRORS: Record<string, string> = {
  FORBIDDEN: "אין הרשאה לפעולה.", BAD_TYPE: "סוג מסמך לא תקין.", BAD_CUSTOMER: "הלקוח לא נמצא.",
  BAD_LINES: "יש להזין בין שורה אחת ל-60 שורות.", BAD_LINE_NAME: "לכל שורה נדרש תיאור.",
  BAD_LINE_AMOUNT: "כמות ומחיר חייבים להיות גדולים מאפס.", NOT_A_DRAFT: "אפשר לערוך או למחוק טיוטה בלבד.",
  ISSUED_DOCUMENT_IMMUTABLE: "מסמך שהופק אינו ניתן לשינוי. לביטול הפיקו חשבונית זיכוי.",
};
export const rpcError = (message: string): string => RPC_ERRORS[Object.keys(RPC_ERRORS).find((k) => message.includes(k)) ?? ""] ?? message;

/** Issues a draft, or with action "reconcile" asks Invoice4U whether an uncertain attempt produced a document. */
export async function issueDocument(documentId: string, action: "issue" | "reconcile" = "issue"): Promise<IssueReply> {
  if (!supabase) return { ok: false, code: "network" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 55000);
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-issue`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify({ document_id: documentId, action }),
    });
    try { return (await res.json()) as IssueReply; } catch { return { ok: false, code: "fetch_failed" }; }
  } catch {
    // A timeout or dropped connection is NOT proof that nothing was issued.
    return { ok: false, code: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export interface ImportReply {
  ok?: boolean; code?: string; fetched?: number; inserted?: number; updated?: number; linked?: number; skipped?: number;
  doc_type?: number; errors?: string[]; per_type?: Record<string, number>;
}
const IMPORT_ERRORS: Record<string, string> = {
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.", forbidden: "אין הרשאה. נדרש שותף במשרד עם אימות דו שלבי.",
  invoice4u_not_configured: "החיבור ל-Invoice4U לא הוגדר בשרת.", invoice4u_rejected: "Invoice4U דחה את הבקשה. בדקו שמפתח ה-API תקף לסביבה שנבחרה.",
  archive_conflict: "Invoice4U מדווח סכומים שונים ממה שכבר נשמר לאחד המספרים. הייבוא נעצר ודורש בדיקה ידנית.",
  bad_range: "טווח תאריכים לא תקין.", db_error: "שמירה למסד הנתונים נכשלה.", fetch_failed: "שגיאת תקשורת מול Invoice4U.",
};
export const importError = (r: ImportReply): string => `${IMPORT_ERRORS[r.code ?? ""] ?? "הייבוא נכשל."}${r.doc_type ? ` (סוג מסמך ${r.doc_type})` : ""}`;

/** Read-only import from Invoice4U. Never creates or changes anything there. */
export async function importFromInvoice4u(body: { action: "customers" } | { action: "documents"; from: string; to: string }): Promise<ImportReply> {
  if (!supabase) return { ok: false, code: "fetch_failed" };
  const { data } = await supabase.auth.getSession();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-import`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify(body),
    });
    try { return (await res.json()) as ImportReply; } catch { return { ok: false, code: "fetch_failed" }; }
  } catch {
    return { ok: false, code: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

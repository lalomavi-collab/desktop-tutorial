// Browser side of lalum-fin-archive-backup: copies archive PDFs into the private backup bucket, one small batch per call.
// The answer carries document numbers and outcomes only. Repeating a run is safe: documents already saved are skipped.
import { supabase } from "../supabase";

export const BACKUP_BATCH = 10;
export interface BackupBatch { total: number; next: number | null; saved: number; skipped: number; failed: number; failures: Array<{ doc_number: number; outcome: string; detail?: string }> }
export type BackupResult = ({ ok: true } & BackupBatch) | { ok: false; text: string };

/** What a failed outcome means, in one line each. */
export const BACKUP_OUTCOME: Record<string, string> = {
  no_cipher: "אין צופן שמור למסמך", download_failed: "ההורדה מהספק נכשלה", not_pdf: "הספק לא החזיר קובץ PDF", too_large: "הקובץ גדול מדי", upload_failed: "השמירה בגיבוי נכשלה", not_stored: "הקובץ לא נמצא בגיבוי אחרי השמירה",
};

export async function backupArchiveBatch(offset: number): Promise<BackupResult> {
  if (!supabase) return { ok: false, text: "אין חיבור למערכת." };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, text: "ההתחברות פגה. התחברו מחדש." };
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-archive-backup`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify({ offset, limit: BACKUP_BATCH }),
    });
  } catch { return { ok: false, text: "אין תקשורת עם השרת." }; }
  if (res.status === 404) return { ok: false, text: "הגיבוי עדיין לא הופעל בשרת." };
  if (res.status === 401 || res.status === 403) return { ok: false, text: "אין הרשאה לגבות. נדרשת הרשאת מנהל כספים ואימות דו שלבי." };
  const b = (await res.json().catch(() => null)) as { ok?: boolean; total?: number; next?: number | null; saved?: number; skipped?: number; failed?: number; results?: Array<{ doc_number: number; outcome: string; detail?: string }> } | null;
  if (!b?.ok) return { ok: false, text: "הגיבוי נכשל. נסו שוב בעוד רגע." };
  return { ok: true, total: b.total ?? 0, next: b.next ?? null, saved: b.saved ?? 0, skipped: b.skipped ?? 0, failed: b.failed ?? 0, failures: (b.results ?? []).filter((r) => r.outcome !== "saved" && r.outcome !== "skipped") };
}

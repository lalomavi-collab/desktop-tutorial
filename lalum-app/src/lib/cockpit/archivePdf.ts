// Browser side of lalum-fin-archive-pdf: asks for the provider's print link of one history archive document.
// Nothing is stored. On failure the text says in one line what happened; when the provider answered without a link, the technical account of the
// operations tried (names only) travels separately in `detail`, for the screen to keep behind a collapsed "technical details".
import { supabase } from "../supabase";

export type PdfResult = { ok: true; url: string } | { ok: false; text: string; detail?: string };

export async function archivePdfLink(archiveId: string): Promise<PdfResult> {
  if (!supabase) return { ok: false, text: "אין חיבור למערכת." };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, text: "ההתחברות פגה. התחברו מחדש." };
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-archive-pdf`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify({ archive_id: archiveId }),
    });
  } catch { return { ok: false, text: "אין תקשורת עם השרת." }; }
  if (res.status === 404) return { ok: false, text: "ההורדה עדיין לא הופעלה בשרת." };
  if (res.status === 401 || res.status === 403) return { ok: false, text: "אין הרשאה להוריד את המסמך. נדרשת הרשאת כספים ואימות דו שלבי." };
  const body = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; code?: string; tried?: Array<{ op: string; http: number | null; errors: string[]; filled?: boolean; keys?: string[]; linkFields?: Array<{ key: string; length: number; host: string | null }>; shape?: string | null }> } | null;
  if (body?.ok && typeof body.url === "string") return { ok: true, url: body.url };
  if (body?.code === "no_link") {
    const tried = (body.tried ?? []).map((t) => {
      const links = (t.linkFields ?? []).map((l) => `${l.key}=${l.length} תווים${l.host ? ` ב-${l.host}` : ""}`).join(", ");
      return `${t.op} (${t.http ?? "ללא מענה"}${t.errors.length ? `: ${t.errors.join(", ")}` : ""}${t.http === 200 ? `; מבנה: ${t.shape ?? "?"}; שדות: ${(t.keys ?? []).join(", ") || "אין"}; שדות קישור: ${links || "אין"}` : ""})`;
    }).join("; ");
    return { ok: false, text: "ההורדה של המסמך מהארכיון אינה זמינה כרגע. אפשר להוריד אותו ישירות ממערכת ההיסטוריה.", detail: `מערכת ההיסטוריה לא החזירה קישור להורדה למסמך הזה. נוסו: ${tried || "ללא פרטים"}.` };
  }
  return { ok: false, text: "ההורדה נכשלה. נסו שוב בעוד רגע." };
}

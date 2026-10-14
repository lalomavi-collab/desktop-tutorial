// Opening a document's original from the private vault (migration 0047 and the lalum-open-original edge function).
// The function decides and audits; this only asks and returns the 60 second link. The button is shown only when
// VITE_OPEN_ORIGINAL is "1", set after the function is deployed, so merging this never ships a dead button.
import { supabase } from "../supabase";

export const openOriginalEnabled = (): boolean => import.meta.env.VITE_OPEN_ORIGINAL === "1";

export type OpenResult = { ok: true; url: string } | { ok: false; message: string };

export function openMessage(status: number): string {
  if (status === 401) return "יש להתחבר מחדש.";
  if (status === 403) return "אין הרשאה לפתוח את המקור, או שאין קובץ מקור למסמך, או שנדרש אימות דו שלבי.";
  if (status === 404) return "שירות פתיחת המקור עדיין לא זמין.";
  return "פתיחת המקור נכשלה. נסו שוב.";
}

export async function openOriginal(documentId: string): Promise<OpenResult> {
  if (!supabase) return { ok: false, message: openMessage(0) };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: openMessage(401) };
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-open-original`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify({ document_id: documentId }),
    });
    if (!res.ok) return { ok: false, message: openMessage(res.status) };
    const body = (await res.json()) as { ok?: boolean; url?: string };
    return body.ok && typeof body.url === "string" ? { ok: true, url: body.url } : { ok: false, message: openMessage(500) };
  } catch {
    return { ok: false, message: openMessage(0) };
  }
}

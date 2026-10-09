// Recycle bin (LALUMap migration lalum_recycle_bin). Trash is reversible; permanent deletion is guarded in the database
// (typed confirmation, legal hold, statutory retention) and removes the stored originals through the Storage API.
import { supabase } from "../supabase";

export const CONFIRM_TEXT = "מחיקה סופית";

export interface BinItem {
  kind: "MATTER" | "DOCUMENT"; id: string; matter_id: string; label: string; deleted_at: string; reason: string | null;
  items: number; blocker: string | null; purge_requested: boolean;
}

const BLOCKERS: Record<string, string> = {
  LEGAL_HOLD: "יש עיכוב משפטי פעיל על התיק, ולכן אי אפשר למחוק.",
  RETENTION_PERIOD: "תקופת השמירה החוקית של התיק טרם הסתיימה, ולכן אי אפשר למחוק (7 שנים מסיום הטיפול, 25 למסמכי מקרקעין, אלא אם הלקוח הסכים בכתב).",
};

export function binError(message: string | undefined): string {
  const m = message ?? "";
  for (const [k, v] of Object.entries(BLOCKERS)) if (m.includes(k)) return v;
  if (m.includes("reason required")) return "יש לציין סיבה (לפחות 3 תווים).";
  if (m.includes("confirmation")) return `יש להקליד בדיוק: ${CONFIRM_TEXT}`;
  if (m.includes("not allowed")) return "הפעולה מותרת לשותף במשרד עם אימות דו-שלבי בלבד.";
  if (m.includes("objects remain")) return "חלק מהקבצים המקוריים לא נמחקו מהאחסון. נסו שוב.";
  if (m.includes("cannot restore")) return "לא ניתן לשחזר: המחיקה הסופית כבר החלה.";
  return "הפעולה נכשלה.";
}

export async function binList(): Promise<BinItem[]> {
  if (!supabase) return [];
  const { data } = await supabase.rpc("lalum_bin_list");
  return (data as BinItem[] | null) ?? [];
}

async function call(fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  if (!supabase) return { ok: false, error: "הפעולה נכשלה." };
  const { data, error } = await supabase.rpc(fn, args);
  return error ? { ok: false, error: binError(error.message) } : { ok: true, data };
}

export const trashMatter = (id: string, reason: string) => call("lalum_trash_matter", { p_matter: id, p_reason: reason });
export const restoreMatter = (id: string) => call("lalum_restore_matter", { p_matter: id });
export const trashDoc = (id: string) => call("lalum_trash_doc", { p_doc: id });
export const restoreDoc = (id: string) => call("lalum_restore_doc", { p_doc: id });

async function removeObjects(paths: string[]): Promise<boolean> {
  if (!supabase || !paths.length) return true;
  for (let i = 0; i < paths.length; i += 100) {
    const r = await supabase.storage.from("matter-originals").remove(paths.slice(i, i + 100));
    if (r.error) return false;
  }
  return true;
}

/** Permanent deletion: flag in the database, remove the objects, then let the database verify and finish. */
export async function purge(item: Pick<BinItem, "kind" | "id">, confirm: string): Promise<{ ok: boolean; error?: string }> {
  const matter = item.kind === "MATTER";
  const req = await call(matter ? "lalum_request_purge_matter" : "lalum_request_purge_doc", matter ? { p_matter: item.id, p_confirm: confirm } : { p_doc: item.id, p_confirm: confirm });
  if (!req.ok) return req;
  const paths = matter ? ((req.data as string[] | null) ?? []) : req.data ? [String(req.data)] : [];
  if (!(await removeObjects(paths))) return { ok: false, error: "מחיקת הקבצים המקוריים מהאחסון נכשלה. ניתן לנסות שוב." };
  return call(matter ? "lalum_finish_purge_matter" : "lalum_finish_purge_doc", matter ? { p_matter: item.id } : { p_doc: item.id });
}

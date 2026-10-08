// Duplicate detection by content. Every stored original carries its SHA-256, so a file that is already in the vault
// is found by hash, whatever its name or folder. RLS limits the lookup to the caller's firm.
import { supabase } from "../supabase";

export async function sha256File(file: File): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** hash -> every matter id that already holds that file, for the hashes that exist in this firm's vault. */
export async function findExisting(hashes: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!supabase || !hashes.length) return out;
  const unique = [...new Set(hashes)];
  for (let i = 0; i < unique.length; i += 100) {
    const { data } = await supabase.from("lalum_matter_documents").select("matter_id, original_sha256").in("original_sha256", unique.slice(i, i + 100));
    for (const r of (data as Array<{ matter_id: string; original_sha256: string }> | null) ?? []) { const l = out.get(r.original_sha256) ?? []; if (!l.includes(r.matter_id)) l.push(r.matter_id); out.set(r.original_sha256, l); }
  }
  return out;
}

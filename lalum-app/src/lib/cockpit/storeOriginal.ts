// Stores the original file of a document in the private, write-once matter vault (bucket matter-originals).
// The object name never contains the file name (names often carry client names): path is firm/matter/document/original.<ext>.
// The SHA-256 is computed here, before upload, and recorded by lalum_attach_original in the hash chained audit log.
import { supabase } from "../supabase";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain", md: "text/markdown", html: "text/html", htm: "text/html",
};

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function storeOriginal(firmId: string, matterId: string, documentId: string, file: File, knownHash?: string): Promise<boolean> {
  if (!supabase) return false;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mime = MIME[ext];
  if (!mime || file.size === 0) return false;
  try {
    const buf = await file.arrayBuffer();
    const hash = knownHash ?? (await sha256Hex(buf));
    const path = `${firmId}/${matterId}/${documentId}/original.${ext}`;
    const up = await supabase.storage.from("matter-originals").upload(path, new Blob([buf], { type: mime }), { contentType: mime, upsert: false });
    if (up.error) return false;
    const { error } = await supabase.rpc("lalum_attach_original", { p_doc: documentId, p_path: path, p_sha256: hash, p_size: file.size, p_mime: mime });
    return !error;
  } catch {
    return false;
  }
}

// Browser side of the firm wide handover package: the RPC calls of migration 0066, the SHA-256, the ZIP and the download.
// All the rules live in firmExportCore.ts; this file only connects it to Supabase and the browser.
import { supabase } from "../supabase";
import { buildPackage, ExportError, zipName } from "./firmExportCore.ts";
import type { Built, OriginalsPort, Ports } from "./firmExportCore.ts";

const sha256 = async (s: string): Promise<string> => {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** The originals step is shown only when VITE_EXPORT_ORIGINALS is "1", set after lalum-export-originals is deployed, so merging this never ships a step that fails. */
export const exportOriginalsEnabled = (): boolean => import.meta.env.VITE_EXPORT_ORIGINALS === "1";

const sha256Bytes = async (b: Uint8Array): Promise<string> => {
  const d = await crypto.subtle.digest("SHA-256", b as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
};

const originalsPort = (firmId: string): OriginalsPort => ({
  list: async () => {
    const { data } = await supabase!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-export-originals`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify({ firm_id: firmId }),
    });
    return res.ok ? await res.json() : null;
  },
  fetchBytes: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return new Uint8Array(await res.arrayBuffer());
  },
  digestBytes: sha256Bytes,
});

const ports = (firmId: string): Ports => ({
  ...(exportOriginalsEnabled() ? { originals: originalsPort(firmId) } : {}),
  manifest: async () => {
    const { data, error } = await supabase!.rpc("lalum_firm_export_manifest", { p_firm: firmId });
    if (error) throw new ExportError("MANIFEST", error.message);
    return data;
  },
  page: async (table, offset, limit) => {
    const { data, error } = await supabase!.rpc("lalum_firm_export_page", { p_firm: firmId, p_table: table, p_offset: offset, p_limit: limit });
    if (error) throw new ExportError("PAGE", table);
    return data;
  },
  digest: sha256,
  now: () => new Date(),
});

/** Builds the package and downloads it as a ZIP. Throws ExportError on any integrity failure and downloads nothing. */
export async function exportFirmPackage(firmId: string, onProgress?: (done: number, total: number, table: string) => void, onOriginals?: (done: number, total: number) => void): Promise<Built> {
  if (!supabase) throw new ExportError("MANIFEST", "no connection");
  const built = await buildPackage(ports(firmId), { onProgress, onOriginals });
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  // A byte order mark on the text files so Hebrew opens correctly in Windows tools; the data files stay byte exact because the hashes cover them.
  // Originals are already compressed (PDF, DOCX), so they are stored as they are; the JSON files are deflated.
  for (const f of built.files) {
    if (f.binary) zip.file(f.path, f.content as Uint8Array, { binary: true, compression: "STORE" });
    else zip.file(f.path, f.path === "README.txt" ? "﻿" + f.content : (f.content as string));
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = zipName(firmId, new Date());
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  return built;
}

// Browser side of the firm wide handover package: the RPC calls of migration 0066, the SHA-256, the ZIP and the download.
// All the rules live in firmExportCore.ts; this file only connects it to Supabase and the browser.
import { supabase } from "../supabase";
import { buildPackage, ExportError, zipName } from "./firmExportCore.ts";
import type { Built, Ports } from "./firmExportCore.ts";

const sha256 = async (s: string): Promise<string> => {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const ports = (firmId: string): Ports => ({
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
export async function exportFirmPackage(firmId: string, onProgress?: (done: number, total: number, table: string) => void): Promise<Built> {
  if (!supabase) throw new ExportError("MANIFEST", "no connection");
  const built = await buildPackage(ports(firmId), { onProgress });
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  // A byte order mark on the text files so Hebrew opens correctly in Windows tools; the data files stay byte exact because the hashes cover them.
  for (const f of built.files) zip.file(f.path, f.path === "README.txt" ? "﻿" + f.content : f.content);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = zipName(firmId, new Date());
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  return built;
}

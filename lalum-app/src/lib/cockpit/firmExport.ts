// Browser side of the firm wide handover package: the RPC calls of migration 0066, the SHA-256, the ZIP and the download.
// All the rules live in firmExportCore.ts; this file only connects it to Supabase and the browser.
import { supabase } from "../supabase";
import { buildPackage, ExportError, zipName } from "./firmExportCore.ts";
import type { Built, OriginalsPort, PackageFile, Ports } from "./firmExportCore.ts";

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
  list: async (after) => {
    const { data } = await supabase!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-export-originals`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify({ firm_id: firmId, after }),
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

const pause = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Zips one volume and hands it to the browser as a download. Originals are already compressed (PDF, DOCX), so they are stored as they are; the JSON files are deflated. */
async function saveZip(files: PackageFile[], name: string): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  // A byte order mark on the text files so Hebrew opens correctly in Windows tools; the data files stay byte exact because the hashes cover them.
  for (const f of files) {
    if (f.binary) zip.file(f.path, f.content as Uint8Array, { binary: true, compression: "STORE" });
    else zip.file(f.path, f.path === "README.txt" ? "﻿" + f.content : (f.content as string));
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 15_000);
}

/** Builds the package and downloads it: one ZIP for a firm that fits in a volume, else several (part-01, part-02 ...), the last holding the tables, PACKAGE.json and README.txt.
 *  Throws ExportError on any integrity failure; tables are verified before any ZIP is written, and each volume leaves memory as soon as it is handed to the browser. */
export async function exportFirmPackage(firmId: string, onProgress?: (done: number, total: number, table: string) => void, onOriginals?: (done: number, total: number) => void, onVolume?: (index: number, last: boolean) => void): Promise<Built> {
  if (!supabase) throw new ExportError("MANIFEST", "no connection");
  const base = zipName(firmId, new Date());
  const part = (n: number) => base.replace(/\.zip$/, `-part-${String(n).padStart(2, "0")}.zip`);
  return buildPackage(ports(firmId), {
    onProgress, onOriginals,
    emit: async (v) => {
      await saveZip(v.files, v.last && v.index === 1 ? base : part(v.index));
      onVolume?.(v.index, v.last);
      // a pause between downloads: browsers ask before allowing several, and a freed volume is not yet collected
      if (!v.last) await pause(1500);
    },
  });
}

import { useCallback, useEffect, useState } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../components/Icon";

// Firm-wide view of every client's uploaded documents, moved out of the client
// portal into the cockpit. It lists a folder per client and downloads a single
// file or the client's whole folder as one zip. The files themselves are
// served by the lalum-admin-files edge function, which authorises the caller;
// the screen is also gated to an admin here. Logic is unchanged from its former
// home in the portal.

type AdminFile = { name: string; raw_name: string; path: string; size: number; created_at: string | null; url: string };
type AdminClient = { client_id: string; email: string; name: string; file_count: number; files: AdminFile[] };

const prettySize = (bytes: number) => (bytes > 0 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : "");

function ClientDocumentsInner({ canView }: { canView: boolean }) {
  const [adminDocs, setAdminDocs] = useState<AdminClient[]>([]);
  const [docsState, setDocsState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [zipBusy, setZipBusy] = useState<string | undefined>();
  const [openClient, setOpenClient] = useState<string | undefined>();

  const loadAdminDocs = useCallback(async () => {
    if (!supabase) return;
    setDocsState("loading");
    try {
      const { data, error } = await supabase.functions.invoke("lalum-admin-files", { body: { action: "list" } });
      if (error) throw error;
      setAdminDocs((data?.clients ?? []) as AdminClient[]);
      setDocsState("ready");
    } catch {
      setDocsState("unavailable");
    }
  }, []);

  useEffect(() => { if (canView) void loadAdminDocs(); }, [canView, loadAdminDocs]);

  async function downloadAllZip(c: AdminClient) {
    if (!supabase) return;
    setZipBusy(c.client_id);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of c.files) {
        let url = f.url;
        if (!url) {
          const { data } = await supabase.functions.invoke("lalum-admin-files", { body: { action: "sign", path: f.path } });
          url = (data?.url as string) ?? "";
        }
        if (!url) continue;
        const blob = await (await fetch(url)).blob();
        zip.file(f.name, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      const label = (c.name || c.email || c.client_id).replace(/[^\w.@-]+/g, "_");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = `${label}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } finally {
      setZipBusy(undefined);
    }
  }

  if (!canView) return <div className="ck-card"><div className="ck-title">אין הרשאה</div><div className="ck-meta">צפייה במסמכי הלקוחות של הפירמה פתוחה למנהל הפירמה.</div></div>;

  return (
    <div className="card" style={{ padding: 34, marginBottom: 28 }}>
      {docsState === "loading" && <p className="muted" style={{ fontSize: 14 }}>טוען מסמכים...</p>}
      {docsState === "unavailable" && <p className="muted" style={{ fontSize: 14 }}>שירות המסמכים אינו פעיל כרגע.</p>}
      {docsState === "ready" && adminDocs.length === 0 && <p className="muted" style={{ fontSize: 14 }}>אין עדיין מסמכי לקוחות.</p>}
      {docsState === "ready" && adminDocs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {adminDocs.map((c) => {
            const open = openClient === c.client_id;
            const label = c.name || c.email || "לקוח ללא שם";
            return (
              <div key={c.client_id} style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setOpenClient(open ? undefined : c.client_id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", flex: 1, minWidth: 180, textAlign: "start", font: "inherit", color: "inherit" }}>
                    <Icon name="folder" size={18} />
                    <span>
                      <span style={{ fontWeight: 600, display: "block" }}>{label}</span>
                      {c.email && c.name && <span className="muted" style={{ fontSize: 12 }} dir="ltr">{c.email}</span>}
                    </span>
                    <span className="muted" style={{ fontSize: 12.5, marginInlineStart: "auto" }}>{c.file_count} קבצים</span>
                  </button>
                  <button type="button" className="btn btn-clay btn-sm" disabled={zipBusy === c.client_id} onClick={() => void downloadAllZip(c)}>
                    <Icon name="folder" size={14} /> {zipBusy === c.client_id ? "מכין zip..." : "הורדת הכול (zip)"}
                  </button>
                </div>
                {open && (
                  <div style={{ borderTop: "1px solid var(--line)", padding: "8px 16px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {c.files.map((f) => (
                      <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                        <Icon name="file" size={15} />
                        <span style={{ flex: 1, fontSize: 14, wordBreak: "break-word" }}>{f.name}</span>
                        <span className="muted" style={{ fontSize: 12 }}>{prettySize(f.size)}</span>
                        {f.url
                          ? <a className="btn btn-ghost btn-sm" href={f.url} target="_blank" rel="noopener noreferrer">הורדה</a>
                          : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Firm-wide client documents, framed for the cockpit. */
export function ClientDocuments() {
  return (
    <CockpitFrame title="מסמכי לקוחות" description="כל הקבצים שהעלו הלקוחות, בתיקייה לכל לקוח, עם הורדה בודדת או כ-zip." path="/workspace/client-docs">
      {({ member, platformAdmin }) => <ClientDocumentsInner canView={platformAdmin || member?.role === "ADMIN"} />}
    </CockpitFrame>
  );
}

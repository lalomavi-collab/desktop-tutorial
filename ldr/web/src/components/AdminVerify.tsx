import { useEffect, useState } from "react";
import { supabase, VERIFICATION_LABELS, LICENSE_LABELS, type Profile, type VerificationStatus } from "../lib/supabase";

interface PendingRow {
  id: string;
  display_name: string | null;
  license_type: string | null;
  license_no: string | null;
  license_doc: string | null;
  verification_status: VerificationStatus;
  created_at?: string;
}

export default function AdminVerify({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<VerificationStatus | "all">("pending");

  async function load() {
    setLoading(true);
    let q = supabase.from("ldr_profiles")
      .select("id,display_name,license_type,license_no,license_doc,verification_status")
      .order("verification_status");
    if (filter !== "all") q = q.eq("verification_status", filter);
    const { data, error } = await q;
    if (error) { notify("שגיאת טעינה: " + error.message); setLoading(false); return; }
    setRows((data as PendingRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function getDocUrl(path: string, id: string) {
    if (docUrls[id]) { window.open(docUrls[id], "_blank"); return; }
    const { data, error } = await supabase.storage.from("licenses").createSignedUrl(path, 300);
    if (error || !data) { notify("שגיאה בהורדת מסמך"); return; }
    setDocUrls((prev) => ({ ...prev, [id]: data.signedUrl }));
    window.open(data.signedUrl, "_blank");
  }

  async function decide(id: string, status: "verified" | "rejected") {
    setBusy(id);
    const { error } = await supabase.from("ldr_profiles")
      .update({ verification_status: status })
      .eq("id", id);
    setBusy(null);
    if (error) { notify("שגיאה: " + error.message); return; }
    notify(status === "verified" ? "✓ עו״ד אושר לרשת" : "✕ בקשה נדחתה");
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, verification_status: status } : r));
  }

  const counts = rows.reduce((acc, r) => {
    acc[r.verification_status] = (acc[r.verification_status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="container" style={{ paddingTop: 26, maxWidth: 860 }}>
      <h2 style={{ margin: 0 }}>⚙ לוח ניהול — אימות עורכי דין</h2>
      <p className="muted">בדקו כל בקשה, פתחו את המסמך המצורף, ואשרו או דחו את הגישה לרשת.</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "pending", "verified", "rejected", "unverified"] as const).map((s) => (
          <button
            key={s}
            className={`btn ${filter === s ? "btn-gold" : "btn-ghost"}`}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "הכל" : VERIFICATION_LABELS[s as VerificationStatus]}
            {s !== "all" && counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={load} disabled={loading}>רענן</button>
      </div>

      {loading ? (
        <div className="center" style={{ padding: 50 }}><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="card pad center"><p className="muted">אין בקשות בסטטוס זה.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} className="card pad" style={{
              borderColor: r.verification_status === "pending" ? "var(--gold)" :
                r.verification_status === "verified" ? "var(--green, #4caf50)" :
                r.verification_status === "rejected" ? "var(--burgundy-soft)" : undefined,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{r.display_name || "(ללא שם)"}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {r.license_type ? LICENSE_LABELS[r.license_type as keyof typeof LICENSE_LABELS] : "—"}
                    {r.license_no && <> · מס׳ <span dir="ltr">{r.license_no}</span></>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }} dir="ltr">{r.id}</div>
                </div>

                <span className={`tag ${r.verification_status === "pending" ? "gold" : ""}`} style={{ fontSize: 13 }}>
                  {VERIFICATION_LABELS[r.verification_status]}
                </span>

                <div style={{ display: "flex", gap: 8 }}>
                  {r.license_doc && (
                    <button className="btn btn-ghost" onClick={() => getDocUrl(r.license_doc!, r.id)}>
                      📎 מסמך
                    </button>
                  )}
                  {r.verification_status !== "verified" && (
                    <button
                      className="btn btn-gold" disabled={busy === r.id}
                      onClick={() => decide(r.id, "verified")}
                    >
                      {busy === r.id ? <span className="spinner" /> : "✓ אשר"}
                    </button>
                  )}
                  {r.verification_status !== "rejected" && (
                    <button
                      className="btn btn-ghost" disabled={busy === r.id}
                      style={{ borderColor: "var(--burgundy-soft)", color: "var(--burgundy-soft)" }}
                      onClick={() => decide(r.id, "rejected")}
                    >
                      {busy === r.id ? <span className="spinner" /> : "✕ דחה"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

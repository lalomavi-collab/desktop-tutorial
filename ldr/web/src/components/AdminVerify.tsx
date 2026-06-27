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

interface VReq {
  match_result: string;
  submitted_name: string;
  submitted_license_no: string;
  created_at: string;
}

// Registry match signal → Hebrew label + tone.
const MATCH: Record<string, { label: string; tone: string }> = {
  auto_matched:    { label: "✓ התאמה מלאה במאגר הלשכה", tone: "var(--ok)" },
  name_mismatch:   { label: "⚠ מספר נמצא — שם לא תואם במדויק", tone: "var(--gold)" },
  not_found:       { label: "✕ לא נמצא במאגר", tone: "var(--burgundy-soft)" },
  suspended:       { label: "⛔ רישיון לא פעיל/מושעה", tone: "var(--burgundy-soft)" },
  manual_approved: { label: "✓ אושר ידנית", tone: "var(--ok)" },
  manual_rejected: { label: "✕ נדחה ידנית", tone: "var(--burgundy-soft)" },
};

export default function AdminVerify({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<VerificationStatus | "all">("pending");
  const [reqs, setReqs] = useState<Record<string, VReq>>({}); // latest request per user

  async function load() {
    setLoading(true);
    let q = supabase.from("ldr_profiles")
      .select("id,display_name,license_type,license_no,license_doc,verification_status")
      .order("verification_status");
    if (filter !== "all") q = q.eq("verification_status", filter);
    const { data, error } = await q;
    if (error) { notify("שגיאת טעינה: " + error.message); setLoading(false); return; }
    const list = (data as PendingRow[]) ?? [];
    setRows(list);

    // Pull the latest registry-match signal for the listed users.
    if (list.length) {
      const { data: vr } = await supabase.from("verification_requests")
        .select("user_id,match_result,submitted_name,submitted_license_no,created_at")
        .in("user_id", list.map((r) => r.id))
        .order("created_at", { ascending: false });
      const latest: Record<string, VReq> = {};
      (vr ?? []).forEach((v: any) => { if (!latest[v.user_id]) latest[v.user_id] = v; });
      setReqs(latest);
    } else {
      setReqs({});
    }
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
    if (!error) {
      // Audit the manual decision.
      await supabase.from("verification_requests").insert({
        user_id: id,
        submitted_name: reqs[id]?.submitted_name ?? (rows.find((r) => r.id === id)?.display_name ?? ""),
        submitted_license_no: reqs[id]?.submitted_license_no ?? (rows.find((r) => r.id === id)?.license_no ?? ""),
        jurisdiction: "IL",
        match_result: status === "verified" ? "manual_approved" : "manual_rejected",
        reviewer_id: profile.id,
      });
    }
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
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 860 }}>
      <div className="section-header"><h2>⚙ לוח ניהול — אימות עורכי דין</h2></div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 16 }}>
        כל בקשה מציגה את תוצאת ההצלבה מול מאגר לשכת עורכי הדין. בדקו, פתחו את המסמך המצורף, ואשרו או דחו את הגישה לרשת.
      </p>

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
        <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => {
            const sig = reqs[r.id] ? MATCH[reqs[r.id].match_result] : null;
            return (
              <div key={r.id} className="card pad card-interactive" style={{
                borderColor: r.verification_status === "pending" ? "var(--gold)" :
                  r.verification_status === "verified" ? "var(--ok)" :
                  r.verification_status === "rejected" ? "var(--burgundy-soft)" : undefined,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{r.display_name || "(ללא שם)"}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {r.license_type ? LICENSE_LABELS[r.license_type as keyof typeof LICENSE_LABELS] : "—"}
                      {r.license_no && <> · מס׳ <span dir="ltr">{r.license_no}</span></>}
                    </div>
                    {sig && (
                      <div style={{ fontSize: 12, marginTop: 4, color: sig.tone, fontWeight: 600 }}>
                        {sig.label}
                        {reqs[r.id].submitted_name && reqs[r.id].submitted_name !== r.display_name && (
                          <span className="muted" style={{ fontWeight: 400 }}> · הוזן: {reqs[r.id].submitted_name}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <span className={`tag ${r.verification_status === "pending" ? "tag-gold" : ""}`} style={{ fontSize: 13 }}>
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
                        className="btn btn-danger" disabled={busy === r.id}
                        onClick={() => decide(r.id, "rejected")}
                      >
                        {busy === r.id ? <span className="spinner" /> : "✕ דחה"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

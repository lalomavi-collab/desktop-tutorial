import { useEffect, useState } from "react";
import {
  supabase, PRACTICE_AREAS, JURISDICTIONS, EXPERIENCE_TIERS,
  PRACTICE_AREA_LABELS, JURISDICTION_LABELS, EXPERIENCE_LABELS,
  type Profile, type ExperienceTier,
} from "../lib/supabase";
import { rankFor } from "../lib/reputation";

// "Taxi-style" attorney discovery: pick criteria, every matching verified
// attorney surfaces — ranked by Authority Tier / reputation.
export default function Directory({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const [area, setArea] = useState<string>("");
  const [juris, setJuris] = useState<string>("");
  const [tier, setTier] = useState<ExperienceTier | "">("");
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    let q = supabase.from("ldr_profiles").select("*")
      .not("experience_tier", "is", null)
      .neq("id", profile.id);
    if (area) q = q.contains("practice_areas", [area]);
    if (juris) q = q.eq("jurisdiction", juris);
    if (tier) q = q.eq("experience_tier", tier);
    const { data } = await q.order("reputation", { ascending: false }).limit(50);
    setRows((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { search(); /* initial: all verified attorneys */ }, []);

  return (
    <div className="container" style={{ paddingTop: 26 }}>
      <h2 style={{ margin: 0 }}>איתור עו״ד על ה-Grid</h2>
      <p className="muted">
        בחרו תחום, שיפוט ודרגה — וכל עו״ד מאומת שעונה לקריטריון יופיע מיד, מדורג לפי Authority Tier.
      </p>

      <div className="card pad" style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "end" }}>
        <div>
          <label>תחום עיסוק</label>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">כל התחומים</option>
            {PRACTICE_AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label>תחום שיפוט</label>
          <select value={juris} onChange={(e) => setJuris(e.target.value)}>
            <option value="">כל העולם</option>
            {JURISDICTIONS.map((j) => <option key={j.key} value={j.key}>{j.flag} {j.label}</option>)}
          </select>
        </div>
        <div>
          <label>דרגת ותק</label>
          <select value={tier} onChange={(e) => setTier(e.target.value as ExperienceTier | "")}>
            <option value="">כל הדרגות</option>
            {EXPERIENCE_TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <button className="btn btn-gold" onClick={search} disabled={loading}>
          {loading ? <span className="spinner" /> : "איתור"}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div className="center" style={{ padding: 40 }}><span className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div className="card pad center"><p className="muted">לא נמצאו עו״ד התואמים לקריטריון. נסו להרחיב את הסינון.</p></div>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{rows.length} עו״ד תואמים</div>
            <div className="grid cols-2">
              {rows.map((r) => {
                const rp = rankFor(r.reputation);
                return (
                  <div key={r.id} className="card pad">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{r.display_name || "עו״ד אנונימי"}</span>
                      <span className="gold" style={{ fontSize: 12, fontWeight: 700 }} dir="ltr">
                        {rp.rank.icon} {rp.rank.title}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      {r.jurisdiction && JURISDICTION_LABELS[r.jurisdiction]}
                      {r.experience_tier && " · " + EXPERIENCE_LABELS[r.experience_tier]}
                      {" · "}{r.reputation} מוניטין
                    </div>
                    <div className="chip-select" style={{ marginTop: 10 }}>
                      {(r.practice_areas ?? []).map((a) => (
                        <span key={a} className="chip">{PRACTICE_AREA_LABELS[a] ?? a}</span>
                      ))}
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ width: "100%", marginTop: 12 }}
                      onClick={() => notify("ערוץ ההפניות המאובטח (Escrow) ייפתח בשלב ה-Marketplace 🔐")}
                    >
                      פתיחת ערוץ מאובטח
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

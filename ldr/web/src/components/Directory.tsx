import { useEffect, useState } from "react";
import {
  supabase, PRACTICE_AREAS, JURISDICTIONS, EXPERIENCE_TIERS,
  PRACTICE_AREA_LABELS, JURISDICTION_LABELS, EXPERIENCE_LABELS,
  type Profile, type DemoAttorney, type ExperienceTier,
} from "../lib/supabase";
import { rankFor } from "../lib/reputation";
import Avatar from "./Avatar";

interface Entry {
  id: string;
  name: string | null;
  jurisdiction: string | null;
  practice_areas: string[];
  experience_tier: ExperienceTier | null;
  reputation: number;
  headline: string | null;
  verified: boolean;
  demo: boolean;
}

// "Taxi-style" attorney discovery: pick criteria, every matching verified
// attorney surfaces — ranked by Authority Tier / reputation.
export default function Directory({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const [area, setArea] = useState<string>("");
  const [juris, setJuris] = useState<string>("");
  const [tier, setTier] = useState<ExperienceTier | "">("");
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [endorsed, setEndorsed] = useState<Set<string>>(new Set());

  async function endorse(id: string) {
    setEndorsed((prev) => new Set(prev).add(id)); // optimistic
    const { error } = await supabase.from("ldr_endorsements")
      .insert({ endorser_id: profile.id, endorsed_id: id });
    if (error) {
      setEndorsed((prev) => { const n = new Set(prev); n.delete(id); return n; });
      notify(error.code === "23505" ? "כבר המלצת על עו״ד זה" : "שגיאה בהמלצה");
      return;
    }
    notify("ההמלצה נרשמה — תרמת ל-Authority Tier של העמית 🤝");
  }

  async function search() {
    setLoading(true);

    let real = supabase.from("ldr_profiles").select("*")
      .not("experience_tier", "is", null).neq("id", profile.id);
    let demo = supabase.from("ldr_demo_attorneys").select("*");
    if (area) { real = real.contains("practice_areas", [area]); demo = demo.contains("practice_areas", [area]); }
    if (juris) { real = real.eq("jurisdiction", juris); demo = demo.eq("jurisdiction", juris); }
    if (tier) { real = real.eq("experience_tier", tier); demo = demo.eq("experience_tier", tier); }

    const [{ data: rp }, { data: dp }] = await Promise.all([
      real.order("reputation", { ascending: false }).limit(50),
      demo.order("reputation", { ascending: false }).limit(50),
    ]);

    const realEntries: Entry[] = ((rp as Profile[]) ?? []).map((r) => ({
      id: r.id, name: r.display_name, jurisdiction: r.jurisdiction,
      practice_areas: r.practice_areas ?? [], experience_tier: r.experience_tier,
      reputation: r.reputation, headline: r.headline,
      verified: r.verification_status === "verified", demo: false,
    }));
    const demoEntries: Entry[] = ((dp as DemoAttorney[]) ?? []).map((d) => ({
      id: d.id, name: d.display_name, jurisdiction: d.jurisdiction,
      practice_areas: d.practice_areas ?? [], experience_tier: d.experience_tier,
      reputation: d.reputation, headline: d.headline, verified: true, demo: true,
    }));

    setRows([...realEntries, ...demoEntries].sort((a, b) => b.reputation - a.reputation));
    setLoading(false);
  }

  useEffect(() => { search(); /* initial: all matching attorneys */ }, []);

  return (
    <div className="container" style={{ paddingTop: 26 }}>
      <h2 style={{ margin: 0 }}>איתור עו״ד ברשת</h2>
      <p className="muted">
        בחרו תחום, מדינה ודרגה — וכל עו״ד מאומת שעונה לקריטריון יופיע מיד, מדורג לפי Authority Tier.
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
          <label>מדינה</label>
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
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Avatar name={r.name} size={48} verified={r.verified} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, fontSize: 16 }}>{r.name || "עו״ד אנונימי"}</span>
                          {r.verified && <span className="tag" style={{ fontSize: 11 }}>✓ מאומת</span>}
                          {r.demo && <span className="tag" style={{ fontSize: 11, opacity: .8 }}>להמחשה</span>}
                        </div>
                        <div className="gold" style={{ fontSize: 12, fontWeight: 700 }} dir="ltr">
                          {rp.rank.icon} {rp.rank.title}
                        </div>
                      </div>
                    </div>
                    {r.headline && <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>{r.headline}</p>}
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {r.jurisdiction && JURISDICTION_LABELS[r.jurisdiction]}
                      {r.experience_tier && " · " + EXPERIENCE_LABELS[r.experience_tier]}
                      {" · "}{r.reputation} מוניטין
                    </div>
                    <div className="chip-select" style={{ marginTop: 8 }}>
                      {r.practice_areas.map((a) => (
                        <span key={a} className="chip">{PRACTICE_AREA_LABELS[a] ?? a}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        className="btn btn-ghost" style={{ flex: 1 }}
                        onClick={() => notify("ערוץ ההפניות המאובטח (Escrow) נפתח ממסך ההפניות 🔐")}
                      >
                        ערוץ מאובטח
                      </button>
                      {!r.demo && (
                        <button
                          className="btn btn-gold" style={{ flex: 1 }}
                          disabled={endorsed.has(r.id)}
                          onClick={() => endorse(r.id)}
                        >
                          {endorsed.has(r.id) ? "✓ הומלץ" : "👍 המלצה"}
                        </button>
                      )}
                    </div>
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

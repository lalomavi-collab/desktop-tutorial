import { useEffect, useState } from "react";
import {
  supabase, EXPERIENCE_LABELS, PRACTICE_AREA_LABELS,
  type Profile, type DemoAttorney, type ExperienceTier,
} from "../lib/supabase";
import { rankFor } from "../lib/reputation";
import Avatar from "./Avatar";

const MEDALS = ["🥇", "🥈", "🥉"];

interface Row {
  id: string;
  name: string | null;
  experience_tier: ExperienceTier | null;
  practice_areas: string[];
  reputation: number;
  verified: boolean;
  demo: boolean;
  me: boolean;
  avatar_url: string | null;
}

export default function Leaderboard({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: rp }, { data: dp }] = await Promise.all([
        supabase.from("ldr_profiles").select("*")
          .order("reputation", { ascending: false }).limit(100),
        supabase.from("ldr_demo_attorneys").select("*")
          .order("reputation", { ascending: false }).limit(100),
      ]);
      const real: Row[] = ((rp as Profile[]) ?? []).map((r) => ({
        id: r.id, name: r.display_name, experience_tier: r.experience_tier,
        practice_areas: r.practice_areas ?? [], reputation: r.reputation,
        verified: r.verification_status === "verified", demo: false, me: r.id === profile.id,
        avatar_url: r.avatar_url,
      }));
      const demo: Row[] = ((dp as DemoAttorney[]) ?? []).map((d) => ({
        id: d.id, name: d.display_name, experience_tier: d.experience_tier,
        practice_areas: d.practice_areas ?? [], reputation: d.reputation,
        verified: true, demo: true, me: false, avatar_url: d.avatar_url ?? null,
      }));
      setRows([...real, ...demo].sort((a, b) => b.reputation - a.reputation));
      setLoading(false);
    })();
  }, []);

  const myIndex = rows.findIndex((r) => r.me);

  return (
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 820 }}>
      <div className="section-header">
        <h2>🏆 לוח המובילים</h2>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 20 }}>
        ככל שתורמים יותר לחדר ההחלטות — צוברים מוניטין ועולים ב-Authority Tier. אלה התורמים המובילים בקהילה.
      </p>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
              <div className="skeleton" style={{ width: 30, height: 30, borderRadius: "50%" }} />
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-line short" />
                <div className="skeleton skeleton-line shorter" style={{ marginTop: 6 }} />
              </div>
              <div className="skeleton" style={{ width: 48, height: 36, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => {
            const rp = rankFor(r.reputation);
            const isTop3 = i < 3;
            return (
              <div
                key={r.id}
                className="card card-interactive"
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderColor: r.me ? "var(--gold)" : isTop3 ? "rgba(212,175,55,0.25)" : undefined,
                  background: r.me
                    ? "linear-gradient(135deg, rgba(212,175,55,0.09), rgba(27,27,27,0.98))"
                    : undefined,
                  boxShadow: isTop3 ? "0 4px 20px rgba(212,175,55,0.08)" : undefined,
                }}
              >
                <div style={{ width: 36, textAlign: "center", fontWeight: 800, fontSize: isTop3 ? 22 : 15, flexShrink: 0 }}>
                  {MEDALS[i] ?? <span className="muted" style={{ fontSize: 13 }}>{i + 1}</span>}
                </div>
                <Avatar name={r.name} size={42} verified={r.verified} url={r.avatar_url} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {r.name || "עו״ד אנונימי"}
                    {r.me && <span style={{ color: "var(--gold)", fontSize: 12 }}>(אתה)</span>}
                    {r.demo && <span className="tag" style={{ fontSize: 10, opacity: .7 }}>להמחשה</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                    <span className="rank-badge" style={{ fontSize: 10, padding: "2px 8px" }}>{rp.rank.icon} {rp.rank.title}</span>
                    {r.experience_tier && <span className="muted" style={{ fontSize: 11 }}>{EXPERIENCE_LABELS[r.experience_tier]}</span>}
                    {r.practice_areas?.[0] && <span className="muted" style={{ fontSize: 11 }}>· {PRACTICE_AREA_LABELS[r.practice_areas[0]] ?? r.practice_areas[0]}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div className="score-glow" style={{ fontSize: 20 }}>{r.reputation}</div>
                  <div className="muted" style={{ fontSize: 10 }}>מוניטין</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && myIndex >= 0 && (
        <div className="banner animate-in" style={{ marginTop: 16 }}>
          המיקום שלך: <b style={{ color: "var(--gold)" }}>#{myIndex + 1}</b> מתוך {rows.length} · המשך לתרום כדי לטפס בדירוג.
        </div>
      )}
    </div>
  );
}

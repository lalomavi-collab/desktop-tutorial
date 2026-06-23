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
        verified: true, demo: true, me: false, avatar_url: null,
      }));
      setRows([...real, ...demo].sort((a, b) => b.reputation - a.reputation));
      setLoading(false);
    })();
  }, []);

  const myIndex = rows.findIndex((r) => r.me);

  return (
    <div className="container" style={{ paddingTop: 26, maxWidth: 820 }}>
      <h2 style={{ margin: 0 }}>לוח המובילים</h2>
      <p className="muted">
        ככל שתורמים יותר לחדר ההחלטות — צוברים מוניטין ועולים ב-Authority Tier. אלה התורמים המובילים בקהילה.
      </p>

      {loading ? (
        <div className="center" style={{ padding: 50 }}><span className="spinner" /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => {
            const rp = rankFor(r.reputation);
            return (
              <div
                key={r.id}
                className="card"
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  borderColor: r.me ? "var(--gold)" : undefined,
                  background: r.me ? "var(--obsidian-3)" : undefined,
                }}
              >
                <div style={{ width: 30, textAlign: "center", fontWeight: 800, fontSize: 18 }}>
                  {MEDALS[i] ?? <span className="muted">{i + 1}</span>}
                </div>
                <Avatar name={r.name} size={40} verified={r.verified} url={r.avatar_url} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {r.name || "עו״ד אנונימי"}
                    {r.me && <span className="gold">(אתה)</span>}
                    {r.demo && <span className="tag" style={{ fontSize: 10, opacity: .8 }}>להמחשה</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} dir="ltr">
                    {rp.rank.icon} {rp.rank.title}
                    {r.experience_tier && " · " + EXPERIENCE_LABELS[r.experience_tier]}
                    {r.practice_areas?.[0] && " · " + (PRACTICE_AREA_LABELS[r.practice_areas[0]] ?? r.practice_areas[0])}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div className="gold" style={{ fontWeight: 800, fontSize: 18 }}>{r.reputation}</div>
                  <div className="muted" style={{ fontSize: 11 }}>מוניטין</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && myIndex >= 0 && (
        <div className="banner" style={{ marginTop: 16 }}>
          המיקום שלך: <b className="gold">#{myIndex + 1}</b> מתוך {rows.length} · המשך לתרום כדי לטפס בדירוג.
        </div>
      )}
    </div>
  );
}

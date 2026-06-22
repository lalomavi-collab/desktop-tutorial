import { useEffect, useState } from "react";
import {
  supabase, EXPERIENCE_LABELS, PRACTICE_AREA_LABELS, type Profile,
} from "../lib/supabase";
import { rankFor } from "../lib/reputation";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ldr_profiles")
        .select("*")
        .order("reputation", { ascending: false })
        .order("contribution_count", { ascending: false })
        .limit(100);
      setRows((data as Profile[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const myIndex = rows.findIndex((r) => r.id === profile.id);

  return (
    <div className="container" style={{ paddingTop: 26, maxWidth: 820 }}>
      <h2 style={{ margin: 0 }}>לוח המובילים</h2>
      <p className="muted">
        ככל שתורמים יותר לחדר ההחלטות — צוברים מוניטין ועולים בדרגה. אלה התורמים המובילים בקהילה.
      </p>

      {loading ? (
        <div className="center" style={{ padding: 50 }}><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="card pad center"><p className="muted">עדיין אין דירוג — היו הראשונים לתרום.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => {
            const rp = rankFor(r.reputation);
            const me = r.id === profile.id;
            return (
              <div
                key={r.id}
                className="card"
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                  borderColor: me ? "var(--gold)" : undefined,
                  background: me ? "var(--obsidian-3)" : undefined,
                }}
              >
                <div style={{ width: 34, textAlign: "center", fontWeight: 800, fontSize: 18 }}>
                  {MEDALS[i] ?? <span className="muted">{i + 1}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {r.display_name || "עו״ד אנונימי"} {me && <span className="gold">(אתה)</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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

import { useEffect, useState } from "react";
import { supabase, PRACTICE_AREA_LABELS } from "../lib/supabase";

interface Member {
  id: string; name: string; avatar_url: string | null;
  areas: string[]; reputation: number;
}

// "Who's already in the network" — a face-forward showcase on the landing,
// so visitors immediately see real-looking professionals already inside.
export default function MembersStrip() {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ldr_demo_attorneys")
        .select("id,display_name,avatar_url,practice_areas,reputation")
        .order("reputation", { ascending: false }).limit(12);
      setMembers(((data ?? []) as any[]).map((d) => ({
        id: d.id, name: d.display_name, avatar_url: d.avatar_url,
        areas: d.practice_areas ?? [], reputation: d.reputation,
      })));
    })();
  }, []);

  if (!members.length) return null;

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span className="conn-dot connected" />
        <h3 style={{ margin: 0, fontSize: 16 }}>מי כבר ברשת</h3>
        <span className="muted" style={{ fontSize: 13 }}>· עורכי דין מאומתים</span>
      </div>
      <div className="members-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
        {members.map((m) => (
          <div key={m.id} className="card pad" style={{ flexShrink: 0, width: 150, textAlign: "center", padding: "16px 12px" }}>
            {m.avatar_url ? (
              <img src={m.avatar_url} alt={m.name}
                style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px", display: "block", border: "2px solid var(--line-bright)" }} />
            ) : (
              <div aria-hidden="true" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 10px", background: "linear-gradient(145deg, var(--gold-soft), var(--gold))" }} />
            )}
            <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {PRACTICE_AREA_LABELS[m.areas?.[0]] ?? "עו״ד"}
            </div>
            <div className="score-glow" style={{ fontSize: 14, marginTop: 6 }}>{m.reputation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

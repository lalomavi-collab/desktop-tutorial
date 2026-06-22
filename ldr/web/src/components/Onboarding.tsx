import { useState } from "react";
import {
  supabase, PRACTICE_AREAS, EXPERIENCE_TIERS,
  type Profile, type ExperienceTier,
} from "../lib/supabase";

export default function Onboarding({
  profile, notify, onDone,
}: { profile: Profile; notify: (m: string) => void; onDone: (p: Profile) => void }) {
  const [areas, setAreas] = useState<string[]>(profile.practice_areas ?? []);
  const [tier, setTier] = useState<ExperienceTier | null>(profile.experience_tier ?? null);
  const [busy, setBusy] = useState(false);

  function toggle(key: string) {
    setAreas((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }

  async function save() {
    if (!tier || areas.length === 0) return;
    setBusy(true);
    const { error } = await supabase.from("ldr_profiles")
      .update({ practice_areas: areas, experience_tier: tier })
      .eq("id", profile.id);
    setBusy(false);
    if (error) { notify("שגיאה בשמירת הפרופיל: " + error.message); return; }
    notify("הפרופיל הוגדר — ברוכים הבאים ל-Grid! 🗺️");
    onDone({ ...profile, practice_areas: areas, experience_tier: tier });
  }

  return (
    <div className="container" style={{ paddingTop: 32, maxWidth: 860 }}>
      <div className="card pad">
        <span className="tag" dir="ltr">⬛ LAWINK · The Global Legal Grid</span>
        <h2 style={{ marginBottom: 4 }}>בונים את הפרופיל שלך</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          סמנו את תחומי העיסוק והוותק — כך נתאים לכם תיקים רלוונטיים ונחשב משקל
          לחיזויים שלכם בחדר ההחלטות.
        </p>

        <div className="divider" />
        <h4 style={{ margin: "0 0 8px" }}>דרגת ותק <span className="muted">(בחירה אחת)</span></h4>
        <div className="grid cols-3">
          {EXPERIENCE_TIERS.map((t) => (
            <div
              key={t.key}
              className="card pad"
              onClick={() => setTier(t.key)}
              style={{
                cursor: "pointer", textAlign: "center",
                borderColor: tier === t.key ? "var(--gold)" : undefined,
                background: tier === t.key ? "var(--obsidian-3)" : undefined,
              }}
            >
              <div className={tier === t.key ? "gold" : ""} style={{ fontWeight: 800, fontSize: 18 }}>
                {t.label}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>{t.hint}</div>
            </div>
          ))}
        </div>

        <div className="divider" />
        <h4 style={{ margin: "0 0 8px" }}>
          תחומי עיסוק <span className="muted">(בחרו אחד או יותר · {areas.length} נבחרו)</span>
        </h4>
        <div className="chip-select">
          {PRACTICE_AREAS.map((a) => (
            <span
              key={a.key}
              className={"chip " + (areas.includes(a.key) ? "on" : "")}
              onClick={() => toggle(a.key)}
            >
              {a.icon} {a.label}
            </span>
          ))}
        </div>

        <button
          className="btn btn-gold"
          style={{ width: "100%", marginTop: 22 }}
          disabled={busy || !tier || areas.length === 0}
          onClick={save}
        >
          {busy ? <span className="spinner" /> : "כניסה לחדר ההחלטות"}
        </button>
        {(!tier || areas.length === 0) && (
          <p className="muted center" style={{ fontSize: 12, marginTop: 10 }}>
            בחרו דרגת ותק ולפחות תחום אחד כדי להמשיך.
          </p>
        )}
      </div>
    </div>
  );
}

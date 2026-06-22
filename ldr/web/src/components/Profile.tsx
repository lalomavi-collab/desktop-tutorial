import { useEffect, useState } from "react";
import {
  supabase, VERIFICATION_LABELS, LICENSE_LABELS, JURISDICTION_LABELS,
  PRACTICE_AREA_LABELS, EXPERIENCE_LABELS,
  type Profile as ProfileT, type LicenseType, type VerificationStatus,
} from "../lib/supabase";
import { rankFor, badgesFor } from "../lib/reputation";
import Avatar from "./Avatar";

export default function Profile({
  profile, notify, onChange,
}: { profile: ProfileT; notify: (m: string) => void; onChange: (p: ProfileT) => void }) {
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [savingH, setSavingH] = useState(false);
  const [endorsements, setEndorsements] = useState(0);

  // verification
  const [vstatus, setVstatus] = useState<VerificationStatus>(profile.verification_status);
  const [licType, setLicType] = useState<LicenseType>(profile.license_type ?? "lawyer");
  const [licNo, setLicNo] = useState(profile.license_no ?? "");
  const [vbusy, setVbusy] = useState(false);

  const rp = rankFor(profile.reputation);
  const verified = vstatus === "verified";

  useEffect(() => {
    supabase.from("ldr_endorsements").select("*", { count: "exact", head: true })
      .eq("endorsed_id", profile.id).then(({ count }) => setEndorsements(count ?? 0));
  }, [profile.id]);

  async function saveHeadline() {
    setSavingH(true);
    const { error } = await supabase.from("ldr_profiles").update({ headline: headline.trim() || null }).eq("id", profile.id);
    setSavingH(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    onChange({ ...profile, headline: headline.trim() || null });
    notify("הכותרת עודכנה ✓");
  }

  async function submitVerification() {
    if (!licNo.trim()) { notify("הזינו מספר רישיון/תעודה"); return; }
    setVbusy(true);
    const { error } = await supabase.from("ldr_profiles")
      .update({ license_type: licType, license_no: licNo.trim(), verification_status: "pending" })
      .eq("id", profile.id);
    setVbusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    setVstatus("pending");
    onChange({ ...profile, license_type: licType, license_no: licNo.trim(), verification_status: "pending" });
    notify("הבקשה נשלחה לאימות ✓");
  }

  return (
    <div className="container" style={{ paddingTop: 26, maxWidth: 760 }}>
      {/* Header card */}
      <div className="card pad">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar name={profile.display_name} size={72} verified={verified} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 20 }}>{profile.display_name || "הפרופיל שלי"}</span>
              <span className="tag" style={{ fontSize: 11 }}>{verified ? "✓ " : ""}{VERIFICATION_LABELS[vstatus]}</span>
            </div>
            <div className="gold" style={{ fontWeight: 700 }} dir="ltr">{rp.rank.icon} {rp.rank.title}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {profile.jurisdiction && JURISDICTION_LABELS[profile.jurisdiction]}
              {profile.experience_tier && " · " + EXPERIENCE_LABELS[profile.experience_tier]}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label>כותרת מקצועית (Headline)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)}
              placeholder="למשל: שותף · נדל״ן והתחדשות עירונית · 15 שנות ניסיון" style={{ flex: 1 }} />
            <button className="btn btn-ghost" disabled={savingH || headline === (profile.headline ?? "")} onClick={saveHeadline}>
              {savingH ? <span className="spinner" /> : "שמירה"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card pad" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0 }}>מעמד מקצועי</h3>
          <span className="muted" style={{ fontSize: 13 }}>
            {rp.next ? `עוד ${rp.toNext} נק׳ ל${rp.next.title}` : "הדרגה הגבוהה ביותר 🏆"}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "var(--obsidian-3)", marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${rp.pct}%`, height: "100%", background: "var(--gold)" }} />
        </div>
        <div className="grid cols-4" style={{ marginTop: 14 }}>
          <div className="stat"><div className="n">{profile.reputation}</div><div className="l">מוניטין</div></div>
          <div className="stat"><div className="n">{endorsements}</div><div className="l">המלצות</div></div>
          <div className="stat"><div className="n">{profile.contribution_count}</div><div className="l">תיקים</div></div>
          <div className="stat"><div className="n">{profile.prediction_count}</div><div className="l">חיזויים</div></div>
        </div>
      </div>

      {/* Practice areas */}
      <div className="card pad" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>תחומי עיסוק</h3>
        <div className="chip-select">
          {(profile.practice_areas ?? []).length
            ? profile.practice_areas.map((a) => <span key={a} className="chip on">{PRACTICE_AREA_LABELS[a] ?? a}</span>)
            : <span className="muted">לא הוגדרו תחומים</span>}
        </div>
      </div>

      {/* Badges */}
      <div className="card pad" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>תגי הישג</h3>
        <div className="chip-select">
          {badgesFor(profile).map((b) => (
            <span key={b.key} className={"chip " + (b.earned ? "on" : "")} title={b.hint} style={{ opacity: b.earned ? 1 : 0.4 }}>
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Verification */}
      {!verified && (
        <div className="card pad" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>אימות מקצועי</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            רשת לעורכי דין מאומתים בלבד. אמתו שאתם עו״ד מורשה/מתמחה כדי לפתוח ערוצי הפניה.
            {vstatus === "pending" && " הבקשה שלכם בבדיקה."}
          </p>
          {vstatus !== "pending" && (
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
              <div>
                <label>סוג רישיון</label>
                <select value={licType} onChange={(e) => setLicType(e.target.value as LicenseType)}>
                  <option value="lawyer">{LICENSE_LABELS.lawyer}</option>
                  <option value="intern">{LICENSE_LABELS.intern}</option>
                </select>
              </div>
              <div>
                <label>מספר רישיון / תעודה</label>
                <input value={licNo} onChange={(e) => setLicNo(e.target.value)} dir="ltr" placeholder="12345" />
              </div>
              <button className="btn btn-gold" disabled={vbusy} onClick={submitVerification}>
                {vbusy ? <span className="spinner" /> : "שליחה לאימות"}
              </button>
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            🤖 בקרוב: העלאת סריקת תעודה + תמונה ואימות אוטומטי מבוסס-AI.
          </p>
        </div>
      )}
    </div>
  );
}

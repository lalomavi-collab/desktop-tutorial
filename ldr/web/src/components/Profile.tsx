import { useEffect, useState } from "react";
import {
  supabase, VERIFICATION_LABELS, LICENSE_LABELS, JURISDICTION_LABELS,
  PRACTICE_AREA_LABELS, EXPERIENCE_LABELS,
  type Profile as ProfileT, type LicenseType, type VerificationStatus,
} from "../lib/supabase";
import { rankFor, badgesFor } from "../lib/reputation";
import Avatar from "./Avatar";

export default function Profile({
  profile, notify, onChange, onSignOut,
}: { profile: ProfileT; notify: (m: string) => void; onChange: (p: ProfileT) => void; onSignOut?: () => void }) {
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [savingH, setSavingH] = useState(false);
  const [endorsements, setEndorsements] = useState(0);
  const [network, setNetwork] = useState<{ id: string; name: string | null }[]>([]);
  const [pending, setPending] = useState<{ id: string; requester_id: string; name: string | null }[]>([]);

  async function loadNetwork() {
    const { data } = await supabase.from("ldr_connections")
      .select("id,status,requester_id,addressee_id,req:ldr_profiles!requester_id(display_name),adr:ldr_profiles!addressee_id(display_name)");
    const conns = (data as any[]) ?? [];
    setNetwork(conns.filter((c) => c.status === "accepted").map((c) => {
      const mine = c.requester_id === profile.id;
      return { id: c.id, name: mine ? c.adr?.display_name : c.req?.display_name };
    }));
    setPending(conns.filter((c) => c.status === "pending" && c.addressee_id === profile.id)
      .map((c) => ({ id: c.id, requester_id: c.requester_id, name: c.req?.display_name })));
  }

  async function acceptConn(id: string) {
    await supabase.from("ldr_connections").update({ status: "accepted" }).eq("id", id);
    notify("התחברתם 🤝"); loadNetwork();
  }
  async function declineConn(id: string) {
    await supabase.from("ldr_connections").delete().eq("id", id);
    loadNetwork();
  }

  // verification
  const [vstatus, setVstatus] = useState<VerificationStatus>(profile.verification_status);
  const [licType, setLicType] = useState<LicenseType>(profile.license_type ?? "lawyer");
  const [licNo, setLicNo] = useState(profile.license_no ?? "");
  const [vbusy, setVbusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);

  const rp = rankFor(profile.reputation);
  const verified = vstatus === "verified";

  async function uploadAvatar(file: File) {
    setUpBusy(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${profile.id}/avatar_${Date.now()}.${ext}`;
    const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (up.error) { setUpBusy(false); notify("שגיאה בהעלאת תמונה: " + up.error.message); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("ldr_profiles").update({ avatar_url: data.publicUrl }).eq("id", profile.id);
    setUpBusy(false);
    onChange({ ...profile, avatar_url: data.publicUrl });
    notify("תמונת הפרופיל עודכנה 📸");
  }

  async function uploadCert(file: File) {
    setVbusy(true);
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${profile.id}/cert_${Date.now()}_${safe}`;
    const up = await supabase.storage.from("licenses").upload(path, file, { upsert: true });
    if (up.error) { setVbusy(false); notify("שגיאה בהעלאת תעודה: " + up.error.message); return; }
    await supabase.from("ldr_profiles").update({
      license_doc: path, license_type: licType,
      license_no: licNo.trim() || profile.license_no, verification_status: "pending",
    }).eq("id", profile.id);
    setVbusy(false);
    setVstatus("pending");
    onChange({ ...profile, license_doc: path, license_type: licType, verification_status: "pending" });
    notify("התעודה הועלתה — בבדיקת אימות 🪪");
  }

  useEffect(() => {
    supabase.from("ldr_endorsements").select("*", { count: "exact", head: true })
      .eq("endorsed_id", profile.id).then(({ count }) => setEndorsements(count ?? 0));
    loadNetwork();
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
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 760 }}>
      {/* Header card */}
      <div className="card pad" style={{ borderColor: verified ? "rgba(212,175,55,0.35)" : undefined }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <Avatar name={profile.display_name} size={72} verified={verified} url={profile.avatar_url} />
            <label className="muted" style={{ fontSize: 11, cursor: "pointer", display: "block", marginTop: 6, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--line)", transition: "border-color .2s" }}>
              {upBusy ? "מעלה…" : "📸 שינוי"}
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            </label>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 20 }}>{profile.display_name || "הפרופיל שלי"}</span>
              <span className={verified ? "tag tag-gold" : "tag"} style={{ fontSize: 11 }}>
                {verified ? "✓ מאומת" : VERIFICATION_LABELS[vstatus]}
              </span>
            </div>
            <span className="rank-badge" style={{ fontSize: 11, marginTop: 6, display: "inline-flex" }} dir="ltr">
              {rp.rank.icon} {rp.rank.title}
            </span>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
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

      {/* Profile completeness (LinkedIn-style) — drives engagement */}
      {(() => {
        const checks = [
          { done: !!profile.avatar_url, label: "תמונת פרופיל" },
          { done: !!(profile.headline && profile.headline.trim()), label: "כותרת מקצועית" },
          { done: (profile.practice_areas ?? []).length > 0, label: "תחומי עיסוק" },
          { done: !!profile.jurisdiction, label: "תחום שיפוט" },
          { done: !!profile.experience_tier, label: "דרגת ותק" },
          { done: verified, label: "אימות רישיון" },
        ];
        const doneN = checks.filter((c) => c.done).length;
        const pct = Math.round((doneN / checks.length) * 100);
        if (pct === 100) return null;
        const missing = checks.filter((c) => !c.done);
        return (
          <div className="card pad" style={{ marginTop: 16, borderColor: "rgba(51,204,255,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: 0 }}>השלמת הפרופיל</h3>
              <span className="score-glow" style={{ fontSize: 18 }}>{pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "var(--obsidian-3)", marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--gold-soft), var(--gold))", transition: "width 1s ease" }} />
            </div>
            <div className="chip-select" style={{ marginTop: 12 }}>
              {missing.map((m) => <span key={m.label} className="chip" style={{ fontSize: 12 }}>＋ {m.label}</span>)}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>פרופיל מלא מקבל יותר חיבורים, הפניות ולקוחות.</p>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="card pad" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0 }}>מעמד מקצועי</h3>
          <span className="muted" style={{ fontSize: 13 }}>
            {rp.next ? `עוד ${rp.toNext} נק׳ ל-${rp.next.title}` : "הדרגה הגבוהה ביותר 🏆"}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "var(--obsidian-3)", marginTop: 10, overflow: "hidden" }}>
          <div style={{ width: `${rp.pct}%`, height: "100%", background: "linear-gradient(90deg, var(--gold-dim), var(--gold))", transition: "width 1s ease" }} />
        </div>
        <div className="grid cols-4" style={{ marginTop: 16 }}>
          <div className="stat"><div className="n score-glow">{profile.reputation}</div><div className="l">מוניטין</div></div>
          <div className="stat"><div className="n">{endorsements}</div><div className="l">המלצות</div></div>
          <div className="stat"><div className="n">{profile.contribution_count}</div><div className="l">תיקים</div></div>
          <div className="stat"><div className="n">{profile.prediction_count}</div><div className="l">חיזויים</div></div>
        </div>
      </div>

      {/* Network */}
      <div className="card pad" style={{ marginTop: 16 }}>
        <div className="section-header" style={{ marginBottom: pending.length > 0 ? 10 : 6 }}>
          <h3 style={{ margin: 0 }}>הרשת שלי</h3>
          <span className="tag" style={{ fontSize: 12 }}>{network.length} חיבורים</span>
        </div>
        {pending.length > 0 && (
          <>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8, color: "var(--gold)" }}>
              🔔 {pending.length} בקשות חיבור ממתינות
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {pending.map((p) => (
                <div key={p.id} className="card" style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", background: "rgba(212,175,55,0.05)", borderColor: "rgba(212,175,55,0.2)" }}>
                  <Avatar name={p.name} size={36} />
                  <b style={{ flex: 1 }}>{p.name || "עו״ד"}</b>
                  <button className="btn btn-gold" style={{ padding: "5px 14px", fontSize: 13 }} onClick={() => acceptConn(p.id)}>✓ אישור</button>
                  <button className="btn btn-ghost" style={{ padding: "5px 14px", fontSize: 13 }} onClick={() => declineConn(p.id)}>✕ דחייה</button>
                </div>
              ))}
            </div>
          </>
        )}
        {network.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>עדיין אין חיבורים. התחברו לעמיתים ממסך "איתור עו״ד".</p>
        ) : (
          <div className="chip-select">
            {network.map((n) => <span key={n.id} className="chip">🤝 {n.name || "עו״ד"}</span>)}
          </div>
        )}
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
            <span key={b.key} className={"chip " + (b.earned ? "on" : "")} title={b.hint}
              style={{ opacity: b.earned ? 1 : 0.35, transition: "opacity .2s, transform .2s", transform: b.earned ? "none" : "scale(0.95)" }}>
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Verification */}
      {!verified && (
        <div className="card pad" style={{ marginTop: 16, borderColor: vstatus === "pending" ? "rgba(212,175,55,0.3)" : undefined }}>
          <h3 style={{ marginTop: 0 }}>🪪 אימות מקצועי</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            רשת לעורכי דין מאומתים בלבד. אמתו שאתם עו״ד מורשה/מתמחה כדי לפתוח ערוצי הפניה.
            {vstatus === "pending" && " הבקשה שלכם בבדיקה — תעודכנו בהמשך."}
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
          {vstatus !== "pending" && (
            <div style={{ marginTop: 12 }}>
              <label className="btn btn-ghost" style={{ cursor: "pointer", display: "inline-block" }}>
                {vbusy ? "מעלה…" : "📎 העלאת סריקת תעודה"}
                <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && uploadCert(e.target.files[0])} />
              </label>
              {profile.license_doc && <span className="muted" style={{ fontSize: 12, marginInlineStart: 8 }}>✓ תעודה הועלתה</span>}
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            🔒 התעודה נשמרת באחסון פרטי ומאובטח. אימות אוטומטי מבוסס-AI בהמשך.
          </p>
        </div>
      )}

      {onSignOut && (
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 16 }} onClick={onSignOut}>
          יציאה מהחשבון
        </button>
      )}
    </div>
  );
}

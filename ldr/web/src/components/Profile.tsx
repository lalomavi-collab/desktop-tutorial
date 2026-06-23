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
    <div className="container" style={{ paddingTop: 26, maxWidth: 760 }}>
      {/* Header card */}
      <div className="card pad">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <Avatar name={profile.display_name} size={72} verified={verified} url={profile.avatar_url} />
            <label className="muted" style={{ fontSize: 11, cursor: "pointer", display: "block", marginTop: 4 }}>
              {upBusy ? "מעלה…" : "שינוי תמונה"}
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            </label>
          </div>
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

      {/* Network */}
      <div className="card pad" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>הרשת שלי <span className="muted" style={{ fontSize: 14 }}>({network.length} חיבורים)</span></h3>
        {pending.length > 0 && (
          <>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>בקשות חיבור ({pending.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {pending.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Avatar name={p.name} size={36} />
                  <b style={{ flex: 1 }}>{p.name || "עו״ד"}</b>
                  <button className="btn btn-gold" style={{ padding: "4px 12px" }} onClick={() => acceptConn(p.id)}>אישור</button>
                  <button className="btn btn-ghost" style={{ padding: "4px 12px" }} onClick={() => declineConn(p.id)}>דחייה</button>
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
    </div>
  );
}

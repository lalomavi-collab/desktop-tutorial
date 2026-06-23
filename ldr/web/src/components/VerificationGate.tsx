import { useState } from "react";
import {
  supabase, LICENSE_LABELS, VERIFICATION_LABELS,
  type Profile, type LicenseType,
} from "../lib/supabase";

// Hard gate: a lawyer cannot enter the network until an admin verifies them.
export default function VerificationGate({
  profile, notify, onChange, onSignOut,
}: {
  profile: Profile; notify: (m: string) => void;
  onChange: (p: Profile) => void; onSignOut: () => void;
}) {
  const [licType, setLicType] = useState<LicenseType>(profile.license_type ?? "lawyer");
  const [licNo, setLicNo] = useState(profile.license_no ?? "");
  const [busy, setBusy] = useState(false);
  const pending = profile.verification_status === "pending";
  const rejected = profile.verification_status === "rejected";

  async function uploadCert(file: File) {
    setBusy(true);
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${profile.id}/cert_${Date.now()}_${safe}`;
    const up = await supabase.storage.from("licenses").upload(path, file, { upsert: true });
    if (up.error) { setBusy(false); notify("שגיאה בהעלאה: " + up.error.message); return; }
    const { error } = await supabase.from("ldr_profiles").update({
      license_type: licType, license_no: licNo.trim() || profile.license_no,
      license_doc: path, verification_status: "pending",
    }).eq("id", profile.id);
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    onChange({ ...profile, license_type: licType, license_doc: path, verification_status: "pending" });
    notify("התעודה נשלחה לאימות 🪪");
  }

  async function submitNoDoc() {
    if (!licNo.trim()) { notify("הזינו מספר רישיון/תעודה או העלו סריקה"); return; }
    setBusy(true);
    const { error } = await supabase.from("ldr_profiles").update({
      license_type: licType, license_no: licNo.trim(), verification_status: "pending",
    }).eq("id", profile.id);
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    onChange({ ...profile, license_type: licType, license_no: licNo.trim(), verification_status: "pending" });
    notify("הבקשה נשלחה לאימות ✓");
  }

  return (
    <div className="container" style={{ paddingTop: 40, maxWidth: 620 }}>
      <div className="card pad">
        <span className="tag" dir="ltr">⬛ LAWDin · Attorneys Only</span>
        <h2 style={{ marginBottom: 6 }}>אימות רישיון נדרש</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          LAWDin היא רשת סגורה <b>לעורכי דין ומתמחים מורשים בלבד</b>. כדי להיכנס, יש לאמת את הרישיון.
          הגישה נפתחת רק לאחר אישור — כך אנו מבטיחים שכל חבר/ה הם אנשי מקצוע אמיתיים.
        </p>

        <div className="banner" style={{ marginBottom: 16 }}>
          סטטוס נוכחי: <b className="gold">{VERIFICATION_LABELS[profile.verification_status]}</b>
        </div>

        {pending ? (
          <>
            <div className="center" style={{ padding: 18 }}>
              <div style={{ fontSize: 40 }}>🕓</div>
              <h3>הבקשה בבדיקה</h3>
              <p className="muted">נבדוק את הרישיון ונפתח לך גישה מלאה ברגע שיאומת. תקבל/י עדכון.</p>
            </div>
          </>
        ) : (
          <>
            {rejected && (
              <div className="banner" style={{ borderColor: "var(--burgundy-soft)", marginBottom: 14 }}>
                ⚠️ הבקשה הקודמת נדחתה. בדקו את הפרטים ונסו שוב.
              </div>
            )}
            <div className="grid cols-2">
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
            </div>

            <label className="btn btn-gold" style={{ width: "100%", marginTop: 16, cursor: "pointer", textAlign: "center" }}>
              {busy ? "מעלה…" : "📎 העלאת סריקת תעודת עו״ד/מתמחה"}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && uploadCert(e.target.files[0])} />
            </label>
            <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} disabled={busy} onClick={submitNoDoc}>
              שליחה ללא סריקה (אימות ידני לפי מספר)
            </button>
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              🔒 הסריקה נשמרת באחסון פרטי ומאובטח, נגישה לצוות האימות בלבד.
            </p>
          </>
        )}

        <div className="divider" />
        <button className="btn btn-ghost" style={{ width: "100%" }} onClick={onSignOut}>יציאה</button>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  supabase, LICENSE_LABELS, VERIFICATION_LABELS,
  type Profile, type LicenseType,
} from "../lib/supabase";

// Israeli Bar Association license number format: 5–6 digits.
// NOTE: this is only a client-side *format* sanity-check to catch typos.
// It is NOT verification — a real check is done against the official
// Israel Bar Association registry before the "verified" badge is granted.
const IL_LICENSE_RE = /^\d{5,6}$/;

function formatHint(no: string): "valid" | "invalid" | "empty" {
  if (!no.trim()) return "empty";
  return IL_LICENSE_RE.test(no.trim()) ? "valid" : "invalid";
}

// Hard gate: a lawyer cannot enter the network until verified.
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
  const hint = formatHint(licNo);

  async function uploadCert(file: File) {
    setBusy(true);
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${profile.id}/cert_${Date.now()}_${safe}`;
    const up = await supabase.storage.from("licenses").upload(path, file, { upsert: true });
    if (up.error) { setBusy(false); notify("שגיאה בהעלאה: " + up.error.message); return; }
    const { error } = await supabase.from("ldr_profiles").update({
      license_type: licType,
      license_no: licNo.trim() || profile.license_no,
      license_doc: path,
      verification_status: "pending",
    }).eq("id", profile.id);
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    onChange({ ...profile, license_type: licType, license_doc: path, verification_status: "pending" });
    notify("התעודה נשלחה לאימות מול הלשכה 🪪");
  }

  async function submitLicense() {
    if (!licNo.trim()) { notify("הזינו מספר רישיון"); return; }
    setBusy(true);

    // Submitting always sets status to "pending" — verification against the
    // official Israel Bar Association registry happens before the badge is
    // granted. We never auto-grant "verified" from a format check alone.
    const { error } = await supabase.from("ldr_profiles").update({
      license_type: licType,
      license_no: licNo.trim(),
      verification_status: "pending",
    }).eq("id", profile.id);

    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    onChange({ ...profile, license_type: licType, license_no: licNo.trim(), verification_status: "pending" });
    notify("הפרטים נשלחו לאימות מול לשכת עורכי הדין ✓");
  }

  return (
    <div className="container" style={{ paddingTop: 40, maxWidth: 620 }}>
      <div className="card pad">
        <span className="tag" dir="ltr">⬛ LAWDin · Attorneys Only</span>
        <h2 style={{ marginBottom: 6 }}>אימות רישיון נדרש</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          LAWDin היא רשת סגורה <b>לעורכי דין ומתמחים מורשים בלבד</b>.
          הפרטים שתזינו נבדקים מול <b>מאגר לשכת עורכי הדין</b> — הכניסה לרשת נפתחת רק לאחר אימות.
        </p>

        <div className="banner" style={{ marginBottom: 16 }}>
          סטטוס נוכחי: <b className="gold">{VERIFICATION_LABELS[profile.verification_status]}</b>
        </div>

        {pending ? (
          <div className="center" style={{ padding: 18 }}>
            <div style={{ fontSize: 40 }}>🕓</div>
            <h3>הבקשה בבדיקה</h3>
            <p className="muted">
              הפרטים שלך נבדקים מול מאגר לשכת עורכי הדין.
              לאחר אימות תיפתח הגישה המלאה לרשת — תקבל/י עדכון.
            </p>
          </div>
        ) : (
          <>
            {rejected && (
              <div className="banner" style={{ borderColor: "var(--burgundy-soft)", marginBottom: 14 }}>
                ⚠️ הבקשה הקודמת נדחתה. בדקו את הפרטים ונסו שוב.
              </div>
            )}

            {/* Verification explainer — honest: checked against the Bar registry */}
            <div className="banner" style={{ borderColor: "var(--gold)", marginBottom: 16, fontSize: 13 }}>
              <b>🔎 אימות מול הלשכה:</b> הזינו שם מלא ומספר רישיון כפי שמופיעים בלשכת עורכי הדין.
              הפרטים נבדקים מול המאגר הרשמי לפני מתן תג "מאומת".
            </div>

            <div className="grid cols-2">
              <div>
                <label>סוג רישיון</label>
                <select value={licType} onChange={(e) => setLicType(e.target.value as LicenseType)}>
                  <option value="lawyer">{LICENSE_LABELS.lawyer}</option>
                  <option value="intern">{LICENSE_LABELS.intern}</option>
                </select>
              </div>
              <div>
                <label>
                  מספר רישיון{" "}
                  {hint === "valid" && <span style={{ color: "var(--gold)", fontSize: 12 }}>✓ פורמט תקין</span>}
                  {hint === "invalid" && <span style={{ color: "var(--burgundy-soft)", fontSize: 12 }}>5–6 ספרות בלבד</span>}
                </label>
                <input
                  value={licNo}
                  onChange={(e) => setLicNo(e.target.value)}
                  dir="ltr"
                  placeholder="12345"
                  style={{ borderColor: hint === "valid" ? "var(--gold)" : hint === "invalid" ? "var(--burgundy-soft)" : undefined }}
                />
              </div>
            </div>

            <button
              className="btn btn-gold"
              style={{ width: "100%", marginTop: 16 }}
              disabled={busy || !licNo.trim()}
              onClick={submitLicense}
            >
              {busy ? <span className="spinner" /> : "שליחה לאימות מול הלשכה"}
            </button>

            <div className="divider" style={{ margin: "16px 0" }} />

            <label className="btn btn-ghost" style={{ width: "100%", cursor: "pointer", textAlign: "center" }}>
              {busy ? "מעלה…" : "📎 העלאת סריקת תעודת רישיון (מזרז אימות)"}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && uploadCert(e.target.files[0])} />
            </label>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
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

import { useState } from "react";
import { supabase, PRACTICE_AREAS } from "../lib/supabase";

export default function Auth({ inviteToken }: { inviteToken: string | null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const redirectTo = window.location.origin + window.location.pathname +
      (inviteToken ? `?invite=${inviteToken}` : "");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, data: { display_name: name || undefined } },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="container hero">
      {inviteToken && (
        <div className="banner" style={{ marginBottom: 24 }}>
          🎟️ הוזמנת לחדר ההחלטות. הירשם/י עם המייל שלך כדי להצטרף מיד.
        </div>
      )}
      <div className="auth-wrap">
        <div>
          <h1>
            <span dir="ltr">⬛ LAWLINK</span><br />
            <span className="gold" dir="ltr">Professional Social Network for Attorneys Only</span>
          </h1>
          <p className="lead">
            המהפכה המבצעית של עורכי הדין: שילוב עוצמתי בין חוכמת המונים מאומתת (Peer Review)
            לבינה מלאכותית (AI) לניהול סיכונים משפטיים-כלכליים בזמן אמת — תוך שמירה על
            חיסיון עו"ד–לקוח מוחלט. אנונימיזציה מלאה מתבצעת אצלכם במכשיר, לפני ששום מידע עוזב אותו.
          </p>
          <div className="pill-row">
            <span className="tag">🔐 Zero-Knowledge בצד הלקוח</span>
            <span className="tag">🤝 שיתוף ברמת המשרד</span>
            <span className="tag">📊 Risk Score חי</span>
            <span className="tag">🧑‍⚖️ עו״ד מאומתים בלבד</span>
          </div>

          <div style={{ marginTop: 28 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              כל תחומי המשפט ברשת — מכל דרגות הוותק:
            </div>
            <div className="chip-select">
              {PRACTICE_AREAS.map((a) => (
                <span key={a.key} className="chip" title={a.label}>{a.icon} {a.label}</span>
              ))}
            </div>
          </div>

          <div className="grid cols-3" style={{ marginTop: 34 }}>
            <div className="stat"><div className="n">100%</div><div className="l">חיסיון בצד הלקוח</div></div>
            <div className="stat"><div className="n">∞</div><div className="l">חינם בתקופת ההשקה</div></div>
            <div className="stat"><div className="n">{PRACTICE_AREAS.length}</div><div className="l">תחומי משפט</div></div>
          </div>
        </div>

        <div className="card pad">
          {sent ? (
            <div className="center">
              <div style={{ fontSize: 42 }}>✉️</div>
              <h3>בדקו את תיבת הדואר</h3>
              <p className="muted">שלחנו קישור כניסה מאובטח אל<br /><b>{email}</b></p>
              <p className="muted" style={{ fontSize: 13 }}>
                לחיצה על הקישור תכניס אתכם אוטומטית — ללא סיסמה.
              </p>
              <button className="btn btn-ghost" onClick={() => setSent(false)}>חזרה</button>
            </div>
          ) : (
            <form onSubmit={join}>
              <h3 style={{ marginTop: 0 }}>הצטרפות בקליק</h3>
              <p className="muted" style={{ marginTop: -8 }}>
                כניסה מאובטחת בקישור חד-פעמי (Magic Link). ללא סיסמאות.
              </p>
              <label>שם תצוגה (אופציונלי)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="עו״ד / כינוי" />
              <label>אימייל</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@law.co.il"
                dir="ltr"
              />
              {err && <p style={{ color: "var(--burgundy-soft)", fontSize: 13 }}>{err}</p>}
              <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
                {busy ? <span className="spinner" /> : "שלחו לי קישור כניסה"}
              </button>
              <p className="muted center" style={{ fontSize: 12, marginTop: 14 }}>
                בהצטרפות אתם מאשרים שכל מידע שתעלו יעבור אנונימיזציה מלאה במכשירכם.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

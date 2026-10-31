import { useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PageMeta } from "../../components/PageMeta";
import { Wordmark } from "../../components/Wordmark";
import { useAuth } from "../../context/AuthContext";
import { useCockpitAccess } from "../../lib/cockpit/shared";
import { LOOKS, lookAttrs, useCkLook } from "../../lib/cockpit/useCkLook";
import { CardArt2, ChartArt, FolderArt, InboxArt, ScalesArt, TasksArt } from "../../components/cockpit/CockpitIllustrations";
import { MfaGate } from "./MfaGate";
import "../../styles/cockpit.css";
import "../../styles/cockpit-mint.css";
import "../../styles/cockpit-type.css";
import "../../styles/cockpit-navy.css";
import "../../styles/cockpit-gate.css";

// The entry gate (owner, 31.10.2026, after Clio's "select the application" screen; learnt from it, not copied).
// The first screen after signing in: the logo large, one question, and the parts of the system as big cards that
// read like apps. The rail is still there inside every part; this screen only decides where the day starts.
// Each card points at a screen that already exists, so the gate adds no route that could drift from the rail.
type Part = { key: string; to: string; title: string; line: string; Art: (p: { size?: number }) => ReactNode };
const GATE_PARTS: Part[] = [
  { key: "matters", to: "/workspace", title: "ניהול תיקים", line: "כל התיקים, המסמכים והסיכונים במקום אחד.", Art: FolderArt },
  { key: "finance", to: "/settings/billing", title: "כספים והנהלת חשבונות", line: "חשבוניות, הוצאות, בנק ודוחות למס.", Art: CardArt2 },
  { key: "dashboard", to: "/workspace/dashboard", title: "לוח בקרה וניתוחים", line: "מגמות, הכנסות ותמונת מצב של המשרד.", Art: ChartArt },
  { key: "clients", to: "/workspace/inquiries", title: "לקוחות ופניות", line: "פניות חדשות, שיחות ומסמכי לקוחות.", Art: InboxArt },
  { key: "diary", to: "/workspace/tasks", title: "יומן ומשימות", line: "פגישות, מועדים ומה צריך לעשות היום.", Art: TasksArt },
  { key: "lex", to: "/os", title: "מנוע LEX", line: "ניתוח חוזים, נדל״ן ומודל כלכלי בבינה מלאכותית.", Art: ScalesArt },
];

const LAST_KEY = "ck-gate-last";

/** The initial for the round badge: the first letter of the name, skipping titles such as ד״ר and עו״ד. */
function initialOf(name: string | null | undefined): string {
  const word = (name ?? "").split(/\s+/).find((w) => w && !/[״"'.]/.test(w));
  return word ? word[0] : "·";
}

export function EntryGate() {
  const { user, loading, signOut } = useAuth();
  const access = useCockpitAccess();
  const nav = useNavigate();
  const [look, setLook] = useCkLook();
  // The part opened last is the one offered first; storage may be blocked, so the first card is the fallback.
  // Storage is read while the first render is set up; the prerendered shell has no storage (caught) and shows no cards before sign in, so nothing mismatches.
  const [last] = useState<string>(() => { try { const k = localStorage.getItem(LAST_KEY); if (k && GATE_PARTS.some((p) => p.key === k)) return k; } catch { /* storage blocked */ } return GATE_PARTS[0].key; });
  const remember = (k: string) => { try { localStorage.setItem(LAST_KEY, k); } catch { /* storage blocked */ } };
  async function leave() { await signOut(); nav("/", { replace: true }); }

  if (!loading && !user) return <Navigate to="/login" replace />;
  // A client has no cockpit: the portal is their home.
  if (!loading && user && access.state === "none") return <Navigate to="/portal" replace />;
  const member = access.state === "ok" ? access.member : null;
  const platformAdmin = access.state === "ok" && access.platformAdmin;
  // The external bookkeeper sees the bookkeeping system and nothing else (0073), so the gate would offer one door: open it.
  if (access.state === "ok" && !platformAdmin && member?.role === "BOOKKEEPER") return <Navigate to="/settings/billing" replace />;

  const ready = !loading && access.state === "ok";
  const name = member?.name ?? "";
  const partnerLike = platformAdmin || ["FIRM_PARTNER", "ADMIN"].includes(member?.role ?? "");

  const cards = (
    <>
      <div className="gate-head">
        <div className="gate-logo"><Wordmark height={64} /></div>
        <h1>במה נעבוד היום?</h1>
        <div className="gate-sub">בחרו את החלק במערכת שאליו תרצו להיכנס.</div>
      </div>
      <ul className="gate-grid" role="list">
        {GATE_PARTS.map(({ key, to, title, line, Art }) => (
          <li key={key}>
            <Link to={to} className={`gate-card gate-${key}${key === last ? " is-last" : ""}`} onClick={() => remember(key)} aria-describedby={`gate-line-${key}`}>
              <span className="gate-tile" aria-hidden="true"><Art size={118} /></span>
              <span className="gate-title">{title}</span>
              <span className="gate-line" id={`gate-line-${key}`}>{line}</span>
              <span className="gate-go" aria-hidden="true">{key === last ? "המשך" : "כניסה"} <span className="gate-arrow">←</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="gate-foot"><b>מאובטח:</b> שמות הלקוחות מוסתרים כברירת מחדל. <Link to="/workspace/guide">מדריך למערכת</Link></div>
    </>
  );

  return (
    <div className="ck-root ck-entry" {...lookAttrs(look)} dir="rtl" lang="he">
      <PageMeta title="במה נעבוד היום?" description="מסך הפתיחה של המערכת: בחירת החלק שאליו נכנסים." path="/workspace/start" noindex />
      <header className="gate-top">
        <Link to="/" className="gate-site">לאתר</Link>
        <div className="gate-who">
          <div className="ck-looks" role="group" aria-label="מראה המערכת">{LOOKS.map(([k, label]) => <button key={k} type="button" className={`ck-look ck-look-${k}`} aria-pressed={look === k} aria-label={`מראה ${label}`} title={label} onClick={() => setLook(k)} />)}</div>
          {name && <span className="gate-name">{name}</span>}
          {user && <button type="button" className="gate-out" onClick={() => void leave()}>יציאה</button>}
          {ready && <span className="gate-av" aria-hidden="true">{initialOf(name)}</span>}
        </div>
      </header>
      <main className="gate-main">
        {!ready ? <div className="ck-meta gate-wait">טוען...</div> : partnerLike ? <MfaGate required={platformAdmin || member?.lalum_firms.require_mfa === true}>{cards}</MfaGate> : cards}
      </main>
    </div>
  );
}

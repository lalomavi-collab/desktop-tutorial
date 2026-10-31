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
import { ClientNamesProvider } from "../../components/cockpit/ClientNames";
import { GateRecent, GateSearch } from "../../components/cockpit/GateMatters";
import { QuickAdd } from "../../components/cockpit/QuickAdd";
import { useGateMatters } from "../../lib/cockpit/gateMatters";
import { CkLangSwitch } from "../../components/cockpit/CkLangSwitch";
import { LOOK_EN, useCkLang } from "../../lib/cockpit/ckLang";
import { bootCkPrefs } from "../../lib/cockpit/ckPrefs";
import "../../styles/cockpit.css";
import "../../styles/cockpit-mint.css";
import "../../styles/cockpit-type.css";
import "../../styles/cockpit-navy.css";
import "../../styles/cockpit-gate.css";

// The entry gate (owner, 31.10.2026, after Clio's "select the application" screen; learnt from it, not copied).
// The first screen after signing in: the logo large, one question, and the parts of the system as big cards that
// read like apps. The rail is still there inside every part; this screen only decides where the day starts.
// Each card points at a screen that already exists, so the gate adds no route that could drift from the rail.
type Part = { key: string; to: string; title: string; line: string; en: [string, string]; Art: (p: { size?: number }) => ReactNode };
const GATE_PARTS: Part[] = [
  { key: "matters", to: "/workspace", title: "ניהול תיקים", line: "כל התיקים, המסמכים והסיכונים במקום אחד.", en: ["Matters", "Every matter, document and risk in one place."], Art: FolderArt },
  { key: "finance", to: "/settings/billing", title: "כספים והנהלת חשבונות", line: "חשבוניות, הוצאות, בנק ודוחות למס.", en: ["Finance and bookkeeping", "Invoices, expenses, bank and tax reports."], Art: CardArt2 },
  { key: "dashboard", to: "/workspace/dashboard", title: "לוח בקרה וניתוחים", line: "מגמות, הכנסות ותמונת מצב של המשרד.", en: ["Dashboard and analytics", "Trends, income and the state of the firm."], Art: ChartArt },
  { key: "clients", to: "/workspace/inquiries", title: "לקוחות ופניות", line: "פניות חדשות, שיחות ומסמכי לקוחות.", en: ["Clients and inquiries", "New inquiries, calls and client documents."], Art: InboxArt },
  { key: "diary", to: "/workspace/tasks", title: "יומן ומשימות", line: "פגישות, מועדים ומה צריך לעשות היום.", en: ["Calendar and tasks", "Meetings, deadlines and what needs doing today."], Art: TasksArt },
  { key: "lex", to: "/os", title: "מנוע LEX", line: "ניתוח חוזים, נדל״ן ומודל כלכלי בבינה מלאכותית.", en: ["LEX engine", "Contract, real estate and economic analysis with AI."], Art: ScalesArt },
];

const LAST_KEY = "ck-gate-last";

// The personal display preferences apply as soon as the gate's code loads, before it paints.
bootCkPrefs();

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
  const { lang, dir, tx } = useCkLang();
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

  const cards = <GateBody last={last} remember={remember} />;

  return (
    <div className="ck-root ck-entry" {...lookAttrs(look)} dir={dir} lang={lang}>
      <PageMeta title={tx("במה נעבוד היום?", "What are we working on today?")} description={tx("מסך הפתיחה של המערכת: בחירת החלק שאליו נכנסים.", "The system's start screen: choose the part to open.")} path="/workspace/start" noindex />
      <header className="gate-top">
        <Link to="/" className="gate-site">{tx("לאתר", "To the site")}</Link>
        <div className="gate-who">
          <CkLangSwitch />
          <div className="ck-looks" role="group" aria-label={tx("מראה המערכת", "System look")}>{LOOKS.map(([k, label]) => { const l = lang === "en" ? LOOK_EN[k] : label; return <button key={k} type="button" className={`ck-look ck-look-${k}`} aria-pressed={look === k} aria-label={lang === "en" ? `${l} look` : `מראה ${l}`} title={l} onClick={() => setLook(k)} />; })}</div>
          {name && <span className="gate-name">{name}</span>}
          {user && <button type="button" className="gate-out" onClick={() => void leave()}>{tx("יציאה", "Sign out")}</button>}
          {ready && <span className="gate-av" aria-hidden="true">{initialOf(name)}</span>}
        </div>
      </header>
      <ClientNamesProvider>
      <main className="gate-main">
        {!ready ? <div className="ck-meta gate-wait">{tx("טוען...", "Loading...")}</div> : partnerLike ? <MfaGate required={platformAdmin || member?.lalum_firms.require_mfa === true}>{cards}</MfaGate> : cards}
      </main>
      {ready && <QuickAdd />}
      </ClientNamesProvider>
    </div>
  );
}

/** What the gate shows once the member is through the second factor; the matters load only from here, as on every cockpit screen. */
function GateBody({ last, remember }: { last: string; remember: (k: string) => void }) {
  const matters = useGateMatters(true);
  const { lang, tx } = useCkLang();
  const en = lang === "en";
  return (
    <>
      <div className="gate-head">
        <div className="gate-logo"><Wordmark height={64} /></div>
        <h1>{tx("במה נעבוד היום?", "What are we working on today?")}</h1>
        <div className="gate-sub">{tx("בחרו את החלק במערכת שאליו תרצו להיכנס.", "Choose the part of the system you want to open.")}</div>
        <GateSearch matters={matters} />
      </div>
      <ul className="gate-grid" role="list">
        {GATE_PARTS.map(({ key, to, title, line, en: enText, Art }) => (
          <li key={key}>
            <Link to={to} className={`gate-card gate-${key}${key === last ? " is-last" : ""}`} onClick={() => remember(key)} aria-describedby={`gate-line-${key}`}>
              <span className="gate-tile" aria-hidden="true"><Art size={118} /></span>
              <span className="gate-title">{en ? enText[0] : title}</span>
              <span className="gate-line" id={`gate-line-${key}`}>{en ? enText[1] : line}</span>
              <span className="gate-go" aria-hidden="true">{key === last ? tx("המשך", "Continue") : tx("כניסה", "Open")} <span className="gate-arrow">{en ? "→" : "←"}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <GateRecent matters={matters} />
      <div className="gate-foot"><b>{tx("מאובטח:", "Secure:")}</b> {tx("שמות הלקוחות מוסתרים כברירת מחדל.", "client names are hidden by default.")} <Link to="/workspace/guide">{tx("מדריך למערכת", "System guide")}</Link> · <Link to="/settings/preferences">{tx("העדפות תצוגה", "Display preferences")}</Link></div>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Profile } from "./lib/supabase";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import NewCase from "./components/NewCase";
import Invite from "./components/Invite";
import Onboarding from "./components/Onboarding";
import Leaderboard from "./components/Leaderboard";
import Directory from "./components/Directory";
import Gigs from "./components/Gigs";
import CaseBoard from "./components/CaseBoard";
import RoomShare from "./components/RoomShare";
import Jobs from "./components/Jobs";
import Referrals from "./components/Referrals";
import Feed from "./components/Feed";
import ProfilePage from "./components/Profile";
import QA from "./components/QA";
import AnalyzerLab from "./components/AnalyzerLab";
import { rankFor } from "./lib/reputation";
import VerificationGate from "./components/VerificationGate";
import AdminVerify from "./components/AdminVerify";
import ResetPassword from "./components/ResetPassword";
import PublicMap from "./components/PublicMap";
import { Wordmark } from "./components/Logo";
import BottomNav from "./components/BottomNav";
import LanguageSwitcher from "./components/LanguageSwitcher";
import NotificationsBell from "./components/NotificationsBell";

type Tab = "feed" | "room" | "new" | "find" | "map" | "gigs" | "cases" | "rooms" | "jobs" | "referrals" | "qa" | "lab" | "board" | "profile" | "invite" | "admin";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("map");
  const [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const inviteToken = new URLSearchParams(window.location.search).get("invite");

  function notify(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile + accept invite once authenticated.
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    (async () => {
      const { data } = await supabase.from("ldr_profiles").select("*").eq("id", session.user.id).maybeSingle();
      setProfile(data as Profile);
      if (inviteToken) await acceptInvite(inviteToken, session.user.id, data as Profile | null);
    })();
  }, [session]);

  async function acceptInvite(token: string, userId: string, prof: Profile | null) {
    const { data: inv } = await supabase.from("ldr_invites").select("*").eq("token", token).maybeSingle();
    if (!inv) return;
    if (inv.firm_id && prof && !prof.firm_id) {
      await supabase.from("ldr_firm_members").insert({ firm_id: inv.firm_id, user_id: userId }).then(() => {});
      await supabase.from("ldr_profiles").update({ firm_id: inv.firm_id }).eq("id", userId);
    }
    await supabase.from("ldr_invites").update({ accepted_by: userId }).eq("token", token);
    window.history.replaceState({}, "", window.location.pathname);
    notify("ההזמנה התקבלה — ברוכים הבאים לחדר ההחלטות!");
  }

  if (!ready) {
    return <div className="center" style={{ paddingTop: 120 }}><span className="spinner" /></div>;
  }

  // Password reset flow: Supabase sends users back with type=recovery
  const urlParams = new URLSearchParams(window.location.hash.replace("#", "?"));
  if (urlParams.get("type") === "recovery" && session) {
    return (
      <div className="app">
        <Header session={null} profile={null} tab={tab} setTab={setTab} onSignOut={() => {}} />
        <ResetPassword />
        <Footer />
      </div>
    );
  }

  if (!session) {
    // Landing has its own nav/logo — no app Header here (avoids a double logo).
    return (
      <div className="app">
        <Auth inviteToken={inviteToken} />
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        session={session} profile={profile} tab={tab} setTab={setTab}
        onSignOut={async () => { await supabase.auth.signOut(); }}
      />
      <main style={{ flex: 1, paddingBottom: 40 }}>
        {!profile ? (
          <div className="center" style={{ paddingTop: 80 }}><span className="spinner" /></div>
        ) : (profile as any).role !== "client" && !profile.experience_tier ? (
          <Onboarding profile={profile} notify={notify} onDone={(p) => { setProfile(p); setTab("map"); }} />
        ) : (profile as any).role !== "client" && profile.verification_status !== "verified" && !profile.is_admin ? (
          <VerificationGate
            profile={profile} notify={notify}
            onChange={setProfile}
            onSignOut={async () => { await supabase.auth.signOut(); }}
          />
        ) : tab === "admin" && profile.is_admin ? (
          <AdminVerify profile={profile} notify={notify} />
        ) : tab === "feed" ? (
          <Feed profile={profile} notify={notify} />
        ) : tab === "profile" ? (
          <ProfilePage profile={profile} notify={notify} onChange={setProfile}
            onSignOut={async () => { await supabase.auth.signOut(); }} />
        ) : tab === "room" ? (
          <Dashboard profile={profile} notify={notify} onNew={() => setTab("new")} />
        ) : tab === "new" ? (
          <NewCase profile={profile} notify={notify} onDone={() => setTab("room")} />
        ) : tab === "map" ? (
          <PublicMap />
        ) : tab === "find" ? (
          <Directory profile={profile} notify={notify} />
        ) : tab === "gigs" ? (
          <Gigs profile={profile} notify={notify} />
        ) : tab === "cases" ? (
          <CaseBoard profile={profile} notify={notify} />
        ) : tab === "rooms" ? (
          <RoomShare profile={profile} notify={notify} />
        ) : tab === "jobs" ? (
          <Jobs profile={profile} notify={notify} />
        ) : tab === "referrals" ? (
          <Referrals profile={profile} notify={notify} />
        ) : tab === "qa" ? (
          <QA profile={profile} notify={notify} />
        ) : tab === "lab" ? (
          <AnalyzerLab profile={profile} notify={notify} />
        ) : tab === "board" ? (
          <Leaderboard profile={profile} />
        ) : (
          <Invite profile={profile} notify={notify} />
        )}
      </main>
      <Footer />
      {/* Professional mobile bottom nav — verified attorneys, admins, and clients */}
      {profile && ((profile as any).role === "client" || (profile.experience_tier && (profile.verification_status === "verified" || profile.is_admin))) && (
        <BottomNav tab={tab} setTab={setTab} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// Primary tabs always visible in the desktop top bar; the rest live under "עוד".
const PRIMARY_TABS: { tab: Tab; label: string }[] = [
  { tab: "map", label: "🗺 מפה" },
  { tab: "feed", label: "בית" },
  { tab: "find", label: "איתור עו״ד" },
  { tab: "qa", label: "שו״ת" },
  { tab: "lab", label: "🔬 מעבדת AI" },
];
const MORE_TABS: { tab: Tab; label: string }[] = [
  { tab: "room", label: "חדר ההחלטות" },
  { tab: "gigs", label: "Legal Gigs" },
  { tab: "cases", label: "📩 תיקים מלקוחות" },
  { tab: "rooms", label: "🤝 שיתוף חדרים" },
  { tab: "jobs", label: "💼 דרושים" },
  { tab: "referrals", label: "הפניות" },
  { tab: "board", label: "מובילים" },
  { tab: "invite", label: "הזמנות" },
];

function Header({
  session, profile, tab, setTab, onSignOut,
}: { session: Session | null; profile: Profile | null; tab: Tab; setTab: (t: Tab) => void; onSignOut: () => void }) {
  const rank = profile ? rankFor(profile.reputation) : null;
  return (
    <header className="topbar">
      <div className="container inner">
        <div className="brand" onClick={() => session && setTab("feed")}>
          <Wordmark size={40} />
        </div>
        {session && (
          <nav className="nav">
            {rank && (
              <span className="tag" title={`מוניטין: ${profile!.reputation}`} style={{ marginInlineEnd: 4 }}>
                {rank.rank.icon} {rank.rank.title} · {profile!.reputation}
              </span>
            )}
            {PRIMARY_TABS.map((it) => (
              <button key={it.tab} className={tab === it.tab ? "active" : ""} onClick={() => setTab(it.tab)}>{it.label}</button>
            ))}
            <MoreMenu tab={tab} setTab={setTab} />
            <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>פרופיל</button>
            {profile?.is_admin && (
              <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")} style={{ color: "var(--gold)" }}>⚙ אדמין</button>
            )}
            <LanguageSwitcher light />
            <NotificationsBell tone="light" />
            <button onClick={onSignOut}>יציאה</button>
          </nav>
        )}
      </div>
    </header>
  );
}

// "עוד" overflow dropdown holding the secondary tabs (keeps the bar Waze-clean).
function MoreMenu({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeHere = MORE_TABS.some((it) => it.tab === tab);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={activeHere ? "active" : ""} onClick={() => setOpen((o) => !o)}>עוד ▾</button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", insetInlineEnd: 0, zIndex: 1000, minWidth: 190,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
          boxShadow: "0 16px 40px rgba(31,30,29,0.14)", overflow: "hidden", padding: 6,
        }}>
          {MORE_TABS.map((it) => (
            <button key={it.tab}
              onClick={() => { setTab(it.tab); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "start", padding: "9px 12px",
                border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5,
                background: tab === it.tab ? "rgba(217,119,87,0.12)" : "transparent",
                color: tab === it.tab ? "var(--gold-soft)" : "var(--cream)",
              }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      🔐 חיסיון עו"ד–לקוח נשמר באמצעות אנונימיזציה מלאה בצד הלקוח · LAWDin
    </footer>
  );
}

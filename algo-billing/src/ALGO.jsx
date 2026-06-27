import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Scale, Sparkles, Plus, Pencil, Trash2, Check, X, Zap, Users, Clock,
  Wallet, Mail, Printer, ChevronLeft, ChevronRight, Building2, ScrollText,
  BadgeCheck, CornerDownLeft, CircleDot, ReceiptText, RotateCcw,
  Download, Upload, FileDown, LogIn, LogOut, RefreshCw,
} from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { pullAll, upsertClient, upsertLog, deleteClient, deleteLog } from "./lib/sync.js";
import { msalEnabled, outlookSignIn, outlookSignOut, getOutlookAccount, sendInvoiceEmail } from "./lib/outlook.js";

/* ============================== THEME ============================== */
const C = {
  black: "#0B0B0C",
  charcoal: "#161618",
  surface: "#1C1C1F",
  raised: "#232327",
  gold: "#D4AF37",
  goldSoft: "rgba(212,175,55,0.12)",
  goldDim: "#9C7C2A",
  white: "#F4F4F2",
  muted: "#8C8C92",
  faint: "#5E5E64",
  line: "#2A2A2E",
  green: "#46B98C",
  greenSoft: "rgba(70,185,140,0.13)",
  red: "#E0654E",
  redSoft: "rgba(224,101,78,0.12)",
};
const SANS = 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace';
const VAT = 0.18; // Israeli VAT, 18% (from Jan 2025)

/* ============================ FORMATTERS =========================== */
const ils0 = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
const ils2 = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 });
const money0 = (n) => ils0.format(n || 0);
const money2 = (n) => ils2.format(n || 0);
const hasHeb = (s) => /[\u0590-\u05FF]/.test(s || "");

/* ============================ NLP ENGINE =========================== */
const normalize = (s) =>
  (s || "").replace(/[״”“"'`.,;:!?()\[\]/\\]/g, " ").replace(/\s+/g, " ").trim();

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// Extract billable hours from Hebrew or English free text.
function extractHours(text) {
  const specials = [
    [/שעה\s+וחצי/, 1.5], [/שעתיים\s+וחצי/, 2.5], [/שעתיים/, 2],
    [/חצי\s*שעה/, 0.5], [/רבע\s*שעה/, 0.25], [/שלושת\s*רבעי\s*שעה/, 0.75],
  ];
  for (const [re, val] of specials) {
    const m = text.match(re);
    if (m) return { value: val, raw: m[0] };
  }
  const digit = text.match(/(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|שעות|שעה|ש['׳])/i);
  if (digit) return { value: parseFloat(digit[1].replace(",", ".")), raw: digit[0] };
  if (/(^|\s)שעה(\s|$)/.test(text)) {
    const m = text.match(/(^|\s)(שעה)(\s|$)/);
    return { value: 1, raw: m[2] };
  }
  return { value: 0, raw: "" };
}

// Fuzzy-match the typed text against the client roster.
function matchClient(text, clients) {
  const norm = normalize(text);
  const words = norm.split(" ").filter(Boolean);
  let best = null, bestScore = 0, bestTokens = [];
  for (const c of clients) {
    const cname = normalize(c.name);
    const tokens = cname.split(" ").filter((t) => t.length > 1);
    let score = 0;
    if (cname && norm.includes(cname)) score += 1.1;
    for (const tok of tokens) {
      if (norm.includes(tok)) { score += 0.65; continue; }
      let bestSim = 0;
      for (const w of words) {
        if (w.length < 2) continue;
        const sim = 1 - levenshtein(w, tok) / Math.max(w.length, tok.length);
        if (sim > bestSim) bestSim = sim;
      }
      if (bestSim >= 0.78) score += 0.45 * bestSim;
    }
    if (score > bestScore) { bestScore = score; best = c; bestTokens = tokens; }
  }
  return bestScore >= 0.55 ? { client: best, tokens: bestTokens } : { client: null, tokens: [] };
}

const STOP = new Set([
  "on","for","the","a","an","re","regarding","client","work","of","to","with","hours","hour","hrs","hr",
  "תיק","עבור","בנושא","של","לקוח","עבודה","עבודת","בעבור","אצל","ל","שעות","שעה",
]);

function buildDescription(text, hoursRaw, clientTokens) {
  let d = " " + text + " ";
  if (hoursRaw) d = d.split(hoursRaw).join(" ");
  for (const t of clientTokens) d = d.replace(new RegExp(t, "g"), " ");
  d = normalize(d).split(" ").filter((w) => w && !STOP.has(w.toLowerCase())).join(" ");
  return d.trim();
}

function parseEntry(text, clients) {
  const { value: hours, raw } = extractHours(text);
  const { client, tokens } = matchClient(text, clients);
  const description = buildDescription(text, raw, tokens);
  const rate = client ? client.rate : 0;
  return { hours, client, description, rate, total: +(hours * rate).toFixed(2) };
}

/* ========================= ACTIVITY TYPES ========================= */
const ACTIVITY_TYPES = [
  { value: "consulting", label: "ייעוץ", labelEn: "Consulting" },
  { value: "lecture",    label: "הרצאה", labelEn: "Lecture" },
  { value: "other",      label: "אחר",   labelEn: "Other" },
];
const DEFAULT_CONSULTING_RATE = 1000; // ₪/hour base rate

// Detect lecture keywords in text to auto-set activity type.
function detectActivity(text) {
  if (/הרצ(אה|ות)|lecture|כנס|seminar|workshop|סמינ|סדנה/i.test(text)) return "lecture";
  return "consulting";
}

/* =========================== SEED DATA ============================ */
const SEED_CLIENTS = [
  { id: "c1", name: 'לוי נדל"ן', rate: 1200, email: "office@levi-realestate.co.il", autoBill: true },
  { id: "c2", name: "משפחת כהן", rate: 950, email: "cohen.family@gmail.com", autoBill: true },
  { id: "c3", name: 'אמינוב בע"מ', rate: 1500, email: "billing@aminov.co.il", autoBill: false },
  { id: "c4", name: "Meridian Capital", rate: 1800, email: "ap@meridiancap.com", autoBill: true },
];
const today = () => new Date().toISOString().slice(0, 10);
const SEED_LOGS = [
  { id: "l1", date: today(), clientId: "c1", client: 'לוי נדל"ן', hours: 4, description: "ניסוח טיוטת הסכם קומבינציה", rate: 1200, total: 4800, status: "Pending", activity: "consulting" },
  { id: "l2", date: today(), clientId: "c2", client: "משפחת כהן", hours: 1.5, description: "התחדשות עירונית תמא 38/1", rate: 950, total: 1425, status: "Pending", activity: "consulting" },
];

/* ====================== PERSISTENCE (localStorage) ====================== */
const LS_CLIENTS = "algo.clients.v1";
const LS_LOGS = "algo.logs.v1";

// All access is guarded: if storage is unavailable (sandboxed / private mode)
// the app silently continues in memory instead of throwing.
function loadState(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
function saveState(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* no-op */ }
}
function clearStorage() {
  try {
    window.localStorage.removeItem(LS_CLIENTS);
    window.localStorage.removeItem(LS_LOGS);
  } catch { /* no-op */ }
}

/* ============================ PRIMITIVES ========================== */
const card = { background: C.charcoal, border: `1px solid ${C.line}`, borderRadius: 16 };
const inputBase = {
  background: C.black, border: `1px solid ${C.line}`, color: C.white,
  borderRadius: 10, padding: "9px 12px", fontFamily: SANS, fontSize: 14, outline: "none", width: "100%",
};

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      style={{
        width: 42, height: 24, borderRadius: 999, position: "relative", cursor: "pointer",
        background: on ? C.gold : C.raised, border: `1px solid ${on ? C.goldDim : C.line}`, transition: "all .18s",
      }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 999,
        background: on ? C.black : C.muted, transition: "all .18s",
      }} />
    </button>
  );
}

function StatusBadge({ status }) {
  const inv = status === "Invoiced";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
      padding: "3px 10px", borderRadius: 999,
      color: inv ? C.green : C.gold,
      background: inv ? C.greenSoft : C.goldSoft,
      border: `1px solid ${inv ? "rgba(70,185,140,0.35)" : "rgba(212,175,55,0.35)"}`,
    }}>
      {inv ? <BadgeCheck size={13} /> : <CircleDot size={13} />}{status}
    </span>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div style={{ ...card, padding: "16px 18px", flex: 1, minWidth: 168 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase" }}>
        <Icon size={14} color={C.gold} />{label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 600, color: C.white, marginTop: 8 }}>{value}</div>
      {sub && <div style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ============================== APP =============================== */
export default function ALGO() {
  const [clients, setClients] = useState(() => loadState(LS_CLIENTS, SEED_CLIENTS));
  const [logs, setLogs] = useState(() => loadState(LS_LOGS, SEED_LOGS));
  const [text, setText] = useState("");
  const [toast, setToast] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [invoices, setInvoices] = useState(null); // array or null
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);
  const [armed, setArmed] = useState(false);
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activity, setActivity] = useState("consulting");
  const [manualRate, setManualRate] = useState("");
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const syncCTimer = useRef(null);
  const syncLTimer = useRef(null);
  const authRef = useRef(null);

  // Persist on every change. Guarded internally, so a blocked store is harmless.
  useEffect(() => { saveState(LS_CLIENTS, clients); }, [clients]);
  useEffect(() => { saveState(LS_LOGS, logs); }, [logs]);

  // Supabase auth: subscribe to session changes and pull remote data on sign-in.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) hydrateFromRemote();
    });
    return () => subscription.unsubscribe();
  }, []);

  async function hydrateFromRemote() {
    setSyncing(true);
    const remote = await pullAll();
    setSyncing(false);
    if (!remote) return;
    if (remote.clients.length) { setClients(remote.clients); saveState(LS_CLIENTS, remote.clients); }
    if (remote.logs.length)    { setLogs(remote.logs);       saveState(LS_LOGS, remote.logs); }
  }

  // Debounced upsert to Supabase whenever state changes (only when signed in).
  useEffect(() => {
    if (!session) return;
    clearTimeout(syncCTimer.current);
    syncCTimer.current = setTimeout(() => clients.forEach(upsertClient), 1500);
  }, [clients, session]);

  useEffect(() => {
    if (!session) return;
    clearTimeout(syncLTimer.current);
    syncLTimer.current = setTimeout(() => logs.forEach(upsertLog), 1500);
  }, [logs, session]);

  async function sendMagicLink() {
    if (!supabase || !authEmail.trim()) return;
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail.trim(), options: { emailRedirectTo: window.location.href } });
    if (error) flash("שגיאה בשליחה: " + error.message, "err");
    else { flash("קישור נשלח לאימייל - בדוק את תיבת הדואר"); setAuthOpen(false); setAuthEmail(""); }
  }

  // Close auth popover on outside click.
  useEffect(() => {
    if (!authOpen) return;
    const h = (e) => { if (authRef.current && !authRef.current.contains(e.target)) setAuthOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [authOpen]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    flash("התנתקת מהחשבון");
  }

  function resetData() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
    setArmed(false);
    clearStorage();
    setClients(SEED_CLIENTS);
    setLogs(SEED_LOGS);
    setInvoices(null);
    setText("");
    flash("הנתונים אופסו לברירת המחדל");
  }

  // Export full state as a downloadable JSON backup.
  function exportBackup() {
    try {
      const payload = { app: "ALGO", version: 1, exportedAt: new Date().toISOString(), clients, logs };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `algo-backup-${today()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash("גיבוי JSON הורד");
    } catch { flash("הגיבוי נכשל", "err"); }
  }

  // Restore state from a JSON backup file.
  function importBackup(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.clients) || !Array.isArray(data.logs)) throw new Error("bad shape");
        setClients(data.clients); setLogs(data.logs); setInvoices(null);
        flash(`שוחזרו ${data.clients.length} לקוחות ו-${data.logs.length} רשומות`);
      } catch { flash("קובץ גיבוי לא תקין", "err"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const flash = (msg, kind = "ok") => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2600); };

  const parsedBase = useMemo(() => (text.trim() ? parseEntry(text, clients) : null), [text, clients]);

  // Auto-detect activity type from text when user hasn't manually changed it.
  useEffect(() => {
    if (text.trim()) setActivity(detectActivity(text));
  }, [text]);

  const effectiveRate = useMemo(() => {
    if (activity === "lecture") return Number(manualRate) || 0;
    return parsedBase ? parsedBase.rate : 0;
  }, [activity, manualRate, parsedBase]);

  const parsed = useMemo(() => {
    if (!parsedBase) return null;
    const rate = effectiveRate;
    return { ...parsedBase, rate, total: +(parsedBase.hours * rate).toFixed(2) };
  }, [parsedBase, effectiveRate]);

  const kpis = useMemo(() => {
    const pend = logs.filter((l) => l.status === "Pending");
    const inv = logs.filter((l) => l.status === "Invoiced");
    return {
      pendingVal: pend.reduce((s, l) => s + l.total, 0),
      pendingCount: pend.length,
      billedVal: inv.reduce((s, l) => s + l.total, 0),
      hours: logs.reduce((s, l) => s + l.hours, 0),
      clients: clients.length,
    };
  }, [logs, clients]);

  /* -------- log capture -------- */
  function logEntry() {
    if (!parsed || !parsed.hours) return flash("Add a duration (e.g. 2.5 hours / שעתיים)", "err");
    if (activity === "lecture" && !Number(manualRate)) return flash("להרצאה יש להזין תעריף", "err");
    const entry = {
      id: crypto.randomUUID(), date: today(),
      clientId: parsed.client ? parsed.client.id : null,
      client: parsed.client ? parsed.client.name : "לא זוהה / Unmatched",
      hours: parsed.hours, description: parsed.description || "—",
      rate: parsed.rate, total: parsed.total, status: "Pending",
      activity,
    };
    setLogs((p) => [entry, ...p]);
    setText("");
    setManualRate("");
    setActivity("consulting");
    flash(parsed.client ? `Logged ${parsed.hours}h to ${parsed.client.name}` : "Logged - client unmatched", parsed.client ? "ok" : "err");
    taRef.current && taRef.current.focus();
  }
  const onKey = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); logEntry(); } };
  const delLog = (id) => { setLogs((p) => p.filter((l) => l.id !== id)); if (session) deleteLog(id); };

  /* -------- clients -------- */
  const blank = () => ({ id: crypto.randomUUID(), name: "", rate: 0, email: "", autoBill: true });
  function startAdd() { setDraft(blank()); setEditingId("new"); }
  function startEdit(c) { setDraft({ ...c }); setEditingId(c.id); }
  function saveClient() {
    if (!draft.name.trim()) return flash("Client name is required", "err");
    const rate = Number(draft.rate) || 0;
    if (editingId === "new") setClients((p) => [...p, { ...draft, rate }]);
    else {
      setClients((p) => p.map((c) => (c.id === editingId ? { ...draft, rate } : c)));
      setLogs((p) => p.map((l) => (l.clientId === editingId ? { ...l, client: draft.name, rate, total: +(l.hours * rate).toFixed(2) } : l)));
    }
    setEditingId(null); setDraft(null); flash("Client saved");
  }
  function delClient(id) { setClients((p) => p.filter((c) => c.id !== id)); if (session) deleteClient(id); }
  const toggleAuto = (id) => setClients((p) => p.map((c) => (c.id === id ? { ...c, autoBill: !c.autoBill } : c)));

  /* -------- billing run -------- */
  function runBilling() {
    const autoIds = new Set(clients.filter((c) => c.autoBill).map((c) => c.id));
    const eligible = logs.filter((l) => l.status === "Pending" && l.clientId && autoIds.has(l.clientId));
    if (!eligible.length) {
      const heldManual = logs.some((l) => l.status === "Pending" && l.clientId && !autoIds.has(l.clientId));
      return flash(heldManual ? "Pending entries belong to Auto-Bill OFF clients" : "No pending entries to bill", "err");
    }
    setRunning(true);
    setTimeout(() => {
      const ym = new Date().toISOString().slice(0, 7).replace("-", "");
      const byClient = {};
      for (const l of eligible) (byClient[l.clientId] = byClient[l.clientId] || []).push(l);
      const result = Object.keys(byClient).map((cid, i) => {
        const c = clients.find((x) => x.id === cid);
        const lines = byClient[cid];
        const sub = lines.reduce((s, l) => s + l.total, 0);
        return {
          client: c, lines, subtotal: sub, vat: +(sub * VAT).toFixed(2), total: +(sub * (1 + VAT)).toFixed(2),
          number: `INV-${ym}-${String(i + 1).padStart(3, "0")}`, date: today(),
        };
      });
      const billedIds = new Set(eligible.map((l) => l.id));
      setLogs((p) => p.map((l) => (billedIds.has(l.id) ? { ...l, status: "Invoiced" } : l)));
      setInvoices(result); setActive(0); setRunning(false);
      flash(`${result.length} invoice${result.length > 1 ? "s" : ""} generated`);
    }, 850);
  }

  /* ============================ RENDER ============================ */
  return (
    <div style={{ background: C.black, minHeight: "100vh", color: C.white, fontFamily: SANS, padding: "26px 22px 60px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* HEADER */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center", background: C.goldSoft, border: `1px solid rgba(212,175,55,0.4)` }}>
              <Scale size={24} color={C.gold} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: ".22em", color: C.white }}>ALGO</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.gold, border: `1px solid ${C.goldDim}`, borderRadius: 6, padding: "1px 7px", letterSpacing: ".1em" }}>BILLING</span>
              </div>
              <div style={{ color: C.muted, fontSize: 12.5, marginTop: 1 }}>Automated legal time capture &amp; invoicing</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.white }}>{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
              <div style={{ color: C.faint, fontSize: 12 }}>VAT applied at {Math.round(VAT * 100)}%</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={exportBackup} title="ייצוא גיבוי JSON" style={chip(false)}>
                <Download size={14} /> גיבוי
              </button>
              <button onClick={() => fileRef.current && fileRef.current.click()} title="שחזור מקובץ גיבוי" style={chip(false)}>
                <Upload size={14} /> שחזור
              </button>
              <button onClick={resetData} title="מחיקת כל הנתונים השמורים"
                style={{ ...chip(armed), color: armed ? C.red : C.muted, background: armed ? C.redSoft : C.raised, borderColor: armed ? "rgba(224,101,78,0.5)" : C.line }}>
                <RotateCcw size={14} /> {armed ? "לחץ שוב לאישור" : "איפוס נתונים"}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="application/json" onChange={importBackup} style={{ display: "none" }} />
            {/* Supabase auth - only rendered when env vars are present */}
            {supabase && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                {session ? (
                  <>
                    {syncing && <RefreshCw size={13} color={C.gold} style={{ animation: "spin 1s linear infinite" }} />}
                    <span style={{ fontSize: 12, color: C.muted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.email}</span>
                    <button onClick={signOut} title="התנתק" style={{ ...chip(), color: C.muted }}>
                      <LogOut size={13} /> יציאה
                    </button>
                  </>
                ) : (
                  <div ref={authRef} style={{ position: "relative" }}>
                    <button onClick={() => setAuthOpen((v) => !v)} style={{ ...chip(), color: C.gold, borderColor: C.goldDim }}>
                      <LogIn size={13} /> כניסה לחשבון
                    </button>
                    {authOpen && (
                      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, width: 260, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>כניסה עם Magic Link - הזן אימייל:</div>
                        <input
                          type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                          placeholder="email@example.com" autoFocus
                          style={{ ...inputBase, marginBottom: 8, direction: "ltr" }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={sendMagicLink} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: C.gold, color: C.black, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>שלח קישור</button>
                          <button onClick={() => { setAuthOpen(false); setAuthEmail(""); }} style={{ padding: "8px 12px", borderRadius: 8, background: C.raised, color: C.muted, border: `1px solid ${C.line}`, cursor: "pointer", fontSize: 13 }}>ביטול</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          <Stat icon={Wallet} label="Pending value" value={money0(kpis.pendingVal)} sub={`${kpis.pendingCount} entr${kpis.pendingCount === 1 ? "y" : "ies"} awaiting`} />
          <Stat icon={ReceiptText} label="Invoiced" value={money0(kpis.billedVal)} sub="this period" />
          <Stat icon={Clock} label="Logged hours" value={kpis.hours.toFixed(2).replace(/\.00$/, "")} sub="across all clients" />
          <Stat icon={Users} label="Clients" value={kpis.clients} sub={`${clients.filter((c) => c.autoBill).length} on auto-bill`} />
        </div>

        {/* ===================== NLP CAPTURE (signature) ===================== */}
        <section style={{ ...card, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
            <Sparkles size={17} color={C.gold} />
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: ".02em" }}>Smart capture</h2>
            <span style={{ color: C.faint, fontSize: 12.5 }}>Type naturally in Hebrew or English - ALGO extracts client, hours &amp; rate.</span>
          </div>

          <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} dir="auto" rows={2}
            placeholder={'3.5 hours on urban renewal contract for Meridian Capital   ·   2.5 שעות עריכת הסכם קומבינציה, תיק לוי נדל"ן   ·   כהן יישוב סכסוכים 1.5 שעות דיון בוררות'}
            style={{ ...inputBase, fontSize: 15, lineHeight: 1.5, resize: "vertical", minHeight: 58 }} />

          {/* activity type + manual rate (lectures) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {ACTIVITY_TYPES.map((a) => (
                <button key={a.value} onClick={() => setActivity(a.value)}
                  style={{
                    padding: "6px 13px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s",
                    background: activity === a.value ? C.goldSoft : C.raised,
                    color: activity === a.value ? C.gold : C.muted,
                    border: `1px solid ${activity === a.value ? C.goldDim : C.line}`,
                  }}>{a.label}</button>
              ))}
            </div>
            {activity === "lecture" && (
              <input
                type="number" value={manualRate} onChange={(e) => setManualRate(e.target.value)}
                placeholder="תעריף הרצאה ₪"
                style={{ ...inputBase, width: 160, fontFamily: MONO, direction: "ltr" }}
              />
            )}
          </div>

          {/* live token read-out */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <Token label="Client" value={parsed ? (parsed.client ? parsed.client.name : "unmatched") : "—"} ok={!!(parsed && parsed.client)} warn={!!(parsed && !parsed.client)} />
            <Token label="Hours" value={parsed && parsed.hours ? parsed.hours : "—"} ok={!!(parsed && parsed.hours)} warn={!!(parsed && !parsed.hours)} />
            <Token label="Rate" value={parsed && parsed.rate ? money0(parsed.rate) : activity === "lecture" ? "הזן תעריף" : "—"} warn={activity === "lecture" && !Number(manualRate)} />
            <Token label="Description" value={parsed && parsed.description ? parsed.description : "—"} grow />
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.muted, fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase" }}>Line total</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: parsed && parsed.total ? C.gold : C.faint }}>{money2(parsed ? parsed.total : 0)}</div>
            </div>
            <button onClick={logEntry} disabled={!parsed || !parsed.hours}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 10,
                fontWeight: 700, fontSize: 14, cursor: parsed && parsed.hours ? "pointer" : "not-allowed",
                background: parsed && parsed.hours ? C.gold : C.raised, color: parsed && parsed.hours ? C.black : C.faint,
                border: "none", transition: "all .15s",
              }}>
              <Plus size={16} /> Log entry <CornerDownLeft size={13} style={{ opacity: 0.6 }} />
            </button>
          </div>
        </section>

        {/* ===================== TIME LOGS LEDGER ===================== */}
        <section style={{ ...card, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <ScrollText size={17} color={C.gold} />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Time logs ledger</h2>
              <span style={{ color: C.faint, fontSize: 12.5 }}>{logs.length} total</span>
            </div>
            <button onClick={runBilling} disabled={running}
              style={{
                display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 11,
                fontWeight: 800, fontSize: 14.5, letterSpacing: ".02em", cursor: running ? "wait" : "pointer",
                color: C.black, border: "none",
                background: `linear-gradient(180deg, ${C.gold}, ${C.goldDim})`,
                boxShadow: "0 6px 20px rgba(212,175,55,0.25)",
              }}>
              <Zap size={17} />{running ? "Generating..." : "Run monthly billing"}
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: "left" }}>
                  {["Date", "Client", "סוג", "Hours", "Description", "Rate", "Line total", "Status", ""].map((h, i) => (
                    <th key={i} style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11.5, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${C.line}`, textAlign: i === 3 || i === 5 || i === 6 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: "26px 10px", color: C.faint, textAlign: "center" }}>No entries yet. Capture your first above.</td></tr>
                )}
                {logs.map((l) => {
                  const unmatched = !l.clientId;
                  const act = ACTIVITY_TYPES.find((a) => a.value === l.activity) || ACTIVITY_TYPES[0];
                  const isLecture = l.activity === "lecture";
                  return (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td style={{ padding: "11px 10px", fontFamily: MONO, color: C.muted, whiteSpace: "nowrap" }}>{l.date}</td>
                      <td style={{ padding: "11px 10px", fontWeight: 600, color: unmatched ? C.red : C.white }} dir="auto">{l.client}</td>
                      <td style={{ padding: "11px 10px" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                          background: isLecture ? "rgba(70,185,140,0.13)" : C.goldSoft,
                          color: isLecture ? C.green : C.gold,
                          border: `1px solid ${isLecture ? "rgba(70,185,140,0.35)" : "rgba(212,175,55,0.35)"}`,
                        }}>{act.label}</span>
                      </td>
                      <td style={{ padding: "11px 10px", fontFamily: MONO, textAlign: "right" }}>{l.hours}</td>
                      <td style={{ padding: "11px 10px", color: C.muted, maxWidth: 280 }} dir="auto">{l.description}</td>
                      <td style={{ padding: "11px 10px", fontFamily: MONO, textAlign: "right", color: C.muted }}>{l.rate ? money0(l.rate) : "—"}</td>
                      <td style={{ padding: "11px 10px", fontFamily: MONO, textAlign: "right", fontWeight: 700, color: C.white }}>{money0(l.total)}</td>
                      <td style={{ padding: "11px 10px" }}><StatusBadge status={l.status} /></td>
                      <td style={{ padding: "11px 10px", textAlign: "right" }}>
                        <button onClick={() => delLog(l.id)} title="Delete" style={iconBtn}><Trash2 size={15} color={C.faint} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ color: C.faint, fontSize: 12, marginTop: 12, marginBottom: 0 }}>
            Billing run invoices <span style={{ color: C.gold }}>Pending</span> entries for clients with <span style={{ color: C.gold }}>Auto-Bill ON</span>, groups them per client, then flips each line to <span style={{ color: C.green }}>Invoiced</span>.
          </p>
        </section>

        {/* ===================== CLIENT DATABASE ===================== */}
        <section style={{ ...card, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Building2 size={17} color={C.gold} />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Client database</h2>
            </div>
            <button onClick={startAdd} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: "pointer", background: C.raised, color: C.gold, border: `1px solid ${C.goldDim}` }}>
              <Plus size={15} /> Add client
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: "left" }}>
                  {["Client name", "Hourly rate (ILS)", "Email", "Auto-bill", ""].map((h, i) => (
                    <th key={i} style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11.5, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap", textAlign: i === 3 ? "center" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editingId === "new" && <ClientEditRow draft={draft} setDraft={setDraft} onSave={saveClient} onCancel={() => { setEditingId(null); setDraft(null); }} />}
                {clients.map((c) =>
                  editingId === c.id ? (
                    <ClientEditRow key={c.id} draft={draft} setDraft={setDraft} onSave={saveClient} onCancel={() => { setEditingId(null); setDraft(null); }} />
                  ) : (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td style={{ padding: "11px 10px", fontWeight: 600 }} dir="auto">{c.name}</td>
                      <td style={{ padding: "11px 10px", fontFamily: MONO }}>{money0(c.rate)}</td>
                      <td style={{ padding: "11px 10px", color: C.muted }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mail size={13} color={C.faint} />{c.email || "—"}</span>
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", justifyContent: "center" }}><Toggle on={c.autoBill} onClick={() => toggleAuto(c.id)} /></div>
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => startEdit(c)} title="Edit" style={iconBtn}><Pencil size={15} color={C.muted} /></button>
                        <button onClick={() => delClient(c.id)} title="Delete" style={iconBtn}><Trash2 size={15} color={C.faint} /></button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer style={{ textAlign: "center", color: C.faint, fontSize: 12, marginTop: 26 }}>
          ALGO · automated legal billing · client-side NLP · no data leaves this screen
        </footer>
      </div>

      {/* ===================== INVOICE MODAL ===================== */}
      {invoices && (
        <InvoiceModal invoices={invoices} active={active} setActive={setActive} onClose={() => setInvoices(null)} notify={flash} />
      )}

      {/* ===================== TOAST ===================== */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 60,
          display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 11,
          background: C.surface, border: `1px solid ${toast.kind === "err" ? C.red : C.goldDim}`,
          color: C.white, fontSize: 13.5, boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}>
          {toast.kind === "err" ? <X size={15} color={C.red} /> : <Check size={15} color={C.gold} />} {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ====================== SUB-COMPONENTS ====================== */
const iconBtn = { background: "transparent", border: "none", cursor: "pointer", padding: 6, borderRadius: 8 };
const chip = () => ({
  display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 9,
  fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
  background: C.raised, color: C.muted, border: `1px solid ${C.line}`,
});

function Token({ label, value, ok, warn, grow }) {
  const color = warn ? C.red : ok ? C.gold : C.muted;
  const border = warn ? "rgba(224,101,78,0.4)" : ok ? "rgba(212,175,55,0.4)" : C.line;
  return (
    <div style={{ flex: grow ? "1 1 200px" : "0 0 auto", minWidth: 0, background: C.black, border: `1px solid ${border}`, borderRadius: 10, padding: "7px 12px" }}>
      <div style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: C.faint }}>{label}</div>
      <div dir="auto" style={{ fontSize: 13.5, fontWeight: 600, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

function ClientEditRow({ draft, setDraft, onSave, onCancel }) {
  const f = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <tr style={{ borderBottom: `1px solid ${C.line}`, background: C.surface }}>
      <td style={{ padding: "8px 10px" }}><input autoFocus value={draft.name} onChange={(e) => f("name", e.target.value)} dir="auto" placeholder="Client name" style={inputBase} /></td>
      <td style={{ padding: "8px 10px" }}><input value={draft.rate} onChange={(e) => f("rate", e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" style={{ ...inputBase, fontFamily: MONO, maxWidth: 120 }} /></td>
      <td style={{ padding: "8px 10px" }}><input value={draft.email} onChange={(e) => f("email", e.target.value)} placeholder="email@firm.com" style={inputBase} /></td>
      <td style={{ padding: "8px 10px", textAlign: "center" }}><div style={{ display: "inline-flex" }}><Toggle on={draft.autoBill} onClick={() => f("autoBill", !draft.autoBill)} /></div></td>
      <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
        <button onClick={onSave} title="Save" style={{ ...iconBtn, background: C.goldSoft }}><Check size={16} color={C.gold} /></button>
        <button onClick={onCancel} title="Cancel" style={iconBtn}><X size={16} color={C.muted} /></button>
      </td>
    </tr>
  );
}

function InvoiceModal({ invoices, active, setActive, onClose, notify }) {
  const inv = invoices[active];
  const sheetRef = useRef(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [mailBusy, setMailBusy] = useState(false);
  const [outlookAccount, setOutlookAccount] = useState(() => getOutlookAccount());
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const rtl = hasHeb(inv.client.name);

  async function connectOutlook() {
    const acct = await outlookSignIn();
    if (acct) { setOutlookAccount(acct); notify && notify("מחובר לאאוטלוק: " + acct.username); }
    else notify && notify("כניסה לאאוטלוק נכשלה", "err");
  }

  // Capture the rendered invoice (browser handles Hebrew RTL) and wrap it in a PDF.
  async function buildPDF() {
    const jspdfMod = await import("jspdf");
    const jsPDF = jspdfMod.jsPDF || jspdfMod.default;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(sheetRef.current, { scale: 2, backgroundColor: "#161618", useCORS: true });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    pdf.setFillColor(11, 11, 12);
    pdf.rect(0, 0, pw, ph, "F");
    const ratio = canvas.height / canvas.width;
    let w = pw - 48, h = w * ratio, x = 24;
    if (h > ph - 48) { h = ph - 48; w = h / ratio; x = (pw - w) / 2; }
    pdf.addImage(img, "PNG", x, 24, w, h);
    return pdf;
  }

  async function downloadPDF() {
    if (!sheetRef.current) return;
    setPdfBusy(true);
    try {
      const pdf = await buildPDF();
      pdf.save(`${inv.number}.pdf`);
      notify && notify("PDF נשמר: " + inv.number);
    } catch {
      notify && notify("ייצוא PDF דורש בנייה מקומית (npm install jspdf html2canvas)", "err");
    } finally {
      setPdfBusy(false);
    }
  }

  async function sendByEmail() {
    if (!inv.client.email) return notify && notify("ללקוח זה אין כתובת מייל", "err");
    if (!outlookAccount) return notify && notify("יש להתחבר לאאוטלוק קודם", "err");
    setMailBusy(true);
    try {
      const pdf = await buildPDF();
      // jsPDF output returns binary string — convert to base64
      const pdfBase64 = btoa(pdf.output());
      await sendInvoiceEmail({
        toEmail: inv.client.email,
        toName: inv.client.name,
        invoiceNumber: inv.number,
        amount: money2(inv.total),
        pdfBase64,
      });
      notify && notify(`חשבונית נשלחה ל-${inv.client.email}`);
    } catch (e) {
      notify && notify("שליחת מייל נכשלה: " + e.message, "err");
    } finally {
      setMailBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.74)", display: "grid", placeItems: "center", padding: 20, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, ...card, background: C.charcoal, overflow: "hidden" }}>

        {/* modal top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <ReceiptText size={17} color={C.gold} />
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>Invoice preview</span>
            <span style={{ color: C.faint, fontSize: 12.5 }}>{active + 1} / {invoices.length}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {invoices.length > 1 && (
              <>
                <button onClick={() => setActive((i) => Math.max(0, i - 1))} disabled={active === 0} style={navBtn(active === 0)}><ChevronLeft size={16} /></button>
                <button onClick={() => setActive((i) => Math.min(invoices.length - 1, i + 1))} disabled={active === invoices.length - 1} style={navBtn(active === invoices.length - 1)}><ChevronRight size={16} /></button>
              </>
            )}
            <button onClick={downloadPDF} disabled={pdfBusy} title="הורדת החשבונית כ-PDF"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: pdfBusy ? "wait" : "pointer", background: C.gold, color: C.black, border: "none" }}>
              <FileDown size={14} /> {pdfBusy ? "מייצא..." : "הורד PDF"}
            </button>
            {msalEnabled && (
              outlookAccount ? (
                <button onClick={sendByEmail} disabled={mailBusy || !inv.client.email} title={inv.client.email ? "שלח חשבונית במייל" : "אין מייל ללקוח"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                    cursor: mailBusy || !inv.client.email ? "not-allowed" : "pointer",
                    background: inv.client.email ? C.green : C.raised,
                    color: inv.client.email ? C.black : C.faint, border: "none", opacity: mailBusy ? 0.7 : 1 }}>
                  <Mail size={14} /> {mailBusy ? "שולח..." : "שלח במייל"}
                </button>
              ) : (
                <button onClick={connectOutlook}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: C.raised, color: C.muted, border: `1px solid ${C.line}` }}>
                  <Mail size={14} /> חבר אאוטלוק
                </button>
              )
            )}
            <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: C.raised, color: C.gold, border: `1px solid ${C.goldDim}` }}><Printer size={14} /> Print</button>
            <button onClick={onClose} style={{ ...iconBtn, background: C.raised, border: `1px solid ${C.line}` }}><X size={16} color={C.muted} /></button>
          </div>
        </div>

        {/* invoice sheet */}
        <div ref={sheetRef} style={{ padding: 28, background: C.charcoal }} dir={rtl ? "rtl" : "ltr"}>
          {/* letterhead */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, paddingBottom: 18, borderBottom: `2px solid ${C.gold}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, direction: "ltr" }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, display: "grid", placeItems: "center", background: C.goldSoft, border: `1px solid ${C.goldDim}` }}><Scale size={22} color={C.gold} /></div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: ".2em" }}>ALGO</div>
                <div style={{ color: C.muted, fontSize: 11.5 }}>Legal Billing</div>
              </div>
            </div>
            <div style={{ textAlign: rtl ? "left" : "right", direction: "ltr" }}>
              <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: C.gold }}>{inv.number}</div>
              <div style={{ color: C.muted, fontSize: 12.5 }}>Issued {inv.date}</div>
            </div>
          </div>

          {/* bill-to */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, margin: "18px 0", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: C.faint, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>Bill to</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3 }} dir="auto">{inv.client.name}</div>
              {inv.client.email && <div style={{ color: C.muted, fontSize: 12.5, direction: "ltr" }}>{inv.client.email}</div>}
            </div>
            <div style={{ textAlign: rtl ? "left" : "right" }}>
              <div style={{ color: C.faint, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>Amount due</div>
              <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800, color: C.gold, marginTop: 3 }}>{money2(inv.total)}</div>
            </div>
          </div>

          {/* line items */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted }}>
                {["Date", "Description", "Hours", "Rate", "Amount"].map((h, i) => (
                  <th key={i} style={{ padding: "8px 8px", fontWeight: 600, fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${C.line}`, textAlign: i >= 2 ? (rtl ? "left" : "right") : (rtl ? "right" : "left") }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td style={{ padding: "10px 8px", fontFamily: MONO, color: C.muted, direction: "ltr" }}>{l.date}</td>
                  <td style={{ padding: "10px 8px" }} dir="auto">{l.description}</td>
                  <td style={{ padding: "10px 8px", fontFamily: MONO, textAlign: rtl ? "left" : "right" }}>{l.hours}</td>
                  <td style={{ padding: "10px 8px", fontFamily: MONO, textAlign: rtl ? "left" : "right", color: C.muted }}>{money0(l.rate)}</td>
                  <td style={{ padding: "10px 8px", fontFamily: MONO, textAlign: rtl ? "left" : "right", fontWeight: 700 }}>{money0(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* totals */}
          <div style={{ display: "flex", justifyContent: rtl ? "flex-start" : "flex-end", marginTop: 18 }}>
            <div style={{ minWidth: 240 }}>
              <Row label="Subtotal" value={money2(inv.subtotal)} />
              <Row label={`VAT (${Math.round(VAT * 100)}%)`} value={money2(inv.vat)} />
              <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700 }}>Total due</span>
                <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 17, color: C.gold }}>{money2(inv.total)}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 22, paddingTop: 14, borderTop: `1px solid ${C.line}`, color: C.faint, fontSize: 11.5, textAlign: "center", direction: "ltr" }}>
            Generated automatically by ALGO · Payment due within 30 days · Thank you for your business
          </div>
        </div>
      </div>
    </div>
  );
}

const navBtn = (disabled) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9,
  background: C.raised, color: disabled ? C.faint : C.white, border: `1px solid ${C.line}`,
  cursor: disabled ? "not-allowed" : "pointer",
});
function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontFamily: MONO }}>{value}</span>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  supabase, JURISDICTIONS, JURISDICTION_LABELS, CURRENCY_SYMBOL,
  REFERRAL_STATUS_LABELS,
  type Profile, type Referral, type Milestone, type Currency,
} from "../lib/supabase";

const EMBED = "*, requester:ldr_profiles!requester_id(display_name), provider:ldr_profiles!provider_id(display_name)";

function allReleased(ms: Milestone[]) {
  return ms.length > 0 && ms.every((m) => m.signed_a && m.signed_b);
}

export default function Referrals({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const [rows, setRows] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "new">("list");
  const [open, setOpen] = useState<Referral | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("ldr_referrals").select(EMBED)
      .order("updated_at", { ascending: false }).limit(100);
    setRows((data as Referral[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const outgoing = rows.filter((r) => r.requester_id === profile.id);
  const incoming = rows.filter((r) => r.provider_id === profile.id);

  return (
    <div className="container" style={{ paddingTop: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>הפניות מאובטחות (Escrow)</h2>
        <button className="btn btn-gold" onClick={() => setView(view === "new" ? "list" : "new")}>
          {view === "new" ? "← לרשימה" : "+ בקשת הפניה"}
        </button>
      </div>
      <p className="muted">
        הפנו משימה לעו״ד בתחום שיפוט אחר. דמי ההפניה מחולקים לאבני-דרך ומשוחררים רק בחתימה דיגיטלית הדדית.
      </p>

      {view === "new" ? (
        <NewReferral profile={profile} notify={notify} onDone={() => { setView("list"); load(); }} />
      ) : loading ? (
        <div className="center" style={{ padding: 50 }}><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="card pad center">
          <p className="muted">אין הפניות עדיין. פתחו בקשת הפניה לעו״ד בתחום שיפוט אחר.</p>
          <button className="btn btn-gold" onClick={() => setView("new")}>בקשת הפניה ראשונה</button>
        </div>
      ) : (
        <div className="grid cols-2">
          <ReferralColumn title="הפניות שיצרתי" list={outgoing} profile={profile} onOpen={setOpen} />
          <ReferralColumn title="הפניות שקיבלתי" list={incoming} profile={profile} onOpen={setOpen} />
        </div>
      )}

      {open && (
        <ReferralDetail
          referral={open} profile={profile} notify={notify}
          onClose={() => { setOpen(null); load(); }}
        />
      )}
    </div>
  );
}

function ReferralColumn({
  title, list, profile, onOpen,
}: { title: string; list: Referral[]; profile: Profile; onOpen: (r: Referral) => void }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{title} ({list.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0 && <div className="card pad"><span className="muted">—</span></div>}
        {list.map((r) => {
          const other = r.requester_id === profile.id ? r.provider?.display_name : r.requester?.display_name;
          const released = r.milestones.filter((m) => m.signed_a && m.signed_b).length;
          return (
            <div key={r.id} className="card pad" style={{ cursor: "pointer" }} onClick={() => onOpen(r)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <b>{other || "עו״ד"}</b>
                <span className="tag" style={{ fontSize: 11 }}>{REFERRAL_STATUS_LABELS[r.status]}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {JURISDICTION_LABELS[r.jurisdiction] ?? r.jurisdiction}
                {r.fee != null && ` · ${CURRENCY_SYMBOL[r.currency]}${r.fee}`}
                {` · אבני-דרך ${released}/${r.milestones.length}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReferralDetail({
  referral, profile, notify, onClose,
}: { referral: Referral; profile: Profile; notify: (m: string) => void; onClose: () => void }) {
  const [r, setR] = useState<Referral>(referral);
  const [busy, setBusy] = useState(false);
  const isRequester = r.requester_id === profile.id;
  const isProvider = r.provider_id === profile.id;

  async function persist(patch: Partial<Referral>) {
    setBusy(true);
    const next = { ...r, ...patch };
    const { error } = await supabase.from("ldr_referrals")
      .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", r.id);
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    setR(next);
  }

  function setMilestones(ms: Milestone[]) {
    const status: Referral["status"] = allReleased(ms) ? "completed" : r.status;
    persist({ milestones: ms, status });
    if (allReleased(ms)) notify("כל אבני-הדרך שוחררו — ההפניה הושלמה 🤝");
  }

  function markDone(id: string) {
    setMilestones(r.milestones.map((m) => m.id === id ? { ...m, done: true } : m));
  }
  function sign(id: string) {
    setMilestones(r.milestones.map((m) => {
      if (m.id !== id) return m;
      const field = isRequester ? "signed_a" : "signed_b";
      return { ...m, [field]: true, signed_at: new Date().toISOString() };
    }));
    notify("נחתם דיגיטלית ✍️");
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 40,
      display: "grid", placeItems: "center", padding: 16,
    }}>
      <div className="card pad" onClick={(e) => e.stopPropagation()}
        style={{ width: "min(640px, 96vw)", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>הפניה מאובטחת</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginTop: 10 }}>
          <span className="tag">{REFERRAL_STATUS_LABELS[r.status]}</span>{" "}
          <span className="tag">{JURISDICTION_LABELS[r.jurisdiction] ?? r.jurisdiction}</span>{" "}
          {r.fee != null && <span className="tag">{CURRENCY_SYMBOL[r.currency]}{r.fee}</span>}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          מ-<b>{r.requester?.display_name || "עו״ד"}</b> אל <b>{r.provider?.display_name || "עו״ד"}</b>
        </div>
        {r.brief && <p style={{ lineHeight: 1.7 }}>{r.brief}</p>}

        {isProvider && r.status === "proposed" && (
          <button className="btn btn-gold" style={{ width: "100%" }} disabled={busy}
            onClick={() => persist({ status: "in_progress" })}>
            {busy ? <span className="spinner" /> : "קבלת ההפניה והתחלת ביצוע"}
          </button>
        )}
        {isRequester && r.status === "proposed" && (
          <button className="btn btn-ghost" style={{ width: "100%" }} disabled={busy}
            onClick={() => persist({ status: "cancelled" })}>ביטול הבקשה</button>
        )}

        <div className="divider" />
        <h4 style={{ margin: "0 0 8px" }}>אבני-דרך · Escrow</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {r.milestones.map((m, i) => {
            const released = m.signed_a && m.signed_b;
            const active = r.status === "in_progress";
            const mineSigned = isRequester ? m.signed_a : m.signed_b;
            return (
              <div key={m.id} className="card pad" style={{ borderColor: released ? "var(--gold)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b>{i + 1}. {m.title}</b>
                  {m.amount != null && <span className="gold" style={{ fontWeight: 800 }}>{CURRENCY_SYMBOL[r.currency]}{m.amount}</span>}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {released ? "✓ שוחרר (חתום ע״י שני הצדדים)" :
                    m.done ? "ממתין לחתימות" : "טרם בוצע"}
                  {"  ·  "}A {m.signed_a ? "✍️" : "—"} · B {m.signed_b ? "✍️" : "—"}
                </div>
                {active && !released && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {isProvider && !m.done && (
                      <button className="btn btn-ghost" disabled={busy} onClick={() => markDone(m.id)}>סימון כבוצע</button>
                    )}
                    {m.done && !mineSigned && (
                      <button className="btn btn-gold" disabled={busy} onClick={() => sign(m.id)}>
                        חתימה דיגיטלית ({isRequester ? "A" : "B"})
                      </button>
                    )}
                    {m.done && mineSigned && <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>חתמת — ממתין לצד השני</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          🔐 זרימת Escrow להמחשה — החתימות נרשמות לאודיט. סליקה כספית אמיתית (Stripe) תתחבר בפרודקשן.
        </p>
      </div>
    </div>
  );
}

function NewReferral({
  profile, notify, onDone,
}: { profile: Profile; notify: (m: string) => void; onDone: () => void }) {
  const [providers, setProviders] = useState<Profile[]>([]);
  const [providerId, setProviderId] = useState("");
  const [jurisdiction, setJurisdiction] = useState(profile.jurisdiction ?? "IL");
  const [brief, setBrief] = useState("");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [fee, setFee] = useState("");
  const [milestones, setMilestones] = useState<{ title: string; amount: string }[]>([{ title: "", amount: "" }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("ldr_profiles").select("*")
      .not("experience_tier", "is", null).neq("id", profile.id)
      .order("reputation", { ascending: false }).limit(100)
      .then(({ data }) => {
        const list = (data as Profile[]) ?? [];
        setProviders(list);
        if (list[0]) setProviderId(list[0].id);
      });
  }, []);

  function setMs(i: number, k: "title" | "amount", v: string) {
    setMilestones((prev) => prev.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  }

  async function create() {
    if (!providerId) { notify("בחרו עו״ד מקבל"); return; }
    const ms = milestones.filter((m) => m.title.trim()).map((m) => ({
      id: crypto.randomUUID(), title: m.title.trim(),
      amount: m.amount ? Number(m.amount) : null,
      done: false, signed_a: false, signed_b: false,
    }));
    if (ms.length === 0) { notify("הוסיפו לפחות אבן-דרך אחת"); return; }
    setBusy(true);
    const { error } = await supabase.from("ldr_referrals").insert({
      requester_id: profile.id, provider_id: providerId, jurisdiction,
      brief: brief.trim(), fee: fee ? Number(fee) : null, currency,
      status: "proposed", milestones: ms,
    });
    setBusy(false);
    if (error) { notify("שגיאה ביצירת ההפניה: " + error.message); return; }
    notify("בקשת ההפניה נשלחה 🔐");
    onDone();
  }

  return (
    <div className="card pad" style={{ marginTop: 16, maxWidth: 680 }}>
      <h3 style={{ marginTop: 0 }}>בקשת הפניה חדשה</h3>
      {providers.length === 0 ? (
        <p className="muted">אין עדיין עו״ד אחרים רשומים לבחירה. הזמינו קולגות כדי לפתוח הפניות.</p>
      ) : (
        <>
          <div className="grid cols-2">
            <div>
              <label>עו״ד מקבל (Provider)</label>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name || "עו״ד"} · {p.reputation} מוניטין</option>
                ))}
              </select>
            </div>
            <div>
              <label>תחום שיפוט של המשימה</label>
              <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                {JURISDICTIONS.map((j) => <option key={j.key} value={j.key}>{j.flag} {j.label}</option>)}
              </select>
            </div>
          </div>

          <label>תדריך המשימה</label>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder="מה נדרש מהעו״ד המקומי (due diligence, נוטריון, הגשה רגולטורית...)" />

          <div className="grid cols-3">
            <div>
              <label>מטבע</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {(["EUR", "USD", "ILS", "GBP"] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>סך דמי הפניה</label>
              <input dir="ltr" inputMode="numeric" value={fee}
                onChange={(e) => setFee(e.target.value.replace(/[^\d]/g, ""))} placeholder="2000" />
            </div>
          </div>

          <div className="divider" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0 }}>אבני-דרך</h4>
            <button className="btn btn-ghost" onClick={() => setMilestones((p) => [...p, { title: "", amount: "" }])}>+ הוספה</button>
          </div>
          {milestones.map((m, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: "1fr auto", gap: 8, marginTop: 8 }}>
              <input value={m.title} onChange={(e) => setMs(i, "title", e.target.value)} placeholder={`אבן-דרך ${i + 1} (למשל: השלמת בדיקת נאותות)`} />
              <input dir="ltr" inputMode="numeric" style={{ width: 110 }} value={m.amount}
                onChange={(e) => setMs(i, "amount", e.target.value.replace(/[^\d]/g, ""))} placeholder="סכום" />
            </div>
          ))}

          <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy || !providerId} onClick={create}>
            {busy ? <span className="spinner" /> : "שליחת בקשת הפניה"}
          </button>
        </>
      )}
    </div>
  );
}

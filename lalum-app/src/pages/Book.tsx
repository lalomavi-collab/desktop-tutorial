import { useMemo, useState, type FormEvent } from "react";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { Icon } from "../components/Icon";
import { SchedulingEmbed } from "../components/SchedulingEmbed";

// When a Calendly link is configured, booking is REAL and instant: the visitor
// gets an email confirmation plus a calendar invite, and the meeting lands on
// the connected Outlook calendar automatically. The manual request form below
// is only a fallback for when scheduling is not yet connected.
const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL;
// Clay / ivory palette to match the light brand (hex without '#').
const CLAY_THEME = { background: "fbf9f3", text: "1a1815", primary: "c15f3c" };

const SLOTS = ["09:00", "10:30", "12:00", "14:00", "15:30"];

type DayOption = { key: string; wd: string; dm: string };

function nextBusinessDays(count: number, lang: "en" | "he"): DayOption[] {
  const out: DayOption[] = [];
  const d = new Date();
  const wdEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const wdHe = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
  let guard = 0;
  while (out.length < count && guard < 30) {
    d.setDate(d.getDate() + 1);
    guard++;
    const day = d.getDay();
    if (day === 5 || day === 6) continue;
    out.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, wd: lang === "he" ? wdHe[day] : wdEn[day], dm: `${mo[d.getMonth()]} ${d.getDate()}` });
  }
  return out;
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function Book() {
  const { t, lang } = useLang();
  const B = t.ui.bookPage;
  const days = useMemo(() => nextBusinessDays(6, lang), [lang]);

  // Real, instant scheduling via the connected calendar.
  if (CALENDLY_URL) {
    return (
      <section className="wrap" style={{ maxWidth: 880, padding: "80px 32px 110px" }}>
        <div style={{ textAlign: "center", maxWidth: "58ch", margin: "0 auto 30px" }}>
          <p className="eyebrow">{B.eyebrow}</p>
          <h1 className="serif" style={{ fontSize: "clamp(30px, 7vw, 42px)", lineHeight: 1.18, letterSpacing: "-0.015em", margin: "0 0 12px" }}>{B.title}</h1>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--slate)", margin: 0 }}>{B.subtitleLive}</p>
        </div>
        <div className="card" style={{ padding: 8 }}>
          <SchedulingEmbed url={CALENDLY_URL} theme={CLAY_THEME} height={720} />
        </div>
      </section>
    );
  }

  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!day || !slot || !emailOk(email)) {
      setMsg({ tone: "err", text: B.need });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (supabase) {
        const { error } = await supabase.functions.invoke("lalum-book", { body: { full_name: name, email, day, slot, topic } });
        if (error) throw error;
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setMsg({ tone: "ok", text: B.ok });
      setDay(""); setSlot(""); setName(""); setEmail(""); setTopic("");
    } catch {
      setMsg({ tone: "err", text: B.err });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wrap" style={{ maxWidth: 760, padding: "80px 32px 120px" }}>
      <div style={{ textAlign: "center", maxWidth: "56ch", margin: "0 auto 36px" }}>
        <p className="eyebrow">{B.eyebrow}</p>
        <h1 className="serif" style={{ fontSize: "clamp(30px, 7vw, 42px)", lineHeight: 1.18, letterSpacing: "-0.015em", margin: "0 0 12px" }}>{B.title}</h1>
        <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--slate)", margin: 0 }}>{B.subtitle}</p>
      </div>

      <div className="card" style={{ padding: 34 }}>
        <form onSubmit={submit}>
          <div className="label">{B.step1}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
            {days.map((d) => {
              const on = day === d.key;
              return (
                <button type="button" key={d.key} onClick={() => { setDay(d.key); setMsg(null); }}
                  style={{ flex: 1, minWidth: 92, padding: "12px 8px", borderRadius: 12, border: `1px solid ${on ? "var(--clay)" : "var(--line-strong)"}`, background: on ? "var(--clay-tint)" : "var(--card)", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "var(--slate)" }}>{d.wd}</div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 17, marginTop: 4 }} dir="ltr">{d.dm}</div>
                </button>
              );
            })}
          </div>

          <div className="label">{B.step2}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
            {SLOTS.map((s) => {
              const on = slot === s;
              return (
                <button type="button" key={s} onClick={() => { setSlot(s); setMsg(null); }}
                  style={{ padding: "11px 20px", borderRadius: 9999, border: `1px solid ${on ? "var(--clay)" : "var(--line-strong)"}`, background: on ? "var(--clay)" : "var(--card)", color: on ? "var(--paper)" : "var(--ink)", cursor: "pointer", fontSize: 15, fontWeight: 600 }} dir="ltr">
                  {s}
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }} className="grid-2">
            <div>
              <div className="label">{B.name}</div>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={B.namePlaceholder} />
            </div>
            <div>
              <div className="label">{B.email}</div>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={B.emailPlaceholder} dir="ltr" />
            </div>
          </div>

          <div className="label">{B.topic}</div>
          <textarea className="field" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={B.topicPlaceholder} style={{ resize: "vertical", marginBottom: 18 }} />

          <button className="btn btn-clay" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
            <Icon name="calendar" size={18} /> {busy ? B.sending : B.submit}
          </button>
          {msg && <div className={`notice ${msg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginTop: 16 }}>{msg.text}</div>}
        </form>
      </div>
    </section>
  );
}

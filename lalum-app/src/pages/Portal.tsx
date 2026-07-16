import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { Icon } from "../components/Icon";
import { SchedulingEmbed } from "../components/SchedulingEmbed";

// When set, an embedded Calendly replaces the manual day/time picker.
const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL as string | undefined;

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
    if (day === 5 || day === 6) continue; // skip Fri/Sat
    out.push({
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      wd: lang === "he" ? wdHe[day] : wdEn[day],
      dm: `${mo[d.getMonth()]} ${d.getDate()}`,
    });
  }
  return out;
}

type Tone = "ok" | "warn" | "err";
type VerifyResult = { label: string; detail: string; tone: Tone };

export function Portal() {
  const { user, signOut, demoMode } = useAuth();
  const { t, lang } = useLang();
  const P = t.ui.portal;
  const days = useMemo(() => nextBusinessDays(6, lang), [lang]);

  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [topic, setTopic] = useState("");
  const [bookBusy, setBookBusy] = useState(false);
  const [bookMsg, setBookMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [jurisdiction, setJurisdiction] = useState("IL");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyRes, setVerifyRes] = useState<VerifyResult | null>(null);

  async function submitBooking(e: FormEvent) {
    e.preventDefault();
    if (!day || !slot) return;
    setBookBusy(true);
    setBookMsg(null);
    try {
      if (supabase) {
        const { error } = await supabase.from("lalum_consultation_requests").insert({ requested_day: day, requested_slot: slot, topic: topic || null });
        if (error) throw error;
        // Best-effort confirmation email via Resend (no-op if not deployed).
        void supabase.functions.invoke("lalum-notify", { body: { day, slot, topic } });
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setBookMsg({ tone: "ok", text: `${P.book.okPrefix}${day} ${P.book.okAt} ${slot}. ${P.book.okSuffix}` });
      setDay("");
      setSlot("");
      setTopic("");
    } catch (err) {
      setBookMsg({ tone: "err", text: err instanceof Error ? err.message : P.verify.results.error.detail });
    } finally {
      setBookBusy(false);
    }
  }

  async function submitVerify(e: FormEvent) {
    e.preventDefault();
    if (!fullName || !licenseNo) return;
    setVerifyBusy(true);
    setVerifyRes(null);
    const R = P.verify.results;
    try {
      let matchResult = "not_found";
      let verified = false;
      if (supabase) {
        const { data, error } = await supabase.functions.invoke("lalum-attorney-verify", { body: { full_name: fullName, license_no: licenseNo, jurisdiction } });
        if (error) throw error;
        matchResult = (data?.match_result as string) ?? "not_found";
        verified = Boolean(data?.verified);
      } else {
        await new Promise((r) => setTimeout(r, 500));
        if (/^\d{4,}$/.test(licenseNo.trim()) && fullName.trim().length > 2) {
          matchResult = "auto_matched";
          verified = true;
        }
      }
      if (verified || matchResult === "auto_matched" || matchResult === "manual_approved") setVerifyRes({ ...R.verified, tone: "ok" });
      else if (matchResult === "name_mismatch") setVerifyRes({ ...R.nameMismatch, tone: "warn" });
      else if (matchResult === "suspended") setVerifyRes({ ...R.suspended, tone: "warn" });
      else if (matchResult === "not_found") setVerifyRes({ ...R.notFound, tone: "err" });
      else setVerifyRes({ ...R.pending, tone: "warn" });
    } catch (err) {
      setVerifyRes({ label: R.error.label, detail: err instanceof Error ? err.message : R.error.detail, tone: "err" });
    } finally {
      setVerifyBusy(false);
    }
  }

  const noticeClass = (tone: Tone) => (tone === "ok" ? "notice-ok" : tone === "warn" ? "notice-warn" : "notice-err");

  return (
    <section className="wrap" style={{ padding: "56px 32px 120px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 40 }}>
        <div>
          <p className="eyebrow">{P.eyebrow}</p>
          <h1 className="serif" style={{ fontSize: 36, margin: 0 }}>{P.welcome}</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 15 }} dir="ltr">{user?.email}</p>
        </div>
        <button onClick={() => signOut()} className="btn btn-ink btn-sm">
          <Icon name="logout" size={16} /> {P.signOut}
        </button>
      </div>

      {demoMode && <div className="notice notice-warn" style={{ marginBottom: 28 }}>{P.demo}</div>}

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        {/* BOOKING */}
        <div className="card" style={{ padding: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span className="icon-badge"><Icon name="calendar" size={22} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>{P.book.title}</h2>
          </div>
          {CALENDLY_URL ? (
            <div style={{ background: "var(--ink)", borderRadius: 16, padding: 14 }}>
              <SchedulingEmbed
                url={CALENDLY_URL}
                prefill={{ email: user?.email ?? undefined }}
                onScheduled={() => setBookMsg({ tone: "ok", text: P.book.okSuffix })}
              />
              {bookMsg && (
                <div className={`notice ${bookMsg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginTop: 16 }}>{bookMsg.text}</div>
              )}
            </div>
          ) : (
          <form onSubmit={submitBooking}>
            <div className="label">{P.book.step1}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              {days.map((d) => {
                const on = day === d.key;
                return (
                  <button type="button" key={d.key} onClick={() => { setDay(d.key); setBookMsg(null); }}
                    style={{ flex: 1, minWidth: 84, padding: "12px 8px", borderRadius: 12, border: `1px solid ${on ? "var(--clay)" : "var(--line-strong)"}`, background: on ? "var(--clay-tint)" : "var(--card)", cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "var(--slate)" }}>{d.wd}</div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 17, marginTop: 4 }} dir="ltr">{d.dm}</div>
                  </button>
                );
              })}
            </div>

            <div className="label">{P.book.step2}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              {SLOTS.map((s) => {
                const on = slot === s;
                return (
                  <button type="button" key={s} onClick={() => { setSlot(s); setBookMsg(null); }}
                    style={{ padding: "11px 20px", borderRadius: 9999, border: `1px solid ${on ? "var(--clay)" : "var(--line-strong)"}`, background: on ? "var(--clay)" : "var(--card)", color: on ? "var(--paper)" : "var(--ink)", cursor: "pointer", fontSize: 15, fontWeight: 600 }} dir="ltr">
                    {s}
                  </button>
                );
              })}
            </div>

            <div className="label">{P.book.step3}</div>
            <textarea className="field" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={P.book.topicPlaceholder} style={{ resize: "vertical", marginBottom: 18 }} />

            <button className="btn btn-clay" style={{ width: "100%", justifyContent: "center" }} disabled={!day || !slot || bookBusy}>
              {bookBusy ? P.book.sending : P.book.submit}
            </button>
            {bookMsg && <div className={`notice ${bookMsg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginTop: 16 }}>{bookMsg.text}</div>}
          </form>
          )}
        </div>

        {/* VERIFICATION */}
        <div className="card" style={{ padding: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span className="icon-badge"><Icon name="shield" size={22} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>{P.verify.title}</h2>
          </div>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>{P.verify.intro}</p>
          <form onSubmit={submitVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="label">{P.verify.fullName}</div>
              <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={P.verify.fullNamePlaceholder} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 2 }}>
                <div className="label">{P.verify.license}</div>
                <input className="field" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder={P.verify.licensePlaceholder} dir="ltr" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">{P.verify.bar}</div>
                <select className="field" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                  <option value="IL">IL</option>
                  <option value="US">US</option>
                  <option value="EU">EU</option>
                </select>
              </div>
            </div>
            <button className="btn btn-ink" style={{ justifyContent: "center", marginTop: 4 }} disabled={!fullName || !licenseNo || verifyBusy}>
              {verifyBusy ? P.verify.checking : P.verify.submit}
            </button>
          </form>
          {verifyRes && (
            <div className={`notice ${noticeClass(verifyRes.tone)}`} style={{ marginTop: 16 }}>
              <strong>{verifyRes.label}.</strong> {verifyRes.detail}
            </div>
          )}
          {demoMode && <p className="muted" style={{ fontSize: 12, margin: "12px 0 0" }}>{P.verify.demoTip}</p>}
        </div>
      </div>
    </section>
  );
}

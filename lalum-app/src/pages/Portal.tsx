import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Icon } from "../components/Icon";

const SLOTS = ["09:00", "10:30", "12:00", "14:00", "15:30"];

type DayOption = { key: string; wd: string; dm: string };

function nextBusinessDays(count: number): DayOption[] {
  const out: DayOption[] = [];
  const d = new Date();
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
  let guard = 0;
  while (out.length < count && guard < 30) {
    d.setDate(d.getDate() + 1);
    guard++;
    const day = d.getDay();
    if (day === 5 || day === 6) continue; // skip Fri/Sat
    out.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, wd: wd[day], dm: `${mo[d.getMonth()]} ${d.getDate()}` });
  }
  return out;
}

type VerifyResult = { ok: boolean; label: string; detail: string; tone: "ok" | "warn" | "err" };

export function Portal() {
  const { user, signOut, demoMode } = useAuth();
  const days = useMemo(() => nextBusinessDays(6), []);

  // --- booking state ---
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [topic, setTopic] = useState("");
  const [bookBusy, setBookBusy] = useState(false);
  const [bookMsg, setBookMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // --- verification state ---
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
        const { error } = await supabase.from("consultation_requests").insert({
          requested_day: day,
          requested_slot: slot,
          topic: topic || null,
        });
        if (error) throw error;
      } else {
        await new Promise((r) => setTimeout(r, 400)); // demo latency
      }
      setBookMsg({ tone: "ok", text: `Request received for ${day} at ${slot}. We'll confirm within one business hour.` });
      setDay("");
      setSlot("");
      setTopic("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setBookMsg({ tone: "err", text: msg });
    } finally {
      setBookBusy(false);
    }
  }

  async function submitVerify(e: FormEvent) {
    e.preventDefault();
    if (!fullName || !licenseNo) return;
    setVerifyBusy(true);
    setVerifyRes(null);
    try {
      let matchResult = "not_found";
      let verified = false;
      if (supabase) {
        const { data, error } = await supabase.functions.invoke("verify-attorney", {
          body: { full_name: fullName, license_no: licenseNo, jurisdiction },
        });
        if (error) throw error;
        matchResult = (data?.match_result as string) ?? "not_found";
        verified = Boolean(data?.verified);
      } else {
        // Demo: a numeric license of 4+ digits with a real-looking name "matches".
        await new Promise((r) => setTimeout(r, 500));
        if (/^\d{4,}$/.test(licenseNo.trim()) && fullName.trim().length > 2) {
          matchResult = "auto_matched";
          verified = true;
        }
      }
      setVerifyRes(mapVerify(matchResult, verified));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed.";
      setVerifyRes({ ok: false, label: "Could not verify", detail: msg, tone: "err" });
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <section className="wrap" style={{ padding: "56px 32px 120px" }}>
      {/* header row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 40 }}>
        <div>
          <p className="eyebrow">Client portal</p>
          <h1 className="serif" style={{ fontSize: 36, margin: 0 }}>Welcome back</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 15 }} dir="ltr">{user?.email}</p>
        </div>
        <button onClick={() => signOut()} className="btn btn-ink btn-sm">
          <Icon name="logout" size={16} /> Sign out
        </button>
      </div>

      {demoMode && (
        <div className="notice notice-warn" style={{ marginBottom: 28 }}>
          Demo mode: Supabase is not configured, so submissions below are simulated locally and not sent anywhere. Set
          VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect the live backend.
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        {/* BOOKING */}
        <div className="card" style={{ padding: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span className="icon-badge"><Icon name="calendar" size={22} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>Book a diagnostics session</h2>
          </div>
          <form onSubmit={submitBooking}>
            <div className="label">1 · Choose a day</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              {days.map((d) => {
                const on = day === d.key;
                return (
                  <button type="button" key={d.key} onClick={() => { setDay(d.key); setBookMsg(null); }}
                    style={{ flex: 1, minWidth: 84, padding: "12px 8px", borderRadius: 12, border: `1px solid ${on ? "var(--clay)" : "var(--line-strong)"}`, background: on ? "var(--clay-tint)" : "var(--card)", cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d.wd}</div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 17, marginTop: 4 }}>{d.dm}</div>
                  </button>
                );
              })}
            </div>

            <div className="label">2 · Choose a time</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              {SLOTS.map((s) => {
                const on = slot === s;
                return (
                  <button type="button" key={s} onClick={() => { setSlot(s); setBookMsg(null); }}
                    style={{ padding: "11px 20px", borderRadius: 9999, border: `1px solid ${on ? "var(--clay)" : "var(--line-strong)"}`, background: on ? "var(--clay)" : "var(--card)", color: on ? "var(--paper)" : "var(--ink)", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
                    {s}
                  </button>
                );
              })}
            </div>

            <div className="label">3 · What's it about? (optional)</div>
            <textarea className="field" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Briefly, the matter you'd like to map." style={{ resize: "vertical", marginBottom: 18 }} />

            <button className="btn btn-clay" style={{ width: "100%", justifyContent: "center" }} disabled={!day || !slot || bookBusy}>
              {bookBusy ? "Sending…" : "Request this slot"}
            </button>
            {bookMsg && <div className={`notice ${bookMsg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginTop: 16 }}>{bookMsg.text}</div>}
          </form>
        </div>

        {/* VERIFICATION */}
        <div className="card" style={{ padding: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span className="icon-badge"><Icon name="shield" size={22} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>Attorney verification</h2>
          </div>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>
            For attorneys collaborating with LALUM. We match your details against the official bar registry. Only an exact match auto-verifies; anything else goes to manual review.
          </p>
          <form onSubmit={submitVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="label">Full name (as registered)</div>
              <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full legal name" />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 2 }}>
                <div className="label">License number</div>
                <input className="field" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="e.g. 12345" dir="ltr" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">Bar</div>
                <select className="field" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                  <option value="IL">IL</option>
                  <option value="US">US</option>
                  <option value="EU">EU</option>
                </select>
              </div>
            </div>
            <button className="btn btn-ink" style={{ justifyContent: "center", marginTop: 4 }} disabled={!fullName || !licenseNo || verifyBusy}>
              {verifyBusy ? "Checking…" : "Verify against registry"}
            </button>
          </form>
          {verifyRes && (
            <div className={`notice ${verifyRes.tone === "ok" ? "notice-ok" : verifyRes.tone === "warn" ? "notice-warn" : "notice-err"}`} style={{ marginTop: 16 }}>
              <strong>{verifyRes.label}.</strong> {verifyRes.detail}
            </div>
          )}
          {demoMode && (
            <p className="muted" style={{ fontSize: 12, margin: "12px 0 0" }}>
              Demo tip: a numeric license of four or more digits with any name simulates a successful match.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function mapVerify(matchResult: string, verified: boolean): VerifyResult {
  if (verified || matchResult === "auto_matched" || matchResult === "manual_approved") {
    return { ok: true, label: "Verified", detail: "Your bar registration was confirmed. Your account is now marked verified.", tone: "ok" };
  }
  switch (matchResult) {
    case "name_mismatch":
      return { ok: false, label: "Name mismatch", detail: "The license number exists, but the name does not match the registry. Sent to manual review.", tone: "warn" };
    case "suspended":
      return { ok: false, label: "On hold", detail: "The registry lists this license as suspended or inactive. Sent to manual review.", tone: "warn" };
    case "not_found":
      return { ok: false, label: "Not found", detail: "No matching license in the registry for that jurisdiction. Check the number and try again.", tone: "err" };
    default:
      return { ok: false, label: "Pending review", detail: "Your submission was received and is pending manual review.", tone: "warn" };
  }
}

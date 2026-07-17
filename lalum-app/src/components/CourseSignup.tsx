import { useState, type FormEvent } from "react";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { contactEmail } from "../lib/content";
import { Icon } from "./Icon";

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Dark "Prestige Executive" course registration section. Captures a lead
// (organization or individual) and sends it to the firm via the lalum-lead
// Edge Function, with a demo fallback when the backend is not configured.
export function CourseSignup() {
  const { t } = useLang();
  const c = t.training.course;

  const [audience, setAudience] = useState<"organization" | "individual">("organization");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !emailOk(email) || phone.trim().length < 6) {
      setMsg({ tone: "err", text: c.need });
      return;
    }
    setBusy(true);
    setMsg(null);
    // Preferred path: a backend function captures the lead. If it is not
    // deployed yet, fall back to a prefilled email to the firm so no lead is
    // ever lost and no backend is required.
    try {
      const res = supabase
        ? await supabase.functions.invoke("lalum-lead", { body: { audience, full_name: name, email, phone, note, source: "course" } })
        : { error: new Error("no-backend") };
      if (res.error) throw res.error;
      setMsg({ tone: "ok", text: c.ok });
      setName(""); setEmail(""); setPhone(""); setNote("");
    } catch {
      const subject = `Course registration (${audience})`;
      const body = `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nAudience: ${audience}\nNote: ${note}`;
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setMsg({ tone: "ok", text: c.ok });
      setName(""); setEmail(""); setPhone(""); setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="course-dark" id="course" style={{ scrollMarginTop: 76 }}>
      <span className="course-glow" aria-hidden="true" />
      <div className="wrap" style={{ position: "relative", zIndex: 1, maxWidth: 980, padding: "88px 32px" }}>
        <div style={{ textAlign: "center" }}>
          <span className="course-eyebrow" dir="ltr">{c.eyebrow}</span>
          <h2 className="course-title serif">{c.title}</h2>
          <span className="course-rule" aria-hidden="true" />
          <p className="course-sub">{c.subtitle}</p>
        </div>

        <div className="course-card">
          <p className="course-intro">{c.formIntro}</p>
          <form onSubmit={submit}>
            <div className="course-label">{c.typeLabel}</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button type="button" className={"course-type-btn" + (audience === "organization" ? " on" : "")} onClick={() => setAudience("organization")}>
                <Icon name="shield" size={17} /> {c.typeOrg}
              </button>
              <button type="button" className={"course-type-btn" + (audience === "individual" ? " on" : "")} onClick={() => setAudience("individual")}>
                <Icon name="user" size={17} /> {c.typeIndividual}
              </button>
            </div>

            <div className="grid grid-2" style={{ gap: 14, marginBottom: 14 }}>
              <div>
                <div className="course-label">{c.name}</div>
                <input className="course-field" value={name} onChange={(e) => setName(e.target.value)} placeholder={c.namePlaceholder} />
              </div>
              <div>
                <div className="course-label">{c.phone}</div>
                <input className="course-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={c.phonePlaceholder} dir="ltr" inputMode="tel" />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div className="course-label">{c.email}</div>
              <input className="course-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={c.emailPlaceholder} dir="ltr" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div className="course-label">{c.note}</div>
              <textarea className="course-field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.notePlaceholder} style={{ resize: "vertical" }} />
            </div>

            <button className="course-submit" disabled={busy}>
              <Icon name="send" size={17} /> {busy ? c.sending : c.submit}
            </button>
            {msg && <div className={"course-msg " + (msg.tone === "ok" ? "course-msg-ok" : "course-msg-err")}>{msg.text}</div>}
          </form>
        </div>
      </div>
    </section>
  );
}

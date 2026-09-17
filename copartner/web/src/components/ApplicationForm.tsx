import { useState, type FormEvent } from "react";
import { DOMAINS } from "../lib/content";
import { submitApplication } from "../lib/supabase";
import Reveal from "./Reveal";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus-ring focus:border-cyan/60";
const LABEL_CLASS = "block text-xs font-semibold tracking-wide text-muted uppercase mb-2";

const EMPTY = {
  full_name: "", professional_title: "", primary_domain: "", years_of_practice: "",
  academic_background: "", current_practice: "", client_profile: "",
  email: "", phone: "", website: "", transform_note: "",
};

export default function ApplicationForm() {
  const [form, setForm] = useState(EMPTY);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ack) { setError("Please confirm the confidentiality acknowledgement."); return; }
    setBusy(true);
    setError(null);
    const result = await submitApplication(form);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setDone(true);
  }

  if (done) {
    return (
      <Reveal className="rounded-2xl border border-cyan/30 bg-cyan/5 p-10 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-cyan uppercase">Application Received</p>
        <p className="mt-4 text-lg text-ink font-semibold">Your submission has been securely received.</p>
        <p className="mt-2 text-sm text-muted max-w-md mx-auto">
          A member of the CoPartner team will review the information and contact you regarding the next stage.
        </p>
      </Reveal>
    );
  }

  return (
    <Reveal>
      <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-6 md:p-10 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className={LABEL_CLASS} htmlFor="full_name">Full Name</label>
            <input id="full_name" required className={FIELD_CLASS} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="professional_title">Professional Title</label>
            <input id="professional_title" required className={FIELD_CLASS} value={form.professional_title} onChange={(e) => set("professional_title", e.target.value)} />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="primary_domain">Primary Domain</label>
            <select id="primary_domain" required className={FIELD_CLASS} value={form.primary_domain} onChange={(e) => set("primary_domain", e.target.value)}>
              <option value="" disabled>Select a domain</option>
              {DOMAINS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
              <option value="other">Other / not listed</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="years_of_practice">Years of Practice</label>
            <input id="years_of_practice" required className={FIELD_CLASS} value={form.years_of_practice} onChange={(e) => set("years_of_practice", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className={LABEL_CLASS} htmlFor="academic_background">Academic Background</label>
            <input id="academic_background" className={FIELD_CLASS} value={form.academic_background} onChange={(e) => set("academic_background", e.target.value)} />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="current_practice">Current Practice / Team</label>
            <input id="current_practice" className={FIELD_CLASS} value={form.current_practice} onChange={(e) => set("current_practice", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="client_profile">Client / Market Profile</label>
            <input id="client_profile" className={FIELD_CLASS} value={form.client_profile} onChange={(e) => set("client_profile", e.target.value)} />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="email">Email</label>
            <input id="email" type="email" required className={FIELD_CLASS} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="phone">Phone</label>
            <input id="phone" type="tel" className={FIELD_CLASS} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className={LABEL_CLASS} htmlFor="website">Website / LinkedIn</label>
            <input id="website" className={FIELD_CLASS} value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className={LABEL_CLASS} htmlFor="transform_note">What part of your practice would you most like to transform?</label>
            <textarea id="transform_note" rows={4} className={FIELD_CLASS} value={form.transform_note} onChange={(e) => set("transform_note", e.target.value)} />
          </div>
        </div>

        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" className="mt-1 focus-ring" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          I understand this submission is confidential and will be reviewed by the CoPartner team.
        </label>

        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center rounded-full bg-cyan text-bg px-7 py-4 text-sm font-bold tracking-wide hover:opacity-90 transition-opacity disabled:opacity-60 focus-ring"
        >
          {busy ? "Submitting…" : "SUBMIT CONFIDENTIAL APPLICATION"}
        </button>
      </form>
    </Reveal>
  );
}

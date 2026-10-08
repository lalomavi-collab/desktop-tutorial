import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { PRACTICE } from "../../lib/cockpit/shared";
import type { Membership } from "../../lib/cockpit/shared";
import { CockpitFrame } from "./CockpitFrame";

// Know Your Client (KYC / AML identification). This is the one screen that holds
// real client identity, a deliberate exception to the platform's masking design,
// because the lawyers' AML order requires identifying the client and keeping the
// record. The practice areas that trigger the duty are the financial "business
// services": real estate deals and company / M&A work.
const BUSINESS_SERVICE = new Set(["REAL_ESTATE", "COMMERCIAL_MA"]);

const ID_TYPE: Record<string, string> = { ID: "ת״ז", PASSPORT: "דרכון", COMPANY: "ח״פ", OTHER: "אחר" };
const RISK: Record<string, [string, string]> = { LOW: ["green", "נמוך"], MEDIUM: ["yellow", "בינוני"], HIGH: ["red", "גבוה"] };
const DECISION: Record<string, [string, string]> = { PENDING: ["yellow", "ממתין"], PROCEED: ["green", "להמשיך"], DECLINE: ["red", "לסרב"] };

interface Matter { id: string; title: string; practice_area: string }
interface Kyc {
  matter_id: string; client_name: string; id_type: string; id_number: string; address: string;
  phone: string; email: string; occupation: string; purpose_of_service: string; source_of_funds: string;
  sanctions_checked: boolean; is_pep: boolean; risk_level: string; decision: string; decision_notes: string;
  id_document_name: string; service_ended_at: string | null; updated_at?: string;
}

function blank(matterId: string, purpose: string): Kyc {
  return {
    matter_id: matterId, client_name: "", id_type: "ID", id_number: "", address: "", phone: "", email: "",
    occupation: "", purpose_of_service: purpose, source_of_funds: "", sanctions_checked: false, is_pep: false,
    risk_level: "LOW", decision: "PENDING", decision_notes: "", id_document_name: "", service_ended_at: null,
  };
}

function retainUntil(ended: string | null): string | null {
  if (!ended) return null;
  const d = new Date(ended);
  d.setFullYear(d.getFullYear() + 5);
  return d.toLocaleDateString("he-IL");
}

function Panel({ member }: { member: Membership }) {
  const { user } = useAuth();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [records, setRecords] = useState<Record<string, Kyc>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<Kyc | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const [m, k] = await Promise.all([
        supabase.from("lalum_cockpit_matters").select("id, title, practice_area").eq("firm_id", member.firm_id).order("created_at", { ascending: false }),
        supabase.from("lalum_kyc_records").select("*").eq("firm_id", member.firm_id),
      ]);
      setMatters((m.data as Matter[] | null) ?? []);
      const byMatter: Record<string, Kyc> = {};
      for (const r of (k.data as Kyc[] | null) ?? []) byMatter[r.matter_id] = r;
      setRecords(byMatter);
    })();
  }, [member.firm_id, rev]);

  function open(mt: Matter) {
    setSelected(mt.id);
    setMsg(null);
    setForm(records[mt.id] ? { ...records[mt.id] } : blank(mt.id, mt.title));
  }

  async function save() {
    if (!supabase || !user || !form) return;
    const row = { ...form, firm_id: member.firm_id, updated_by: user.id, updated_at: new Date().toISOString() };
    const existing = records[form.matter_id];
    const { error } = existing
      ? await supabase.from("lalum_kyc_records").update(row).eq("matter_id", form.matter_id)
      : await supabase.from("lalum_kyc_records").insert({ ...row, created_by: user.id });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "נשמר." });
    setRev((n) => n + 1);
  }

  const set = <K extends keyof Kyc>(k: K, v: Kyc[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const selectedMatter = useMemo(() => matters.find((x) => x.id === selected) ?? null, [matters, selected]);
  const isBusiness = selectedMatter ? BUSINESS_SERVICE.has(selectedMatter.practice_area) : false;

  return (
    <div className="ck-grid2" style={{ gridTemplateColumns: "minmax(260px, 340px) 1fr", alignItems: "start" }}>
      <div className="ck-stack">
        <div className="ck-meta">בחרו תיק כדי למלא או לעדכן את תיעוד הכרת הלקוח. תיקי „שירות עסקי" (נדל״ן, מסחרי / M&amp;A) מסומנים, ובהם הזיהוי נדרש לפני המשך הטיפול.</div>
        {matters.map((mt) => {
          const r = records[mt.id];
          const biz = BUSINESS_SERVICE.has(mt.practice_area);
          const d = r ? DECISION[r.decision] : null;
          return (
            <button key={mt.id} className="ck-card" onClick={() => open(mt)} style={{ textAlign: "start", cursor: "pointer", borderColor: selected === mt.id ? "var(--clay)" : undefined }}>
              <div className="ck-row" style={{ justifyContent: "space-between" }}>
                <span className="ck-title">{mt.title}</span>
                {biz && <span className="ck-badge yellow">שירות עסקי</span>}
              </div>
              <div className="ck-row" style={{ gap: 6 }}>
                <span className="ck-meta">{PRACTICE[mt.practice_area] ?? mt.practice_area}</span>
                {d ? <span className={`ck-badge ${d[0]}`}>{d[1]}</span> : <span className="ck-chip">ללא תיעוד</span>}
              </div>
            </button>
          );
        })}
        {!matters.length && <div className="ck-card"><div className="ck-meta">אין תיקים עדיין.</div></div>}
      </div>

      {form && selectedMatter ? (
        <div className="ck-stack">
          <div className="ck-card">
            <div className="ck-title">{selectedMatter.title}</div>
            <div className="ck-meta">{PRACTICE[selectedMatter.practice_area] ?? selectedMatter.practice_area}</div>
            {isBusiness && <div className="ck-warn">תיק „שירות עסקי": חלות חובות זיהוי הלקוח, הערכת סיכון ושמירת רישום לפי צו איסור הלבנת הון החל על עורכי דין. יש לאמת את הפרטים מול מסמך מזהה מקורי.</div>}
          </div>

          <div className="ck-label">זיהוי הלקוח</div>
          <div className="ck-card ck-grid2">
            <div className="ck-field">שם מלא<input className="ck-input" value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></div>
            <div className="ck-field">סוג מסמך מזהה<select className="ck-select" value={form.id_type} onChange={(e) => set("id_type", e.target.value)}>{Object.entries(ID_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="ck-field">מספר זיהוי<input className="ck-input" dir="ltr" value={form.id_number} onChange={(e) => set("id_number", e.target.value)} /></div>
            <div className="ck-field">עיסוק<input className="ck-input" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} /></div>
            <div className="ck-field">כתובת<input className="ck-input" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div className="ck-field">טלפון<input className="ck-input" dir="ltr" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="ck-field">דוא״ל<input className="ck-input" dir="ltr" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="ck-field">שם מסמך מזהה שאומת<input className="ck-input" value={form.id_document_name} onChange={(e) => set("id_document_name", e.target.value)} /></div>
          </div>

          <div className="ck-label">מהות השירות ומקור הכספים</div>
          <div className="ck-card ck-stack">
            <div className="ck-field">מהות השירות המבוקש<input className="ck-input" value={form.purpose_of_service} onChange={(e) => set("purpose_of_service", e.target.value)} /></div>
            <div className="ck-field">מקור הכספים<textarea className="ck-textarea" style={{ minHeight: 90 }} value={form.source_of_funds} onChange={(e) => set("source_of_funds", e.target.value)} /></div>
          </div>

          <div className="ck-label">בקרה והערכת סיכון</div>
          <div className="ck-card ck-stack">
            <label className="ck-row" style={{ gap: 8 }}><input type="checkbox" checked={form.sanctions_checked} onChange={(e) => set("sanctions_checked", e.target.checked)} /> בוצעה בדיקה מול רשימות סנקציות וטרור</label>
            <label className="ck-row" style={{ gap: 8 }}><input type="checkbox" checked={form.is_pep} onChange={(e) => set("is_pep", e.target.checked)} /> הלקוח הוא אישיות ציבורית בכירה (PEP) או קרוב של כזו</label>
            <div className="ck-grid2">
              <div className="ck-field">רמת סיכון<select className="ck-select" value={form.risk_level} onChange={(e) => set("risk_level", e.target.value)}>{Object.entries(RISK).map(([v, l]) => <option key={v} value={v}>{l[1]}</option>)}</select></div>
              <div className="ck-field">החלטה<select className="ck-select" value={form.decision} onChange={(e) => set("decision", e.target.value)}>{Object.entries(DECISION).map(([v, l]) => <option key={v} value={v}>{l[1]}</option>)}</select></div>
            </div>
            <div className="ck-field">נימוקי ההחלטה<textarea className="ck-textarea" style={{ minHeight: 80 }} value={form.decision_notes} onChange={(e) => set("decision_notes", e.target.value)} /></div>
          </div>

          <div className="ck-label">שמירת הרישום</div>
          <div className="ck-card ck-stack">
            <div className="ck-field">מועד סיום הטיפול (תחילת ספירת השמירה)<input className="ck-input" type="date" dir="ltr" value={form.service_ended_at ?? ""} onChange={(e) => set("service_ended_at", e.target.value || null)} style={{ maxWidth: 220 }} /></div>
            {retainUntil(form.service_ended_at) && <div className="ck-meta">לפי חובת השמירה, הרישום נשמר לפחות חמש שנים לאחר מתן השירות, כלומר עד <b>{retainUntil(form.service_ended_at)}</b>.</div>}
            <div className="ck-ok">הרישום הזה אינו מועבר לאף רשות. עורך דין, בשונה מגוף פיננסי, אינו חב בדיווח יזום על עסקה חשודה, אלא בחובות זיהוי, הערכת סיכון ושמירת רישום בלבד.</div>
          </div>

          <div className="ck-row">
            <button className="ck-btn primary" onClick={() => void save()}>שמירת תיעוד</button>
            {msg && <span className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite" style={{ padding: "6px 12px" }}>{msg.text}</span>}
          </div>
          <div className="ck-meta">המידע בטופס זה הוא תיעוד פנימי לצורך חובות הזיהוי. אין באמור ייעוץ משפטי, והתאמת הדרישות למקרה הספציפי ולנוסח החוק המחייב היא באחריות המשרד.</div>
        </div>
      ) : (
        <div className="ck-card ck-empty"><div className="ck-title">הכר את הלקוח</div><div className="ck-meta">בחרו תיק מהרשימה כדי למלא או לעדכן את תיעוד הזיהוי.</div></div>
      )}
    </div>
  );
}

export function Kyc() {
  return (
    <CockpitFrame title="הכר את הלקוח" description="תיעוד זיהוי הלקוח, הערכת סיכון ושמירת רישום לפי חובות איסור הלבנת הון החלות על המשרד." path="/workspace/kyc">
      {({ member }) => (member ? <Panel member={member} /> : null)}
    </CockpitFrame>
  );
}

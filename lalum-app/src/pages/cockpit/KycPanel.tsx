import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmt } from "../../lib/cockpit/shared";
import { blankKyc, KYC_FIELD_LABEL, KYC_LABEL, kycMissing, needsPartner, pendingBusiness } from "../../lib/cockpit/kyc";
import type { KycRecord } from "../../lib/cockpit/kyc";

const COLS = "party_no, party_role, subject_kind, service_track, id_verified, id_method, registry_checked, signatory_verified, beneficial_owner_identified, source_of_funds, source_documented, pep, sanctions_screened, risk, status, completed_at, next_review_on";
const SAVE_ROLES = ["FIRM_PARTNER", "ATTORNEY", "COMPLIANCE_OFFICER"];

const Tri = ({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean | null) => void; label: string }) => (
  <label className="ck-field">{label}
    <select className="ck-select" value={value === null ? "" : value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "yes")}>
      <option value="">לא נבדק</option><option value="yes">כן</option><option value="no">לא</option>
    </select>
  </label>
);
const Pick = ({ value, onChange, label, options }: { value: string | null; onChange: (v: string | null) => void; label: string; options: Record<string, string> }) => (
  <label className="ck-field">{label}
    <select className="ck-select" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">בחרו</option>{Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  </label>
);

/** KYC checklist for the matter. Holds no identifying data: see lib/cockpit/kyc.ts. */
export function KycPanel({ matterId, role, onPending }: { matterId: string; role: string; onPending: (n: number) => void }) {
  const [records, setRecords] = useState<KycRecord[]>([]);
  const [partyNo, setPartyNo] = useState(1);
  const [edits, setEdits] = useState<Record<number, Partial<KycRecord>>>({});
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const canSave = SAVE_ROLES.includes(role);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("lalum_kyc_records").select(COLS).eq("matter_id", matterId).order("party_no");
      if (!live) return;
      const list = (data as KycRecord[] | null) ?? [];
      setRecords(list);
      onPending(pendingBusiness(list));
    })();
    return () => { live = false; };
  }, [matterId, tick, onPending]);

  const draft: KycRecord = { ...(records.find((r) => r.party_no === partyNo) ?? blankKyc(partyNo)), ...edits[partyNo] };
  const set = <K extends keyof KycRecord>(k: K, v: KycRecord[K]) => setEdits((e) => ({ ...e, [partyNo]: { ...e[partyNo], [k]: v } }));
  const missing = kycMissing(draft);
  const complete = draft.status === "COMPLETE";

  async function save(finish: boolean) {
    if (!supabase) return;
    setMsg("שומר...");
    const fields: Partial<KycRecord> = { ...draft };
    for (const k of ["id", "party_no", "status", "completed_at"] as const) delete fields[k];
    const { data, error } = await supabase.rpc("lalum_kyc_save", { p_matter: matterId, p_party_no: partyNo, p: fields, p_complete: finish });
    if (error) { setMsg("השמירה נכשלה. ייתכן שחסרה הרשאה או שפג תוקף ה-MFA."); return; }
    const r = data as { status: string; missing: string[]; needs_partner: boolean };
    setMsg(r.needs_partner ? "רמת סיכון גבוהה או נושא משרה ציבורית: את הסימון כהושלם מבצע שותף בלבד. הנתונים נשמרו כטיוטה."
      : finish && r.status !== "COMPLETE" ? `נשמר כטיוטה. חסר: ${r.missing.map((k) => KYC_FIELD_LABEL[k] ?? k).join(", ")}.` : r.status === "COMPLETE" ? "סומן כהושלם." : "נשמר כטיוטה.");
    setEdits((e) => { const n = { ...e }; delete n[partyNo]; return n; });
    setTick((n) => n + 1);
  }

  const statusOf = (n: number) => records.find((r) => r.party_no === n)?.status;
  const parties = Array.from(new Set([1, ...records.map((r) => r.party_no), partyNo])).sort((a, b) => a - b);

  return (
    <details>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>הכרת לקוח (KYC){records.length ? `: ${records.every((r) => r.status === "COMPLETE") ? "הושלם" : "טיוטה"}` : ""}</summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-warn">רשומת בקרה בלבד. אין להזין כאן שמות, מספרי זיהוי או טקסט חופשי: פרטי הזיהוי נשמרים בתיק המשרד. הרשימה משקפת נוהל פנימי, וחובות הדין החלות על התיק נקבעות על ידי עורך הדין האחראי.</div>
        <div className="ck-row">
          {parties.map((n) => <button key={n} className={`ck-btn${n === partyNo ? " primary" : ""}`} onClick={() => setPartyNo(n)}>צד {n}{statusOf(n) === "COMPLETE" ? " ✓" : ""}</button>)}
          {parties.length < 20 && <button className="ck-btn" onClick={() => setPartyNo(Math.max(...parties) + 1)}>הוספת צד</button>}
        </div>
        <div className="ck-grid2">
          <Pick label="תפקיד הצד" value={draft.party_role} onChange={(v) => set("party_role", v ?? "CLIENT")} options={KYC_LABEL.party_role} />
          <Pick label="סוג" value={draft.subject_kind} onChange={(v) => set("subject_kind", v ?? "INDIVIDUAL")} options={KYC_LABEL.subject_kind} />
          <Pick label="מסלול" value={draft.service_track} onChange={(v) => set("service_track", v ?? "REGULAR")} options={KYC_LABEL.service_track} />
          <Tri label={KYC_FIELD_LABEL.id_verified} value={draft.id_verified} onChange={(v) => set("id_verified", v)} />
          <Pick label={KYC_FIELD_LABEL.id_method} value={draft.id_method} onChange={(v) => set("id_method", v)} options={KYC_LABEL.id_method} />
          {draft.subject_kind === "COMPANY" && <>
            <Tri label={KYC_FIELD_LABEL.registry_checked} value={draft.registry_checked} onChange={(v) => set("registry_checked", v)} />
            <Tri label={KYC_FIELD_LABEL.signatory_verified} value={draft.signatory_verified} onChange={(v) => set("signatory_verified", v)} />
            <Tri label={KYC_FIELD_LABEL.beneficial_owner_identified} value={draft.beneficial_owner_identified} onChange={(v) => set("beneficial_owner_identified", v)} />
          </>}
          <Pick label={KYC_FIELD_LABEL.source_of_funds} value={draft.source_of_funds} onChange={(v) => set("source_of_funds", v)} options={KYC_LABEL.source_of_funds} />
          {draft.source_of_funds && draft.source_of_funds !== "NOT_APPLICABLE" && <Tri label={KYC_FIELD_LABEL.source_documented} value={draft.source_documented} onChange={(v) => set("source_documented", v)} />}
          <Pick label={KYC_FIELD_LABEL.pep} value={draft.pep} onChange={(v) => set("pep", v)} options={KYC_LABEL.pep} />
          <Tri label={KYC_FIELD_LABEL.sanctions_screened} value={draft.sanctions_screened} onChange={(v) => set("sanctions_screened", v)} />
          <Pick label={KYC_FIELD_LABEL.risk} value={draft.risk} onChange={(v) => set("risk", v)} options={KYC_LABEL.risk} />
          <label className="ck-field">מועד בדיקה חוזרת (אופציונלי)<input className="ck-input" type="date" value={draft.next_review_on ?? ""} onChange={(e) => set("next_review_on", e.target.value || null)} /></label>
        </div>
        {complete && <div className="ck-meta">הושלם: {fmt(draft.completed_at)}. שינוי כלשהו מחזיר את הרשומה לטיוטה ונרשם ביומן הביקורת.</div>}
        {needsPartner(draft) && <div className="ck-meta">רמת סיכון גבוהה או נושא משרה ציבורית: את הסימון כהושלם מבצע שותף בלבד.</div>}
        {!complete && missing.length > 0 && <div className="ck-meta">חסר להשלמה: {missing.map((k) => KYC_FIELD_LABEL[k]).join(", ")}.</div>}
        <div className="ck-row">
          <button className="ck-btn" disabled={!canSave} onClick={() => void save(false)}>שמירה כטיוטה</button>
          <button className="ck-btn primary" disabled={!canSave || missing.length > 0} onClick={() => void save(true)}>סימון כהושלם</button>
          {!canSave && <span className="ck-meta">עריכה: שותף, עורך דין וממונה ציות בלבד.</span>}
          <span className="ck-meta" aria-live="polite">{msg}</span>
        </div>
      </div>
    </details>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { PRACTICE } from "../../lib/cockpit/shared";
import type { Membership } from "../../lib/cockpit/shared";
import { CockpitFrame } from "./CockpitFrame";

// Firm wide "Know Your Client" status overview. This screen only reads, and it holds no
// identifying data: the KYC record is a control checklist of enumerations and yes/no answers
// (party role, service track, risk, decision status), consistent with the platform's PII shield.
// The identifying details themselves stay in the firm's own file. Editing a record, and the
// per party checklist, live inside each matter (the KYC panel in the matter vault), so every row
// here links back into the matter it belongs to.

interface Matter { id: string; title: string; practice_area: string }
interface Kyc {
  matter_id: string; party_no: number; party_role: string; subject_kind: string; service_track: string;
  pep: string | null; sanctions_screened: boolean | null; risk: string | null; status: string;
  next_review_on: string | null;
}

const PARTY_ROLE: Record<string, string> = { CLIENT: "לקוח", REPRESENTATIVE: "מיופה כוח או מורשה", BENEFICIAL_OWNER: "בעל שליטה" };
const SUBJECT_KIND: Record<string, string> = { INDIVIDUAL: "אדם פרטי", COMPANY: "תאגיד" };
const RISK: Record<string, [string, string]> = { LOW: ["green", "נמוכה"], MEDIUM: ["yellow", "בינונית"], HIGH: ["red", "גבוהה"] };
const PEP: Record<string, string> = { NO: "לא", YES: "כן", REVIEW: "דורש בירור" };

function Panel({ member }: { member: Membership }) {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [records, setRecords] = useState<Kyc[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const [m, k] = await Promise.all([
        supabase.from("lalum_cockpit_matters").select("id, title, practice_area").eq("firm_id", member.firm_id).order("created_at", { ascending: false }),
        supabase.from("lalum_kyc_records").select("matter_id, party_no, party_role, subject_kind, service_track, pep, sanctions_screened, risk, status, next_review_on").eq("firm_id", member.firm_id),
      ]);
      if (!live) return;
      setMatters((m.data as Matter[] | null) ?? []);
      setRecords((k.data as Kyc[] | null) ?? []);
      setLoaded(true);
    })();
    return () => { live = false; };
  }, [member.firm_id]);

  const byMatter = useMemo(() => {
    const map: Record<string, Kyc[]> = {};
    for (const r of records) (map[r.matter_id] ??= []).push(r);
    for (const id in map) map[id].sort((a, b) => a.party_no - b.party_no);
    return map;
  }, [records]);

  // A business service party whose record is not yet complete is the one thing worth surfacing:
  // it is where the identification duty applies and the checklist is still open.
  const pendingBusiness = useMemo(
    () => records.filter((r) => r.service_track === "BUSINESS_SERVICE" && r.status !== "COMPLETE").length,
    [records],
  );

  if (!loaded) return <div className="ck-meta">טוען...</div>;

  return (
    <div className="ck-stack">
      <div className="ck-card">
        <div className="ck-meta">
          מבט רוחבי על תיעוד הכרת הלקוח בכל תיקי המשרד. זו רשומת בקרה בלבד, ללא פרטים מזהים: פרטי הזיהוי עצמם נשמרים בתיק המשרד. מילוי ועדכון הצ׳קליסט לכל צד מתבצעים בתוך התיק.
        </div>
        {pendingBusiness > 0 && (
          <div className="ck-warn">
            {pendingBusiness === 1 ? "צד אחד במסלול שירות עסקי" : `${pendingBusiness} צדדים במסלול שירות עסקי`} שהכרת הלקוח שלהם טרם הושלמה. כדאי להשלים לפני מסירת מסמכים.
          </div>
        )}
      </div>

      {matters.map((mt) => {
        const rs = byMatter[mt.id] ?? [];
        const biz = rs.some((r) => r.service_track === "BUSINESS_SERVICE");
        return (
          <div key={mt.id} className="ck-card ck-stack">
            <div className="ck-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <Link className="ck-title" to={`/workspace/${mt.id}`}>{mt.title}</Link>
              <span className="ck-meta">{PRACTICE[mt.practice_area] ?? mt.practice_area}</span>
            </div>
            {rs.length === 0 ? (
              <div className="ck-row" style={{ gap: 8 }}>
                <span className="ck-chip">ללא תיעוד הכרת לקוח</span>
                {biz && <span className="ck-badge yellow">שירות עסקי</span>}
                <Link className="ck-meta" to={`/workspace/${mt.id}`}>פתיחת התיק למילוי</Link>
              </div>
            ) : (
              <div className="ck-stack" style={{ gap: 6 }}>
                {rs.map((r) => {
                  const risk = r.risk ? RISK[r.risk] : null;
                  const done = r.status === "COMPLETE";
                  return (
                    <div key={r.party_no} className="ck-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="ck-meta" style={{ minWidth: 48 }}>צד {r.party_no}</span>
                      <span className="ck-chip">{PARTY_ROLE[r.party_role] ?? r.party_role}</span>
                      <span className="ck-chip">{SUBJECT_KIND[r.subject_kind] ?? r.subject_kind}</span>
                      {r.service_track === "BUSINESS_SERVICE" && <span className="ck-badge yellow">שירות עסקי</span>}
                      {risk && <span className={`ck-badge ${risk[0]}`}>סיכון {risk[1]}</span>}
                      {r.pep && r.pep !== "NO" && <span className="ck-badge red">PEP: {PEP[r.pep]}</span>}
                      {r.sanctions_screened && <span className="ck-chip">נבדקו סנקציות</span>}
                      <span className={`ck-badge ${done ? "green" : "yellow"}`}>{done ? "הושלם" : "טיוטה"}</span>
                      {r.next_review_on && <span className="ck-meta">בדיקה חוזרת: {r.next_review_on}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {matters.length === 0 && <div className="ck-card"><div className="ck-meta">אין תיקים עדיין.</div></div>}

      <div className="ck-meta">
        תיעוד הכרת הלקוח משקף נוהל פנימי של המשרד. חובות הדין החלות על תיק מסוים נקבעות על ידי עורך הדין האחראי. אין באמור ייעוץ משפטי.
      </div>
    </div>
  );
}

export function Kyc() {
  return (
    <CockpitFrame title="הכר את הלקוח" description="מבט רוחבי על סטטוס תיעוד הכרת הלקוח בכל תיקי המשרד. רשומת בקרה בלבד, ללא פרטים מזהים." path="/workspace/kyc">
      {({ member }) => (member ? <Panel member={member} /> : null)}
    </CockpitFrame>
  );
}

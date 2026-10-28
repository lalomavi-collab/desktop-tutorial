import { useEffect, useState } from "react";
import { callPipeline, errorText } from "../../lib/cockpit/shared";

// Declared parties of an existing matter (4.3, T50). A matter used to get its client and adverse party only when it
// was opened, so the rule that stops an adverse party who is an active client elsewhere never had input. Here a
// partner, an admin or an attorney on the matter's team declares them. lalum-pipeline (version 28) checks every party
// against the firm's book first: on a direct conflict nothing is stored and the neutral sentence is shown, and the
// partner sees the check in the conflict review. Only blind indexes are stored, so the panel shows counts, never names,
// and the typed name is cleared after every send.

interface PartiesReply { ok?: boolean; code?: string; message?: string; conflict?: "GREEN" | "YELLOW"; added?: number; counts?: { CLIENT: number; ADVERSE: number } }

export function MatterParties({ matterId, canDeclare, onChange }: { matterId: string; canDeclare: boolean; onChange: () => void }) {
  const [counts, setCounts] = useState<PartiesReply["counts"] | null>(null);
  const [missing, setMissing] = useState(false);
  const [role, setRole] = useState<"CLIENT" | "ADVERSE">("ADVERSE");
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [companyReg, setCompanyReg] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!canDeclare) return;
    let live = true;
    void (async () => {
      const r = (await callPipeline("/api/v1/matters/parties", { matter_id: matterId, parties: [] })) as PartiesReply;
      if (!live) return;
      if (r.ok && r.counts) setCounts(r.counts);
      else if (r.code === "NOT_FOUND") setMissing(true); // the service is older than version 28, or no right to the matter
    })();
    return () => { live = false; };
  }, [matterId, canDeclare]);

  async function declare() {
    const party = { role, name: name.trim() || undefined, idNumber: idNumber.trim() || undefined, companyReg: companyReg.trim() || undefined };
    if (!party.name && !party.idNumber && !party.companyReg) { setMsg({ ok: false, text: "יש להזין שם, ת.ז. או ח.פ." }); return; }
    setBusy(true);
    const r = (await callPipeline("/api/v1/matters/parties", { matter_id: matterId, parties: [party] })) as PartiesReply;
    setBusy(false);
    setName(""); setIdNumber(""); setCompanyReg("");
    if (!r.ok) { setMsg({ ok: false, text: r.code === "BAD_REQUEST" ? "הפרטים לא תקינים: שם של שתי אותיות לפחות, ומספר של 5 עד 9 ספרות." : errorText(r) }); onChange(); return; }
    if (r.counts) setCounts(r.counts);
    setMsg({ ok: true, text: r.added === 0 ? "הצד הזה כבר רשום בתיק." : r.conflict === "YELLOW" ? "נשמר. נמצאה התאמה אפשרית לתיק אחר, והתיק סומן לבדיקת ניגוד עניינים." : "נשמר. לא נמצא ניגוד עניינים." });
    onChange();
  }

  if (!canDeclare || missing) return null;

  return (
    <details>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>
        צדדים לתיק{counts ? ` (לקוח ${counts.CLIENT}, צד שכנגד ${counts.ADVERSE})` : ""}
      </summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-meta">כל צד נבדק מול כל תיקי המשרד לפני שהוא נשמר. השם לא נשמר: נשמר רק אינדקס עיוור לבדיקת ניגוד עניינים, ולכן כאן מוצגים מספרים ולא שמות.</div>
        <div className="ck-row" style={{ gap: 6, flexWrap: "wrap" }}>
          <select className="ck-select" style={{ width: "auto" }} value={role} onChange={(e) => setRole(e.target.value as "CLIENT" | "ADVERSE")} aria-label="תפקיד הצד">
            <option value="ADVERSE">צד שכנגד</option>
            <option value="CLIENT">לקוח</option>
          </select>
          <input className="ck-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם מלא או שם חברה" aria-label="שם" autoComplete="off" />
          <input className="ck-input" style={{ maxWidth: 140 }} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="ת.ז. (רשות)" aria-label="תעודת זהות" inputMode="numeric" autoComplete="off" />
          <input className="ck-input" style={{ maxWidth: 140 }} value={companyReg} onChange={(e) => setCompanyReg(e.target.value)} placeholder="ח.פ. (רשות)" aria-label="מספר חברה" inputMode="numeric" autoComplete="off" />
          <button className="ck-btn primary" disabled={busy} onClick={() => void declare()}>{busy ? "בודק…" : "בדיקה ושמירה"}</button>
        </div>
        {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} role="status">{msg.text}</div>}
      </div>
    </details>
  );
}

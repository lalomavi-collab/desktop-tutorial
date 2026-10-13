import type { Party } from "../../lib/cockpit/crmDemo";

const ROLE_HE: Record<Party["role"], string> = { CLIENT: "לקוח", OPPOSING: "צד שכנגד", OPPOSING_COUNSEL: "בא כוח הצד שכנגד", JUDGE: "שופט", EXPERT: "מומחה", WITNESS: "עד" };

export function PartiesDirectory({ parties }: { parties: Party[] }) {
  return (
    <section className="ck-card" aria-label="בעלי דין">
      <div className="ck-card-head"><h3 className="ck-title">בעלי דין ומעורבים</h3></div>
      <div className="ck-table-wrap">
        <table className="ck-table">
          <thead><tr><th>תפקיד</th><th>שם</th><th>טלפון</th><th>דוא״ל</th></tr></thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p.id}>
                <td><span className={`ck-badge ${p.role === "CLIENT" ? "green" : p.role === "JUDGE" ? "yellow" : ""}`}>{ROLE_HE[p.role]}</span></td>
                <td>{p.name}</td>
                <td dir="ltr" style={{ textAlign: "end" }}>{p.phone ?? ""}</td>
                <td dir="ltr" style={{ textAlign: "end" }}>{p.email ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ck-meta">בבסיס הנתונים הקיים הצדדים נשמרים כאינדקס חסוי בלבד (בדיקת ניגוד עניינים). שמות ופרטי קשר דורשים טבלה חדשה והחלטה.</div>
    </section>
  );
}

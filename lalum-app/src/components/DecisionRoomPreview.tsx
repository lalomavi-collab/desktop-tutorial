import { useState } from "react";
import { useLang } from "../context/LangContext";

// Interactive preview of the Engine: three decision nodes on one pane, and the
// risk matrix and governance telemetry beside it follow the node you pick.
//
// This is an illustration of how the practice works, not a readout. Every value
// is qualitative (a gate, a level, a document), none is a measured score or a
// client figure, and the frame says so in its own bar. The framework codes are
// labels for the three layers of the Engine; the copy does not expand them.
// Legal AI only, per the home page rule: the nodes are the three stations a
// matter passes through, not the two practice areas.

type Tone = "ok" | "warn" | "high";
type Node = {
  code: string;
  title: string;
  tele: [string, string][];
  /** Marker position on the 3 x 3 matrix: likelihood row, impact column (0 to 2). */
  at: [number, number];
  exposures: { label: string; tone: Tone }[];
};
type Copy = {
  bar: string;
  barRight: string;
  nodes: string;
  matrix: string;
  tele: string;
  likelihood: string;
  impact: string;
  levels: Record<Tone, string>;
  note: string;
  list: Node[];
};

const HE: Copy = {
  bar: "[LALUM-ENGINE // PREVIEW]",
  barRight: "הדגמה",
  nodes: "צמתי החלטה",
  matrix: "מטריצת סיכון",
  tele: "טלמטריית משילות",
  likelihood: "סבירות",
  impact: "השפעה",
  levels: { ok: "נמוך", warn: "בינוני", high: "גבוה" },
  note: "הדגמה להמחשה בלבד. הערכים איכותיים ואינם נתוני לקוח או ציון מדוד.",
  list: [
    {
      code: "DOM",
      title: "קבלת החלטות וסף אישור",
      tele: [["שער", "אישור עורך דין"], ["בסיס", "נימוק מתועד"], ["בדיקת הטיה", "עמדה נגדית חובה"], ["תוצר", "תזכיר החלטה"]],
      at: [1, 1],
      exposures: [{ label: "חריגה מהסף", tone: "warn" }, { label: "הטיית עיגון", tone: "warn" }, { label: "חוסר תיעוד", tone: "ok" }],
    },
    {
      code: "RECIR",
      title: "סקירת חוזים ובקרת חריגים",
      tele: [["מקור", "פלייבוק מאושר"], ["חריגים", "מסומנים לפי סעיף"], ["סמכות", "מטריצת אישורים"], ["תוצר", "דוח חריגים"]],
      at: [2, 1],
      exposures: [{ label: "סטייה מהפלייבוק", tone: "high" }, { label: "סעיף אחריות", tone: "warn" }, { label: "לוחות זמנים", tone: "ok" }],
    },
    {
      code: "SRME",
      title: "ניטור סיכון ומשילות בינה מלאכותית",
      tele: [["מסלול ביקורת", "כל פלט מתועד"], ["פיקוח אנושי", "בשער לפני יציאה"], ["רגולציה", "מופה לפי משטר"], ["תוצר", "יומן החלטות"]],
      at: [0, 2],
      exposures: [{ label: "פלט ללא סקירה", tone: "high" }, { label: "גבולות אחריות", tone: "warn" }, { label: "ציות לתקנה", tone: "ok" }],
    },
  ],
};

const EN: Copy = {
  bar: "[LALUM-ENGINE // PREVIEW]",
  barRight: "ILLUSTRATIVE",
  nodes: "Decision nodes",
  matrix: "Risk matrix",
  tele: "Governance telemetry",
  likelihood: "Likelihood",
  impact: "Impact",
  levels: { ok: "Low", warn: "Medium", high: "High" },
  note: "Illustration only. Values are qualitative, not client data or a measured score.",
  list: [
    {
      code: "DOM",
      title: "Decisions and the approval threshold",
      tele: [["Gate", "Lawyer approval"], ["Basis", "Documented reasoning"], ["Bias check", "Counter-position required"], ["Output", "Decision memo"]],
      at: [1, 1],
      exposures: [{ label: "Threshold exceeded", tone: "warn" }, { label: "Anchoring bias", tone: "warn" }, { label: "Missing record", tone: "ok" }],
    },
    {
      code: "RECIR",
      title: "Contract review and exception control",
      tele: [["Source", "Approved playbook"], ["Exceptions", "Flagged by clause"], ["Authority", "Approval matrix"], ["Output", "Exception report"]],
      at: [2, 1],
      exposures: [{ label: "Playbook deviation", tone: "high" }, { label: "Liability clause", tone: "warn" }, { label: "Timelines", tone: "ok" }],
    },
    {
      code: "SRME",
      title: "AI risk monitoring and governance",
      tele: [["Audit trail", "Every output logged"], ["Human oversight", "Gated before release"], ["Regulation", "Mapped by regime"], ["Output", "Decision log"]],
      at: [0, 2],
      exposures: [{ label: "Output without review", tone: "high" }, { label: "Liability boundary", tone: "warn" }, { label: "Rule compliance", tone: "ok" }],
    },
  ],
};

function tone(l: number, i: number): Tone {
  const s = l + i;
  return s <= 1 ? "ok" : s <= 2 ? "warn" : "high";
}

export function DecisionRoomPreview() {
  const { lang } = useLang();
  const c = lang === "he" ? HE : EN;
  const [active, setActive] = useState(0);
  const node = c.list[active];
  // Row 0 is the top row, so the highest likelihood sits at the top.
  const rows = [2, 1, 0];

  return (
    <div className="drp">
      <div className="drp-bar" dir="ltr">
        <span className="mono">{c.bar}</span>
        <span className="mono">{c.barRight}</span>
      </div>
      <div className="drp-grid">
        <div className="drp-pane">
          <p className="drp-label">{c.nodes}</p>
          <div role="group" aria-label={c.nodes}>
            {c.list.map((n, i) => (
              <button
                key={n.code}
                type="button"
                className="drp-node"
                aria-pressed={i === active}
                onClick={() => setActive(i)}
              >
                <span dir="ltr" className="mono drp-node-code">[{String(i + 1).padStart(2, "0")}] {n.code}</span>
                <span className="drp-node-title">{n.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="drp-pane" aria-live="polite">
          <p className="drp-label">{c.matrix}</p>
          <div className="drp-matrix" role="img" aria-label={`${c.matrix}: ${node.code}`}>
            {rows.map((l) =>
              [0, 1, 2].map((i) => (
                <span
                  key={`${l}-${i}`}
                  className="drp-cell"
                  data-tone={tone(l, i)}
                  data-on={node.at[0] === l && node.at[1] === i ? "true" : "false"}
                />
              )),
            )}
          </div>
          <div className="drp-axes">
            <span>{c.likelihood} &uarr;</span>
            <span>{c.impact} &rarr;</span>
          </div>
          <ul className="drp-exp">
            {node.exposures.map((e) => (
              <li key={e.label}>
                <span>{e.label}</span>
                <span className="mono drp-lvl" data-tone={e.tone}>
                  <i aria-hidden="true"><b /><b /><b /></i>
                  {c.levels[e.tone]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="drp-pane" aria-live="polite">
          <p className="drp-label">{c.tele}</p>
          <dl className="drp-tele">
            {node.tele.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="drp-note">{c.note}</p>
    </div>
  );
}

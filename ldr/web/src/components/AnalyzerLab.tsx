import { useState } from "react";
import { supabase, type Profile } from "../lib/supabase";

// Clause presets (curated) — instant analysis without an API call.
const PRESETS: Record<string, { label: string; title: string; score: number; redFlags: string[]; academicContext: string; recommendedText: string }> = {
  delivery: {
    label: "עיכוב במסירת הדירה (גרייס)",
    title: "עיכוב במסירת הדירה (מנגנון גרייס קבלני)",
    score: 25,
    redFlags: [
      "תקופת גרייס מעל 60 ימים מנוגדת להוראה הקוגנטית של חוק המכר (דירות).",
      "פטור גורף מפיצויים בגין \"כוח עליון\" ללא הגדרה מצומצמת אינו תקף.",
      "מחסור בפועלים/עיכובי ועדה הם סיכון יזמי רגיל ואינם מצדיקים שלילת פיצוי.",
    ],
    academicContext: "פטור מפיצויים מעבר ל-60 יום הוא בטל מעיקרו, והקונה זכאי לפיצוי מלא רטרואקטיבית מהיום הראשון לאיחור.",
    recommendedText: "החברה רשאית לעכב את המסירה עד 60 ימים קלנדריים. כל איחור מעבר לכך יזכה את הקונה, מהיום הראשון, בפיצוי חודשי בגובה דמי שכירות ראויים של דירה דומה באזור × 1.5, כהוראת חוק המכר.",
  },
  guarantee: {
    label: "ערבויות ובטוחות חוק המכר",
    title: "ערבויות ובטוחות (סנכרון תשלומים)",
    score: 15,
    redFlags: [
      "איסור מוחלט לקבל מעל 7% משווי הדירה ללא בטוחה (ערבות חוק מכר / פוליסה) מראש.",
      "תשלום לפי \"קצב התקדמות\" ללא ערבות מיידית הוא סיכון מוחלט לכספי הרוכש.",
    ],
    academicContext: "הבטוחה היא עוגן השרידות הכלכלית של העסקה ומגנה מפני קריסת היזם. חובה לסנכרן כל תשלום לבטוחה.",
    recommendedText: "כל תשלום יופקד לחשבון הליווי הסגור, וכנגד כל תשלום (מהשקל הראשון) תימסר לקונה ערבות בנקאית אוטונומית לפי חוק המכר תוך 14 ימי עסקים.",
  },
  arbitration: {
    label: "בוררות וסופיות הדיון",
    title: "סעיף בוררות ללא זכות ערעור",
    score: 40,
    redFlags: [
      "שלילת זכות ערעור על פסק בורר בהסכמי מקרקעין צרכניים מנשלת הגנות בסיסיות.",
      "בוררות ללא מנגנון ערעור (ס׳ 21א לחוק הבוררות) חוסמת ביקורת שיפוטית.",
    ],
    academicContext: "מנגנוני ADR חייבים לשמר את עקרונות הצדק הטבעי וזכות הגישה לערכאות.",
    recommendedText: "הצדדים רשאים לפנות לבוררות בהסכמה, ובלבד שתישמר זכות ערעור על פסק הבורר בפני בורר ערעור או בית המשפט המחוזי כחוק.",
  },
  equality: {
    label: "תמורות בלתי שוויוניות",
    title: "תמורות בלתי שוויוניות בהתחדשות עירונית",
    score: 30,
    redFlags: [
      "הפרת עקרון השוויון בין הדיירים היא עילת סירוב מוצדקת ומזמינה תביעות.",
      "פתח ל\"הסכמים סודיים\" המחבל באמון הקהילתי הדרוש להצלחת הפרויקט.",
    ],
    academicContext: "שוויון יחסי ותנאים שקופים הם הכלים החזקים ביותר למניעת סרבנות ולשמירת ההון החברתי.",
    recommendedText: "היזם מתחייב לשוויון מלא ושקיפות בין כלל בעלי הדירות. כל הטבה שתינתן לדייר תוחל באופן שוויוני ויחסי על כל היתר.",
  },
};

type Result = { title?: string; score: number; redFlags: string[]; academicContext: string; recommendedText: string };

export default function AnalyzerLab({ profile, notify }: { profile: Profile; notify: (m: string) => void }) {
  const [tab, setTab] = useState<"analyzer" | "calc">("analyzer");
  return (
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 920 }}>
      <div className="section-header">
        <h2>🔬 מעבדת AI משפטית</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${tab === "analyzer" ? "btn-gold" : "btn-ghost"}`} onClick={() => setTab("analyzer")}>ניתוח סעיפים</button>
          <button className={`btn ${tab === "calc" ? "btn-gold" : "btn-ghost"}`} onClick={() => setTab("calc")}>מחשבון תמ״א 38</button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 8 }}>ניתוח אסטרטגי, אקדמי ומעשי של סעיפי חוזה בעסקאות נדל״ן והתחדשות עירונית.</p>
      <div style={{ marginBottom: 18, padding: "9px 13px", borderRadius: 10, background: "rgba(192,57,43,0.08)", border: "1px solid rgba(224,122,111,0.35)", fontSize: 11.5, lineHeight: 1.6, color: "var(--cream-dim)" }}>
        ⚠️ הניתוח מבוסס מודלי AI ואינו ייעוץ משפטי. השימוש באחריות אישית; יש לאמת מול עו״ד מורשה. אין אחריות מצד LAWdin.
      </div>
      {tab === "analyzer" ? <ClauseAnalyzer notify={notify} /> : <TamaCalculator />}
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score < 40 ? "#b3534a" : score < 70 ? "#C99A3F" : "#10b981";
  return (
    <div style={{ textAlign: "center", background: "var(--obsidian-3)", border: "1px solid var(--line)", borderRadius: 14, padding: "10px 16px" }}>
      <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
      <div className="muted" style={{ fontSize: 9, fontWeight: 700, marginTop: 4, letterSpacing: 1 }}>ציון הגנה</div>
    </div>
  );
}

function ResultView({ r }: { r: Result }) {
  return (
    <div className="card pad" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
        <ScoreGauge score={r.score} />
        <div style={{ textAlign: "start", flex: 1 }}>
          <span className="tag" style={{ color: r.score < 30 ? "var(--burgundy-soft)" : "var(--gold)" }}>{r.score < 30 ? "רמת סיכון גבוהה" : r.score < 60 ? "רמת סיכון בינונית" : "סיכון נמוך"}</span>
          {r.title && <h4 style={{ margin: "6px 0 0" }}>{r.title}</h4>}
        </div>
      </div>
      <h5 style={{ color: "var(--burgundy-soft)", margin: "14px 0 6px" }}>🚩 דגלים אדומים</h5>
      <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.7, fontSize: 14 }}>
        {r.redFlags.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
      {r.academicContext && (
        <div style={{ marginTop: 14, background: "rgba(217,119,87,0.08)", border: "1px solid rgba(217,119,87,0.25)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>תובנה אקדמית · ד״ר אברהם ללום</div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>{r.academicContext}</p>
        </div>
      )}
      <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={() => { navigator.clipboard?.writeText(r.recommendedText); }}>📋 העתק נוסח</button>
          <h5 style={{ margin: 0, color: "var(--ok)" }}>✓ נוסח חלופי מומלץ</h5>
        </div>
        <p style={{ background: "rgba(79,157,105,0.1)", border: "1px solid rgba(79,157,105,0.3)", borderRadius: 12, padding: 12, margin: 0, fontSize: 14, lineHeight: 1.7 }}>{r.recommendedText}</p>
      </div>
    </div>
  );
}

function ClauseAnalyzer({ notify }: { notify: (m: string) => void }) {
  const [result, setResult] = useState<Result | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function runCustom() {
    if (!text.trim()) { notify("הדביקו נוסח סעיף"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("contract-analyze", { body: { clause: text.trim() } });
      if (error) throw error;
      setResult({ title: "ניתוח סעיף מותאם", ...(data as any) });
    } catch { notify("שגיאת ניתוח — נסו שוב"); }
    setBusy(false);
  }

  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <div className="card pad">
        <label>בחרו סעיף נפוץ לבדיקה מיידית</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {Object.entries(PRESETS).map(([k, p]) => (
            <button key={k} className="btn btn-ghost" style={{ justifyContent: "flex-start", textAlign: "start" }}
              onClick={() => setResult({ title: p.title, score: p.score, redFlags: p.redFlags, academicContext: p.academicContext, recommendedText: p.recommendedText })}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="divider" style={{ margin: "14px 0" }} />
        <label>או הדביקו סעיף מותאם אישית (ניתוח AI)</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="הדביקו כאן את נוסח הסעיף..." style={{ minHeight: 120, marginTop: 6 }} />
        <button className="btn btn-gold" style={{ width: "100%", marginTop: 10 }} disabled={busy} onClick={runCustom}>
          {busy ? <span className="spinner" /> : "✨ נתח סעיף עם AI"}
        </button>
      </div>
      <div>
        {result ? <ResultView r={result} /> : (
          <div className="card pad center" style={{ color: "var(--cream-dim)", minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
            בחרו סעיף או הדביקו נוסח כדי לקבל ניתוח מיידי.
          </div>
        )}
      </div>
    </div>
  );
}

function TamaCalculator() {
  const [year, setYear] = useState("1975");
  const [city, setCity] = useState("תל אביב");
  const [floors, setFloors] = useState("4");
  const [apts, setApts] = useState("16");
  const [res, setRes] = useState<any>(null);

  function calc(e: React.FormEvent) {
    e.preventDefault();
    const y = +year, f = +floors, a = +apts;
    const eligible = y < 1980;
    let elig = "אינו זכאי לתמ״א 38 (נבנה לאחר 1980)", rating = "נמוכה", rec = "מסלול הריסה ובנייה עצמי", expand = "ללא תוספות אוטומטיות", score = 35;
    if (eligible) {
      if (f >= 3 && a >= 12) { elig = "זכאי מלא לתמ״א 38/2 (הריסה ובנייה) ופינוי-בינוי"; rating = "גבוהה מאוד"; rec = "פינוי-בינוי יזמי, הגדלת זכויות עד פי 3.2"; expand = "ממ״ד, מרפסת שמש, מעלית, חנייה תת-קרקעית"; score = 92; }
      else { elig = "זכאי לתמ״א 38/1 (חיזוק ותוספת)"; rating = "בינונית-גבוהה"; rec = "חיזוק, שיפוץ ותוספת קומות"; expand = "ממ״ד, מרפסת, מעלית, שיפוץ מעטפת"; score = 74; }
    }
    if (["תל אביב", "הרצליה", "ירושלים"].includes(city)) score = Math.min(100, score + 5);
    setRes({ elig, rating, rec, expand, score, consents: eligible ? "67% מהדיירים (לפי התיקון)" : "80% (מתווה מיוחד)" });
  }

  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <form className="card pad" onSubmit={calc}>
        <div className="grid cols-2">
          <div><label>שנת בנייה</label><input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></div>
          <div><label>עיר</label>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option>תל אביב</option><option>ירושלים</option><option>חיפה</option><option>באר שבע</option><option>הרצליה</option>
            </select>
          </div>
          <div><label>מספר קומות</label><input type="number" value={floors} onChange={(e) => setFloors(e.target.value)} /></div>
          <div><label>מספר דירות</label><input type="number" value={apts} onChange={(e) => setApts(e.target.value)} /></div>
        </div>
        <button className="btn btn-gold" style={{ width: "100%", marginTop: 14 }}>חשב כדאיות</button>
      </form>
      <div>
        {res ? (
          <div className="card pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <ScoreGauge score={res.score} />
              <span className="tag tag-gold">כדאיות: {res.rating}</span>
            </div>
            <p style={{ fontWeight: 700, color: "var(--gold)", marginTop: 12 }}>{res.elig}</p>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div><b style={{ color: "var(--cream)" }}>רוב נדרש:</b> {res.consents}</div>
              <div><b style={{ color: "var(--cream)" }}>מסלול מומלץ:</b> {res.rec}</div>
              <div><b style={{ color: "var(--cream)" }}>תוספות לבעלים:</b> {res.expand}</div>
            </div>
          </div>
        ) : (
          <div className="card pad center" style={{ color: "var(--cream-dim)", minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            הזינו נתונים וקבלו דירוג כדאיות ופוטנציאל הרחבה.
          </div>
        )}
      </div>
    </div>
  );
}

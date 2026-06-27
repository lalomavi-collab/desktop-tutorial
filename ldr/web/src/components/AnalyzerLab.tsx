import { useState, useRef, useEffect } from "react";
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
  const [tab, setTab] = useState<"ai" | "analyzer" | "calc" | "flags">("ai");
  return (
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 920 }}>
      <div className="section-header">
        <h2>שאלות תשובות כללי</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={`btn ${tab === "ai" ? "btn-gold" : "btn-ghost"}`} onClick={() => setTab("ai")}>✨ ללום AI</button>
          <button className={`btn ${tab === "analyzer" ? "btn-gold" : "btn-ghost"}`} onClick={() => setTab("analyzer")}>ניתוח סעיפים</button>
          <button className={`btn ${tab === "calc" ? "btn-gold" : "btn-ghost"}`} onClick={() => setTab("calc")}>מחשבון תמ״א 38</button>
          <button className={`btn ${tab === "flags" ? "btn-gold" : "btn-ghost"}`} onClick={() => setTab("flags")}>🚩 דגלים אדומים</button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 8 }}>מענה משפטי כללי בכל תחומי הדין: שאלות ותשובות, ניתוח סעיפים, ודגלים אדומים רגולטוריים.</p>
      <div style={{ marginBottom: 18, padding: "9px 13px", borderRadius: 10, background: "rgba(192,57,43,0.08)", border: "1px solid rgba(224,122,111,0.35)", fontSize: 11.5, lineHeight: 1.6, color: "var(--cream-dim)" }}>
        ⚠️ הניתוח מבוסס מודלי AI ואינו ייעוץ משפטי. השימוש באחריות אישית; יש לאמת מול עו״ד מורשה. אין אחריות מצד LAWdin.
      </div>
      {tab === "ai" ? <LalumAdvisor />
        : tab === "analyzer" ? <ClauseAnalyzer notify={notify} />
        : tab === "calc" ? <TamaCalculator />
        : <RedFlags />}
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

// ── ללום AI: legal advisor chat (urban renewal) ────────────────────────────
// Client-side, deterministic keyword engine (no external API): instant, on-brand
// answers with embedded regulatory red flags, plus suggested quick queries.
type ChatMsg = { sender: "user" | "ai"; text: string; time: string; redFlags?: string[] };

const SUGGESTED = [
  { label: "רוב דרוש לפינוי-בינוי", query: "מהו הרוב המשפטי הדרוש לפרויקט פינוי-בינוי לפי החוק החדש?" },
  { label: "דייר סרבן בתמ״א 38", query: "האם ניתן לחייב דייר סרבן במסלול תמ״א 38/2 ומה עושים?" },
  { label: "ערבויות ובטחונות חובה", query: "אילו ערבויות ובטחונות חובה לקבל מהיזם לפני מסירת המפתח?" },
  { label: "שילוב AI בניתוח חוזים", query: "איך משלבים כללי AI בניתוח חוזי התחדשות עירונית?" },
];

function answerFor(q: string): { text: string; redFlags?: string[] } {
  const s = q.trim();
  if (/(רוב|שליש|פינוי.?בינוי|67|80)/.test(s)) {
    return {
      text: "ברוב מסלולי פינוי-בינוי הרוב הדרוש לקידום העסקה הוא שני שלישים (67%) מבעלי הדירות, לאחר הפחתת הרוב בתיקון החקיקה. דייר שמסרב ללא טעם סביר חשוף לתביעת נזיקין מצד יתר הבעלים.",
      redFlags: [
        "ספירת הרוב חייבת להיעשות לפי בעלי הזכויות הרשומים, לא לפי מספר הנפשות.",
        "החתמת רוב מבלי לצרף בטוחות ליווי וערבויות חוק המכר מסכנת את כלל הדיירים.",
      ],
    };
  }
  if (/(סרבן|סרבנות|תמ.?א|38)/.test(s)) {
    return {
      text: "במסלול תמ״א 38/2 (הריסה ובנייה) ניתן לפעול מול דייר סרבן באמצעות פנייה למפקח על המקרקעין ותביעה אזרחית. סירוב בלתי סביר מקים אחריות בנזיקין כלפי שאר הבעלים. מומלץ לתעד בכתב כל הצעה והסבר שניתנו לסרבן.",
      redFlags: [
        "סירוב מטעמי גיל או מצב רפואי מחייב הצעת חלופה ראויה (דיור חלופי או שווי כספי).",
        "אין לחתום על ההסכם בלי מנגנון שמאי מכריע מוסכם לקביעת התמורות.",
      ],
    };
  }
  if (/(ערבו|בטוח|בטחונ|חוק המכר|מפתח|תשלום)/.test(s)) {
    return {
      text: "לפני מסירת המפתח חובה לוודא: ערבות חוק המכר (או פוליסת ביטוח חלופית) כנגד כל תשלום מהשקל הראשון, חשבון ליווי סגור בפיקוח בנקאי, וערבות בדק לתיקון ליקויים לאחר המסירה. אין להעביר מעל 7% משווי הדירה ללא בטוחה מתאימה.",
      redFlags: [
        "תשלום לפי קצב התקדמות הבנייה בלי ערבות מיידית הוא סיכון מוחלט לכספי הרוכש.",
        "היעדר ערבות בדק לאחר מסירה מותיר את הדייר חשוף לעלויות תיקון הליקויים.",
      ],
    };
  }
  if (/(ai|בינה|ארכיטקט|חוז|סעיף|ניתוח)/i.test(s)) {
    return {
      text: "מנוע ה-AI מפרק כל חוזה לסעיפים, מדרג כל סעיף בציון הגנה (0 עד 100), ומסמן סטיות מהוראות קוגנטיות בחוק המכר ובדיני ההתחדשות העירונית. לכל דגל אדום מוצע נוסח חלופי מאוזן. השתמשו בלשונית ניתוח סעיפים לבדיקת נוסח ספציפי.",
    };
  }
  return {
    text: "אפשר לשאול אותי על רוב דרוש, דייר סרבן, ערבויות ובטחונות, היטלי השבחה, תמורות בהתחדשות עירונית או ניתוח סעיף חוזי. בחרו שאלה מהירה למטה או נסחו שאלה חופשית.",
  };
}

function nowTime() {
  try { return new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function LalumAdvisor() {
  const [history, setHistory] = useState<ChatMsg[]>([
    { sender: "ai", text: "שלום, אני ללום AI, עוזר משפטי כללי בכל תחומי הדין. כיצד אוכל לסייע?", time: nowTime() },
  ]);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [history, typing]);

  function send(q: string) {
    const text = q.trim();
    if (!text || typing) return;
    setQuery("");
    setHistory((h) => [...h, { sender: "user", text, time: nowTime() }]);
    setTyping(true);
    setTimeout(() => {
      const a = answerFor(text);
      setHistory((h) => [...h, { sender: "ai", text: a.text, redFlags: a.redFlags, time: nowTime() }]);
      setTyping(false);
    }, 650);
  }

  return (
    <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 440 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
        <span className="muted" style={{ fontSize: 10, fontFamily: "monospace" }}>[ LALUM_LEGAL_AI_v1 ]</span>
        <h4 style={{ margin: 0 }}>✨ עוזר משפטי כללי</h4>
      </div>

      <div ref={logRef} style={{ flex: 1, maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingInlineEnd: 4 }}>
        {history.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.sender === "user" ? "flex-start" : "flex-end" }}>
            <div style={{
              maxWidth: "90%", padding: "10px 12px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.7,
              background: m.sender === "user" ? "var(--obsidian-3)" : "rgba(51,204,255,0.08)",
              border: `1px solid ${m.sender === "user" ? "var(--line)" : "rgba(51,204,255,0.25)"}`,
              borderTopLeftRadius: m.sender === "user" ? 4 : 14, borderTopRightRadius: m.sender === "user" ? 14 : 4,
            }}>
              {m.text}
              {m.redFlags && (
                <div style={{ marginTop: 10, background: "rgba(192,57,43,0.1)", borderInlineStart: "3px solid var(--burgundy-soft)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontWeight: 800, color: "var(--burgundy-soft)", fontSize: 11.5, marginBottom: 4 }}>🚩 דגלים אדומים משפטיים ורגולטוריים</div>
                  <ul style={{ margin: 0, paddingInlineStart: 16, fontSize: 12, lineHeight: 1.6 }}>
                    {m.redFlags.map((f, idx) => <li key={idx}>{f}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <span className="muted" style={{ fontSize: 9, marginTop: 2 }}>{m.time}</span>
          </div>
        ))}
        {typing && (
          <div style={{ alignSelf: "flex-end", background: "rgba(51,204,255,0.08)", border: "1px solid rgba(51,204,255,0.25)", borderRadius: 14, padding: "10px 14px" }}>
            <span className="spinner" style={{ width: 14, height: 14 }} />
          </div>
        )}
      </div>

      <div>
        <p className="muted" style={{ fontSize: 11, fontWeight: 700, margin: "0 0 6px" }}>שאלות מומלצות לבדיקה מהירה:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SUGGESTED.map((s, i) => (
            <button key={i} className="btn btn-ghost" style={{ fontSize: 11.5, padding: "5px 11px" }} onClick={() => send(s.query)}>{s.label}</button>
          ))}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(query); }} style={{ display: "flex", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="שאלו אותי (למשל: ערבויות, דייר סרבן, רוב...)" style={{ flex: 1 }} />
        <button type="submit" className="btn btn-gold" style={{ padding: "0 18px" }} disabled={typing}>שלח</button>
      </form>
    </div>
  );
}

// ── דגלים אדומים: regulatory alerts ─────────────────────────────────────────
const ALERTS: { title: string; desc: string; status: string; tone: "crit" | "warn" | "info" }[] = [
  {
    title: "תיקון החקיקה והרוב הדרוש להתחדשות עירונית",
    desc: "הפחתת הרוב הדרוש לשני שלישים (67%) מבעלי הדירות חלה כעת על תביעות הדייר הסרבן. השינוי מצמצם את כוחם של סרבנים סחטניים ומאיץ הליכים.",
    status: "קריטי", tone: "crit",
  },
  {
    title: "חתימת קשישים (חוק פינוי ובינוי)",
    desc: "על יזם המחתים דייר בן 75 ומעלה חלה חובה מוגברת להציע לפחות חלופה ראויה אחת (דירה קטנה יותר בתוספת כסף, מעבר לדיור מוגן, או שווי כספי מלא מראש). החתמה ללא הצעה כזו עלולה להוביל לבטלות ההסכם.",
    status: "דגש חובה", tone: "warn",
  },
  {
    title: "היטלי השבחה ותקנות המיסוי",
    desc: "בעקבות פסיקות מיסוי אחרונות קיימת אי-בהירות לגבי היטלי השבחה בגין זכויות תמ״א. מומלץ לעגן בהסכם סעיף שיפוי מלא המטיל את היטלי ההשבחה והמיסוי על היזם בלבד.",
    status: "אזהרת מיסוי", tone: "warn",
  },
  {
    title: "פירוק שיתוף במקרקעין",
    desc: "במגרשים משותפים ובסכסוכי יורשים על עתודות קרקע, בתי המשפט נוטים להעדיף מכר ופירוק שיתוף על פני כפיית המשך שותפות בלתי רצויה.",
    status: "פסיקה", tone: "info",
  },
];

function RedFlags() {
  const toneStyle = (tone: string) => tone === "crit"
    ? { color: "var(--burgundy-soft)", bg: "rgba(192,57,43,0.1)", border: "rgba(224,122,111,0.4)" }
    : tone === "warn"
    ? { color: "#C99A3F", bg: "rgba(201,154,63,0.1)", border: "rgba(201,154,63,0.4)" }
    : { color: "var(--cream-dim)", bg: "var(--obsidian-3)", border: "var(--line)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {ALERTS.map((a, i) => {
        const s = toneStyle(a.tone);
        return (
          <div key={i} className="card pad" style={{ borderColor: s.border, background: s.bg }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className="tag" style={{ fontSize: 10, fontFamily: "monospace" }}>{a.status}</span>
              <h5 style={{ margin: 0, color: s.color }}>{a.title}</h5>
            </div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: "8px 0 0" }}>{a.desc}</p>
          </div>
        );
      })}
      <div style={{ background: "var(--obsidian-3)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "var(--cream-dim)", lineHeight: 1.6 }}>
        ההתראות נועדו ליידע בלבד ואינן ייעוץ משפטי. יש לאמת מול המקור הרשמי ועם עו״ד מורשה.
      </div>
    </div>
  );
}

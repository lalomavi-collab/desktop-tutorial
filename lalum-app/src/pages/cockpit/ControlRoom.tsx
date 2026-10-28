// /workspace/control: the control room wall. Eleven tiles across the four areas (finance, matters, content and the plumbing), each
// with its status, its number when the number can be trusted, a chart when there is data to draw, and an explanation that opens under
// it: what it says today, what completes it, where the data comes from, how often it refreshes and which screen has the detail.
// The same tiles, folded to one line each, are the strip on the left of every cockpit screen (ControlStrip).
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CockpitFrame } from "./CockpitFrame";
import { MarketChart } from "../../components/cockpit/MarketChart";
import { Dot, Spark } from "../../components/cockpit/ControlStrip";
import { buildTiles, DOMAIN_LABEL, fmtDay, fmtTime, money, STATUS_LABEL, summarize, WALL_ORDER } from "../../lib/cockpit/controlRoomCore";
import type { Domain, FinanceFacts, IssueCheck, Tile } from "../../lib/cockpit/controlRoomCore";
import { useControlRoom } from "../../lib/cockpit/controlRoom";
import { loadFinanceDash } from "../../lib/cockpit/dashboardFinance";
import { checkProvider, providerCheckText } from "../../lib/cockpit/financeApi";
import "../../styles/cockpit-control.css";

const OK = "var(--chart-ok)", BAD = "var(--chart-bad)", CAT = "var(--chart-cat-2)";
const nf = (v: number) => v.toLocaleString("he-IL");

function TileChart({ t }: { t: Tile }) {
  if (t.chart?.kind === "dual") {
    return <MarketChart title={`${t.chart.aName} ו${t.chart.bName} לפי חודש`} labels={t.chart.labels} height={210} format={money}
      series={[{ key: "a", label: t.chart.aName, color: OK, values: t.chart.a, kind: "area" }, { key: "b", label: t.chart.bName, color: BAD, values: t.chart.b, kind: "dashed" }]} />;
  }
  if (t.chart?.kind === "volume") {
    return <MarketChart title={`${t.chart.aName} ב-Google לפי יום, ומתחת ${t.chart.bName}`} labels={t.chart.labels} height={220}
      series={[{ key: "a", label: t.chart.aName, color: OK, values: t.chart.a, kind: "area" }]} bars={{ label: t.chart.bName, values: t.chart.b, color: CAT }} />;
  }
  if (t.counts) {
    const total = t.counts.risk.reduce((s, r) => s + r.value, 0);
    return (
      <div className="ck-ctile-counts">
        <dl>{t.counts.items.map(([v, l]) => <div key={l}><dt>{l}</dt><dd><bdi>{v}</bdi></dd></div>)}</dl>
        {total > 0 && (
          <div className="ck-ctile-risk" role="img" aria-label={t.counts.risk.map((r) => `${r.label}: ${r.value}`).join(", ")}>
            <div className="ck-ctile-bar">{t.counts.risk.map((r) => <i key={r.label} className={r.tone} style={{ width: `${(r.value / total) * 100}%` }} />)}</div>
            <div className="ck-ctile-legend">{t.counts.risk.map((r) => <span key={r.label}><Dot status={r.tone} />{r.label} <bdi>{nf(r.value)}</bdi></span>)}</div>
          </div>
        )}
      </div>
    );
  }
  if (t.spark) return <div className="ck-ctile-spark"><Spark values={t.spark} width={220} height={44} /></div>;
  return null;
}

function TileCard({ t, open, onCheck, checking, result }: { t: Tile; open: boolean; onCheck: (() => void) | null; checking: boolean; result: IssueCheck | null }) {
  return (
    <article id={`tile-${t.id}`} className={`ck-ctile st-${t.status}${t.big ? " big" : ""}`} aria-labelledby={`tile-${t.id}-name`}>
      <header className="ck-ctile-head">
        <span className="ck-ctile-name" id={`tile-${t.id}-name`}>{t.name}</span>
        <span className="ck-ctile-code" dir="ltr">{t.code}</span>
        <span className={`ck-ctile-st ${t.status}`}><Dot status={t.status} />{STATUS_LABEL[t.status]}</span>
      </header>
      {t.value && <div className="ck-ctile-val"><bdi>{t.value}</bdi></div>}
      {t.sub && <div className="ck-ctile-sub">{t.sub}</div>}
      <TileChart t={t} />
      {onCheck && (
        <div className="ck-ctile-act">
          <button type="button" className="ck-btn" disabled={checking} onClick={onCheck} title="קריאה בלבד: שואל את מערכת ההנפקה אם היא מקבלת את המפתח שבשרת. לא מפיק ולא שומר דבר.">{checking ? "בודק..." : "בדיקת חיבור"}</button>
          {/* The answer sits beside the button, not only in the folded explanation, so a click visibly does something. */}
          <span className={`ck-ctile-check${result && !checking ? (result.ok ? " ok" : " bad") : ""}`} role="status">{result && !checking ? `${result.text} (${fmtTime(result.at)})` : ""}</span>
        </div>
      )}
      <details className="ck-ctile-ex" open={open || undefined}>
        <summary>הסבר</summary>
        <dl>
          <div><dt>מצב היום</dt><dd>{t.today}</dd></div>
          <div><dt>מה משלים</dt><dd>{t.fix}</dd></div>
          <div><dt>מקור</dt><dd>{t.src}</dd></div>
          <div><dt>רענון</dt><dd>{t.fresh}</dd></div>
          <div><dt>איפה רואים פירוט</dt><dd>{t.where ? <Link to={t.where.to}>{t.where.label}</Link> : "אין מסך פירוט; יומן ב-Supabase"}</dd></div>
        </dl>
      </details>
    </article>
  );
}

function ControlWall({ firmId }: { firmId: string | null }) {
  const d = useControlRoom(true);
  const [finance, setFinance] = useState<FinanceFacts | null>(null);
  const [check, setCheck] = useState<IssueCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [dom, setDom] = useState<Domain | "all">("all");
  const { hash } = useLocation();
  const focus = hash.startsWith("#tile-") ? hash.slice(6) : null;
  useEffect(() => {
    if (!firmId) return;
    let live = true;
    void loadFinanceDash(firmId).then((f) => { if (live && f) setFinance({ months: f.months, revenue: f.revenue, expenses: f.expenses }); });
    return () => { live = false; };
  }, [firmId]);
  const tiles = useMemo(() => buildTiles({ snapshot: d.snapshot, history: d.history, web: d.web, finance, issueCheck: check, now: d.now }), [d, finance, check]);
  useEffect(() => {
    if (!focus || !d.loaded) return;
    document.getElementById(`tile-${focus}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focus, d.loaded]);
  async function runCheck() {
    if (!firmId) return;
    setChecking(true);
    const r = providerCheckText(await checkProvider(firmId));
    setCheck({ ok: r.ok, text: r.text, at: new Date().toISOString() });
    setChecking(false);
  }
  if (!d.loaded) return <div className="ck-meta">טוען...</div>;
  const s = summarize(tiles);
  const shown = WALL_ORDER.map((id) => tiles.find((t) => t.id === id)!).filter((t) => dom === "all" || t.domain === dom);
  return (
    <div className="ck-stack ck-cwall">
      <div className="ck-cwall-bar">
        <div className="ck-cwall-sum" aria-label="סיכום">
          <span><Dot status="ok" /><b><bdi>{s.ok}</bdi></b> תקינים</span>
          <span><Dot status="watch" /><b><bdi>{s.watch}</bdi></b> לתשומת לב או מיושנים</span>
          <span><Dot status="bad" /><b><bdi>{s.bad}</bdi></b> חסומים</span>
          <span><Dot status="none" /><b><bdi>{s.none}</bdi></b> לא מחוברים</span>
        </div>
        <div className="ck-cwall-filter" role="group" aria-label="סינון לפי תחום">
          {(["all", "fin", "mat", "web", "ops"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={dom === k} onClick={() => setDom(k)}>{k === "all" ? "הכל" : DOMAIN_LABEL[k]}</button>
          ))}
        </div>
      </div>
      <div className="ck-meta">
        {d.snapshot ? <>תמונת מצב מ-<bdi>{fmtDay(d.snapshot.takenAt)} {fmtTime(d.snapshot.takenAt)}</bdi>, נאספת כל 15 דקות. ירוק רק כשהמקור טרי ונקי; מקור שנעצר מסומן כך, והמספר הישן שלו לא מוצג כאילו הוא של היום.</> : "תמונת המצב עוד לא נאספה."}
      </div>
      <div className="ck-cgrid">
        {shown.map((t) => <TileCard key={t.id} t={t} open={focus === t.id} checking={checking} result={t.id === "issue" ? check : null} onCheck={t.id === "issue" && firmId ? () => void runCheck() : null} />)}
      </div>
    </div>
  );
}

export function ControlRoomPage() {
  return (
    <CockpitFrame title="חדר בקרה" description="תמונה אחת של כל התחומים: כספים, תיקים, תוכן ושיווק, תשתית ואבטחה. לכל אריח מצב, מספר כשאפשר לסמוך עליו, והסבר שנפתח." path="/workspace/control">
      {({ platformAdmin, member }) => platformAdmin ? <ControlWall firmId={member?.firm_id ?? null} /> : <div className="ck-card ck-empty">חדר הבקרה זמין למנהל המערכת עם אימות דו-שלבי בלבד.</div>}
    </CockpitFrame>
  );
}

// The control room strip: a column on the left of every cockpit screen that lists only what needs action (owner, 31.10.2026: blocked,
// stale, for attention), problems first, and folds down to a column of status dots. Fine and not connected areas stay on the wall and
// are counted in one line. A row opens to what the tile says today and what completes it; the full wall is one click away. On a phone
// it is a single chip that opens the wall. Shown to the platform admin only (the data answers nobody else), loaded after the page itself.
import { useState } from "react";
import { Link } from "react-router-dom";
import { actionTiles, buildTiles, fmtTime, STATUS_LABEL, summarize } from "../../lib/cockpit/controlRoomCore";
import type { Status, Tile } from "../../lib/cockpit/controlRoomCore";
import { useControlRoom } from "../../lib/cockpit/controlRoom";
import { monotonePath } from "../../lib/cockpit/marketChart";
import type { Pt } from "../../lib/cockpit/marketChart";
import "../../styles/cockpit-control.css";

/** A small trend line. Decorative: the row's text carries the number. */
export function Spark({ values, width = 64, height = 22 }: { values: number[]; width?: number; height?: number }) {
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1, pad = 3;
  const pts: Pt[] = values.map((v, i) => [(i / (values.length - 1)) * width, pad + (1 - (v - lo) / span) * (height - pad * 2)]);
  const last = pts[pts.length - 1];
  return (
    <svg className="ck-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <path d={monotonePath(pts)} fill="none" stroke="var(--chart-ok)" strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill="var(--chart-ok)" />
    </svg>
  );
}

export function Dot({ status }: { status: Status }) {
  return <span className={`ck-cdot ${status}`} aria-hidden="true" />;
}

function useStripOpen(): [boolean, () => void] {
  // The strip mounts on the client only (lazy, after the page), so it can read storage while it initialises.
  const [open, setOpen] = useState(() => { try { return localStorage.getItem("ck-strip-open") !== "0"; } catch { return true; } });
  const flip = () => setOpen((o) => { try { localStorage.setItem("ck-strip-open", o ? "0" : "1"); } catch { /* storage blocked */ } return !o; });
  return [open, flip];
}

function Row({ t, open, onOpenStrip }: { t: Tile; open: boolean; onOpenStrip: () => void }) {
  const [ex, setEx] = useState(false);
  const label = `${t.name}: ${STATUS_LABEL[t.status]}. ${t.strip}`;
  if (!open) {
    return <li><button type="button" className="ck-cstrip-dot" title={label} aria-label={label} onClick={() => { onOpenStrip(); setEx(true); }}><Dot status={t.status} /></button></li>;
  }
  return (
    <li className="ck-cstrip-row">
      <button type="button" className="ck-cstrip-btn" aria-expanded={ex} onClick={() => setEx((x) => !x)}>
        <Dot status={t.status} />
        <span className="ck-cstrip-main">
          <span className="ck-cstrip-name"><span className="ck-cstrip-nm">{t.name}</span><span className="ck-cstrip-st">{STATUS_LABEL[t.status]}</span></span>
          <span className="ck-cstrip-val">{t.strip}</span>
          {t.spark && <Spark values={t.spark} width={150} height={16} />}
        </span>
      </button>
      {ex && (
        <div className="ck-cstrip-ex">
          <p>{t.today}</p>
          <p><b>מה משלים:</b> {t.fix}</p>
          <Link to={`/workspace/control#tile-${t.id}`}>לאריח בחדר הבקרה</Link>
        </div>
      )}
    </li>
  );
}

export function ControlStrip({ onWall = false }: { onWall?: boolean }) {
  const d = useControlRoom(true);
  const [open, flip] = useStripOpen();
  if (!d.loaded || !d.snapshot) return null;
  const tiles = buildTiles({ snapshot: d.snapshot, history: d.history, web: d.web, now: d.now });
  const s = summarize(tiles);
  const act = actionTiles(tiles);
  const rest = tiles.length - act.length;
  const worst: Status = s.bad ? "bad" : s.watch ? "watch" : s.none ? "none" : "ok";
  return (
    <>
      <aside className={`ck-cstrip${open ? "" : " closed"}`} aria-label="חדר בקרה">
        <div className="ck-cstrip-head">
          <button type="button" className="ck-cstrip-toggle" aria-expanded={open} onClick={flip} title={open ? "לקפל את רצועת הבקרה" : "לפתוח את רצועת הבקרה"} aria-label={open ? "לקפל את רצועת הבקרה" : "לפתוח את רצועת הבקרה"}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d={open ? "M10 3l-5 5 5 5" : "M6 3l5 5-5 5"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {open && <Link to="/workspace/control" className="ck-cstrip-title">חדר בקרה</Link>}
        </div>
        {open && <div className="ck-cstrip-sum">{act.length ? <>דורש פעולה: {[s.bad && <><bdi>{s.bad}</bdi> {s.bad === 1 ? "חסום" : "חסומים"}</>, s.watch && <><bdi>{s.watch}</bdi> לתשומת לב</>].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && ", "}{x}</span>)}</> : "אין כרגע דבר שדורש פעולה."}</div>}
        {act.length > 0 ? (
          <ul className="ck-cstrip-list">
            {act.map((t) => <Row key={t.id} t={t} open={open} onOpenStrip={() => { if (!open) flip(); }} />)}
          </ul>
        ) : (
          <div className="ck-cstrip-calm" title="אין כרגע דבר שדורש פעולה"><Dot status="ok" />{open && <span>הכול תקין</span>}</div>
        )}
        {open && rest > 0 && <div className="ck-cstrip-rest">שאר האזורים בחדר הבקרה: {[s.ok && <><bdi>{s.ok}</bdi> {s.ok === 1 ? "תקין" : "תקינים"}</>, s.none && <><bdi>{s.none}</bdi> {s.none === 1 ? "לא מחובר" : "לא מחוברים"}</>].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && ", "}{x}</span>)}.</div>}
        {open && <div className="ck-cstrip-foot">תמונת מצב <bdi>{fmtTime(d.snapshot.takenAt)}</bdi> · <Link to="/workspace/control">לחדר הבקרה</Link></div>}
      </aside>
      {!onWall && <Link to="/workspace/control" className="ck-cstrip-chip"><Dot status={worst} />חדר בקרה: <bdi>{s.bad}</bdi> חסומים, <bdi>{s.watch}</bdi> לתשומת לב</Link>}
    </>
  );
}

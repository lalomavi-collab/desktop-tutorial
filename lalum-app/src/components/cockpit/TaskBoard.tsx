import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { fmt } from "../../lib/cockpit/shared";
import type { MatterLabel, Person, Task } from "../../lib/cockpit/work";
import { board, bucketOf, COLUMN_LABEL, COLUMNS, counts, COUNTERS, dueWords, parseBoardView, select, SHOW_LABEL, type BoardView, type Show, type Who } from "../../lib/cockpit/taskBoard";
import { useClientNames } from "./ClientNames";
import { CheckArt } from "./CockpitIllustrations";
import "../../styles/cockpit-task-board.css";

// The tasks board (ClientWork.tsx, /workspace/tasks): counters for what needs doing now, each one a filter, and the open
// tasks in four columns by when they are due, or as a list. Rules live in lib/cockpit/taskBoard.ts.

const VIEW_KEY = "lalum_ck_tasks_view";
const read = (): string | null => { try { return localStorage.getItem(VIEW_KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* private window: the choice lasts this visit */ } };

const TONE: Partial<Record<Show, string>> = { overdue: "bad", today: "warn", doneWeek: "ok" };

interface Props {
  tasks: Task[];
  titles: Map<string, MatterLabel>;
  people: Person[];
  onClose: (t: Task, status: "DONE" | "CANCELLED") => void;
}

export function TaskBoard({ tasks, titles, people, onClose }: Props) {
  const cn = useClientNames();
  const [me, setMe] = useState<string | null>(null);
  const [show, setShow] = useState<Show>("open");
  const [who, setWho] = useState<Who>("all");
  const [view, setViewState] = useState<BoardView>(() => parseBoardView(read()));
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { void supabase?.auth.getSession().then((r) => setMe(r.data.session?.user.id ?? null)); }, []);
  // The buckets move with the clock: refresh once a minute so "today" turns into "overdue" without a reload.
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(id); }, []);
  const setView = (v: BoardView) => { setViewState(v); write(v); };

  const c = useMemo(() => counts(tasks, who, me, now), [tasks, who, me, now]);
  const cols = useMemo(() => board(tasks, who, me, now), [tasks, who, me, now]);
  const rows = useMemo(() => select(tasks, show, who, me, now), [tasks, show, who, me, now]);
  const nameOf = (id: string) => people.find((p) => p.user_id === id)?.display_name ?? "חבר צוות";
  const matter = (t: Task) => <Link to={`/workspace?matter=${t.matter_id}`}>{cn.name(titles.get(t.matter_id))}</Link>;
  const late = (t: Task) => bucketOf(t, now) === "overdue";
  const actions = (t: Task) => t.status === "OPEN" && (
    <div className="ck-tb-actions">
      <button className="ck-btn sm primary" onClick={() => onClose(t, "DONE")} aria-label={`סימון "${t.title}" כהושלמה`}>הושלמה</button>
      <button className="ck-btn sm quiet" onClick={() => onClose(t, "CANCELLED")} aria-label={`ביטול "${t.title}"`}>ביטול</button>
    </div>
  );
  const boardShown = show === "open" && view === "board";

  return (
    <div className="ck-tb">
      <div className="ck-tb-counters" role="group" aria-label="סינון לפי מצב המשימה">
        {COUNTERS.map((s) => (
          <button key={s} type="button" className={`ck-tb-counter ${TONE[s] ?? ""}`} aria-pressed={show === s} onClick={() => setShow(show === s ? "open" : s)}>
            <b>{c[s]}</b><span>{SHOW_LABEL[s]}</span>
          </button>
        ))}
      </div>

      <div className="ck-tb-bar">
        <label className="ck-tb-field"><span>הצגה</span>
          <select className="ck-select" value={show} onChange={(e) => setShow(e.target.value as Show)}>
            {(["open", "overdue", "today", "week", "nodue", "doneWeek", "closed"] as Show[]).map((s) => <option key={s} value={s}>{SHOW_LABEL[s]} ({c[s]})</option>)}
          </select>
        </label>
        <label className="ck-tb-field"><span>אחראי</span>
          <select className="ck-select" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">כל הצוות</option>
            {me && <option value="me">המשימות שלי</option>}
            {people.filter((p) => p.user_id !== me).map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}
          </select>
        </label>
        <div className="ck-tb-view" role="group" aria-label="תצוגת המשימות">
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}>לוח</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>רשימה</button>
        </div>
      </div>

      {boardShown ? (
        <div className="ck-tb-board">
          {COLUMNS.map((col) => (
            <section key={col} className={`ck-tb-col ${col}`} aria-label={`${COLUMN_LABEL[col]}: ${cols[col].length} משימות`}>
              <header className="ck-tb-colhead"><span>{COLUMN_LABEL[col]}</span><b>{cols[col].length}</b></header>
              {cols[col].length === 0 ? <div className="ck-tb-none">אין כאן משימות.</div> : (
                <ul>
                  {cols[col].map((t) => (
                    <li key={t.id} className={`ck-tb-card${late(t) ? " late" : ""}`}>
                      <div className="ck-tb-title">{t.title}</div>
                      <div className="ck-tb-meta">{matter(t)}<span>{nameOf(t.assignee)}</span></div>
                      <div className={`ck-tb-due${late(t) ? " late" : ""}`} title={t.due_at ? fmt(t.due_at) : undefined}>{dueWords(t.due_at, now)}</div>
                      {actions(t)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="ck-card ck-empty"><CheckArt size={104} /><div className="ck-meta">אין משימות במצב "{SHOW_LABEL[show]}".</div>{show !== "open" && <button type="button" className="ck-btn" onClick={() => setShow("open")}>כל הפתוחות</button>}</div>
      ) : (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>משימה</th><th>תיק</th><th>אחראי</th><th>מועד יעד</th><th>מצב</th><th><span className="sr-only">פעולות</span></th></tr></thead><tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td style={{ whiteSpace: "normal", maxWidth: 320 }}>{t.title}</td>
              <td>{matter(t)}</td>
              <td>{nameOf(t.assignee)}</td>
              <td title={t.due_at ? fmt(t.due_at) : undefined}>{dueWords(t.due_at, now)}</td>
              <td>{t.status === "DONE" ? <span className="ck-badge green">הושלמה {fmt(t.closed_at)}</span> : t.status === "CANCELLED" ? <span className="ck-badge yellow">בוטלה</span> : late(t) ? <span className="ck-badge red">באיחור</span> : <span className="ck-badge yellow">פתוחה</span>}</td>
              <td>{actions(t)}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
}

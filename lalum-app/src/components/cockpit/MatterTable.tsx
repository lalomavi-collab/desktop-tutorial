import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { CONFLICT, fmt, MATTER_STATUS, PRACTICE, RESPONSE } from "../../lib/cockpit/shared";
import { setAll, toggle } from "../../lib/cockpit/bulk";
import { useClientNames } from "./ClientNames";
import { Icon } from "../Icon";
import { EmptyArt } from "./CockpitArt";
import {
  activeFilters, agoText, applyQuery, DEFAULT_QUERY, DUE_KIND, dueState, dueText, ilToday, isFiltered, lastActivity, needsAttention, parseSort, parseView,
  SORT_KEYS, SORT_LABEL, sortWithDefault, STATUS_FILTERS, toggleSort, type MatterExtra, type SortKey, type StatusFilter, type TableMatter, type TableQuery, type ViewMode,
} from "../../lib/cockpit/matterTable";
import { useMatterExtras } from "../../lib/cockpit/matterTableData";
import "../../styles/cockpit-matters-table.css";

// The matters list (Workspace.tsx): search, sort, filters and a list or cards view over the rows the screen already read.
// Rules live in lib/cockpit/matterTable.ts. The view and the sort are remembered per browser; the search text never is.

const VIEW_KEY = "lalum_ck_matters_view";
const SORT_KEY = "lalum_ck_matters_sort";
const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window: the choice lasts this visit */ } };

const STATUS_LABEL: Record<StatusFilter, string> = { open: "פתוחים", all: "כל התיקים", INTAKE_PENDING: MATTER_STATUS.INTAKE_PENDING, ACTIVE_REVIEW: MATTER_STATUS.ACTIVE_REVIEW, APPROVED_BY_PARTNER: MATTER_STATUS.APPROVED_BY_PARTNER, ARCHIVED: MATTER_STATUS.ARCHIVED };

function riskBadge(r: string | null): ReactNode {
  return r === "HIGH_RISK" ? <span className="ck-badge red dot">סיכון גבוה</span> : r === "CAUTION" ? <span className="ck-badge yellow dot">זהירות</span> : r === "NOT_ASSESSED" ? <span className="ck-badge">לא נבדק</span> : <span className="ck-badge green dot">תקין</span>;
}

interface Props {
  rows: TableMatter[];
  isPartner: boolean;
  sel: Set<string>;
  setSel: Dispatch<SetStateAction<Set<string>>>;
  onTrash: (m: TableMatter) => void;
}

export function MatterTable({ rows, isPartner, sel, setSel, onTrash }: Props) {
  const cn = useClientNames();
  const { extras, me, ready } = useMatterExtras(true);
  const [q, setQ] = useState<TableQuery>(() => ({ ...DEFAULT_QUERY, ...parseSort(read(SORT_KEY)) }));
  const [view, setViewState] = useState<ViewMode>(() => parseView(read(VIEW_KEY)));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const today = ilToday();
  const ctx = useMemo(() => ({ me, label: (m: TableMatter) => cn.name(m), match: (m: TableMatter, s: string) => cn.match(m, s), extras, today }), [me, cn, extras, today]);
  const shown = useMemo(() => applyQuery(rows, q, ctx), [rows, q, ctx]);
  const attention = useMemo(() => applyQuery(rows, { ...q, attention: true }, ctx).length, [rows, q, ctx]);
  const active = activeFilters(q);
  const practices = useMemo(() => Object.keys(PRACTICE).filter((p) => rows.some((r) => r.practice_area === p)), [rows]);

  const set = (patch: Partial<TableQuery>) => setQ((p) => {
    const n = { ...p, ...patch };
    if (patch.sort || patch.dir) write(SORT_KEY, `${n.sort}:${n.dir}`);
    return n;
  });
  const setView = (v: ViewMode) => { setViewState(v); write(VIEW_KEY, v); };
  const sortBy = (k: SortKey) => set(toggleSort(q, k));
  const reset = () => setQ((p) => ({ ...DEFAULT_QUERY, sort: p.sort, dir: p.dir }));

  const hiddenByDefault = rows.length - shown.length;
  const countLine = isFiltered(q) ? `מוצגים ${shown.length} מתוך ${rows.length} תיקים` : `${shown.length} תיקים פתוחים${hiddenByDefault > 0 ? `, ועוד ${hiddenByDefault} בארכיון` : ""}`;
  const e = (m: TableMatter): MatterExtra | undefined => extras.get(m.matter_id);
  const pending = <span className="ck-meta" aria-label="טוען">...</span>;
  const owner = (m: TableMatter) => (!ready ? pending : e(m)?.owner ?? <span className="ck-meta">לא שויך</span>);
  const due = (m: TableMatter, withKind = true) => {
    if (!ready) return pending;
    const x = e(m);
    if (!x?.next_due) return <span className="ck-meta">אין מועד</span>;
    const st = dueState(x.next_due, today);
    const cls = st === "overdue" ? "ck-badge red" : st === "today" ? "ck-badge yellow" : st === "week" ? "ck-mt-soon" : "";
    return <span className="ck-mt-due"><span className={cls} title={fmt(`${x.next_due}T12:00:00Z`)}>{dueText(x.next_due, today)}</span>{withKind && x.next_kind && <small className="ck-meta">{DUE_KIND[x.next_kind]}</small>}</span>;
  };
  const updated = (m: TableMatter) => { const t = lastActivity(m, e(m)); return <span title={fmt(t)}>{agoText(t)}</span>; };
  const conflict = (m: TableMatter) => { const [t, l] = CONFLICT[m.conflict_status] ?? ["yellow", m.conflict_status]; return <span className={`ck-badge ${t}`}>{l}</span>; };
  const sub = (m: TableMatter) => [cn.revealed && m.matter_code ? m.matter_code : null, PRACTICE[m.practice_area] ?? m.practice_area].filter(Boolean).join(" · ");
  const head = (k: SortKey, label: string) => {
    const on = q.sort === k;
    return (
      <th aria-sort={on ? (q.dir === "asc" ? "ascending" : "descending") : undefined}>
        <button type="button" className={`ck-mt-sort${on ? " on" : ""}`} onClick={() => sortBy(k)}>
          {label}<span className="ck-mt-arrow" aria-hidden="true">{on ? (q.dir === "asc" ? "▲" : "▼") : ""}</span>
        </button>
      </th>
    );
  };
  const trashBtn = (m: TableMatter, cls = "ck-btn sm quiet") => <button className={cls} aria-label={`העברת ${cn.name(m)} לסל המיחזור`} onClick={() => onTrash(m)}>התיק לסל</button>;
  const pick = (m: TableMatter, label?: string) => <input type="checkbox" aria-label={label ?? `סימון ${cn.name(m)}`} checked={sel.has(m.matter_id)} onChange={() => setSel((s0) => toggle(s0, m.matter_id))} />;

  return (
    <div className="ck-mt">
      <div className="ck-mt-bar" role="search" aria-label="חיפוש וסינון תיקים">
        <div className="ck-mt-row">
          <label className="ck-mt-search">
            <Icon name="search" size={18} className="ck-mt-search-ic" />
            <span className="sr-only">חיפוש תיק</span>
            <input className="ck-input" type="search" value={q.q} onChange={(ev) => set({ q: ev.target.value })} autoComplete="off" spellCheck={false}
              placeholder={cn.revealed ? "חיפוש לפי מספר או שם התיק" : "חיפוש לפי מספר תיק"} />
          </label>
          <button type="button" className="ck-mt-filterbtn" aria-expanded={filtersOpen} aria-controls="ck-mt-filters" onClick={() => setFiltersOpen((o) => !o)}>
            סינון ומיון{active > 0 && <b className="ck-mt-n on">{active}</b>}
          </button>
          <div className="ck-mt-view" role="group" aria-label="תצוגת התיקים">
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="תצוגת רשימה" title="רשימה">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 4.5h12M3 9h12M3 13.5h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" /></svg><span aria-hidden="true">רשימה</span>
            </button>
            <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")} aria-label="תצוגת כרטיסים" title="כרטיסים">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1.5" /><rect x="10" y="2.5" width="5.5" height="5.5" rx="1.5" /><rect x="2.5" y="10" width="5.5" height="5.5" rx="1.5" /><rect x="10" y="10" width="5.5" height="5.5" rx="1.5" /></svg><span aria-hidden="true">כרטיסים</span>
            </button>
          </div>
        </div>
        <div id="ck-mt-filters" className={`ck-mt-row ck-mt-filters${filtersOpen ? " open" : ""}`}>
          <label className="ck-mt-field"><span>סטטוס</span>
            <select className="ck-select" value={q.status} onChange={(ev) => set({ status: ev.target.value as StatusFilter })}>
              {STATUS_FILTERS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          {practices.length > 1 && (
            <label className="ck-mt-field"><span>תחום</span>
              <select className="ck-select" value={q.practice} onChange={(ev) => set({ practice: ev.target.value })}>
                <option value="all">כל התחומים</option>
                {practices.map((p) => <option key={p} value={p}>{PRACTICE[p]}</option>)}
              </select>
            </label>
          )}
          <label className="ck-mt-field"><span>מיון</span>
            <select className="ck-select" value={q.sort} onChange={(ev) => set(sortWithDefault(ev.target.value as SortKey))}>
              {SORT_KEYS.map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
            </select>
          </label>
          <button type="button" className="ck-mt-dir" onClick={() => set({ dir: q.dir === "asc" ? "desc" : "asc" })}
            aria-label={q.dir === "asc" ? "סדר עולה. לחיצה להפוך את הסדר" : "סדר יורד. לחיצה להפוך את הסדר"} title={q.dir === "asc" ? "סדר עולה" : "סדר יורד"}>
            <span aria-hidden="true">{q.dir === "asc" ? "▲" : "▼"}</span>
          </button>
          <div className="ck-mt-chips">
            {me && <button type="button" className="ck-mt-chip" aria-pressed={q.mine} onClick={() => set({ mine: !q.mine })}>רק התיקים שלי</button>}
            <button type="button" className="ck-mt-chip" aria-pressed={q.attention} onClick={() => set({ attention: !q.attention })}>
              דורש טיפול{attention > 0 && <b className="ck-mt-n">{attention}</b>}
            </button>
          </div>
        </div>
      </div>

      <div className="ck-mt-count" role="status" aria-live="polite">
        {countLine}
        {isFiltered(q) && <button type="button" className="ck-mt-reset" onClick={reset}>ניקוי הסינון</button>}
      </div>

      {shown.length === 0 ? (
        <div className="ck-card ck-empty"><EmptyArt /><div className="ck-meta">אין תיקים שמתאימים לחיפוש ולסינון.</div><button type="button" className="ck-btn" onClick={reset}>ניקוי הסינון</button></div>
      ) : view === "cards" ? (
        <ul className="ck-mt-cards" aria-label="התיקים">
          {shown.map((m) => {
            const flag = needsAttention(m, e(m), today);
            return (
              <li key={m.matter_id} className={`ck-mt-card${m.sla_breached ? " breach" : ""}`}>
                <div className="ck-mt-card-top">
                  <Link className="ck-mt-card-title" to={`/workspace?matter=${m.matter_id}`}>{cn.name(m)}</Link>
                  {flag && <span className="ck-badge red dot">דורש טיפול</span>}
                </div>
                <div className="ck-meta">{sub(m)}</div>
                <div className="ck-mt-card-badges"><span className="ck-chip">{MATTER_STATUS[m.matter_status] ?? m.matter_status}</span>{conflict(m)}{riskBadge(m.risk_level)}</div>
                <dl className="ck-mt-card-dl">
                  <dt>אחראי</dt><dd>{owner(m)}</dd>
                  <dt>המועד הקרוב</dt><dd>{due(m)}</dd>
                  <dt>עודכן</dt><dd>{updated(m)}</dd>
                </dl>
                <div className="ck-mt-card-foot">
                  {isPartner && <label className="ck-mt-card-pick">{pick(m)}<span>סימון</span></label>}
                  <Link className="ck-btn primary sm" to={`/workspace?matter=${m.matter_id}`}>פתיחת התיק</Link>
                  {isPartner && trashBtn(m)}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <div className="ck-mlist" role="list" aria-label="רשימת התיקים">
            {shown.map((m) => (
              <details key={m.matter_id} role="listitem" className={`ck-mrow${m.sla_breached ? " breach" : ""}`}>
                <summary><span className="ck-mrow-main"><span className="ck-mrow-title">{cn.name(m)}</span><span className="ck-mrow-sub">{conflict(m)}<span className="ck-meta">{MATTER_STATUS[m.matter_status]}</span>{ready && e(m)?.next_due && due(m, false)}</span></span></summary>
                <div className="ck-mrow-body">
                  <dl><dt>אחראי</dt><dd>{owner(m)}</dd><dt>המועד הקרוב</dt><dd>{due(m)}</dd><dt>עודכן</dt><dd>{updated(m)}</dd><dt>תחום</dt><dd>{PRACTICE[m.practice_area]}</dd><dt>סיכון</dt><dd>{riskBadge(m.risk_level)}</dd><dt>תגובת שותף</dt><dd>{RESPONSE[m.partner_response]}</dd><dt>נקלט</dt><dd>{fmt(m.dispatched_at)}</dd></dl>
                  {isPartner && <label className="ck-mrow-pick">{pick(m, `סימון ${cn.name(m)} לפעולה על כמה תיקים`)}&nbsp;סימון לפעולה על כמה תיקים</label>}
                  <div className="ck-row"><Link className="ck-btn primary" to={`/workspace?matter=${m.matter_id}`}>פתיחת התיק</Link>{isPartner && trashBtn(m, "ck-btn")}</div>
                </div>
              </details>
            ))}
          </div>
          <div className="ck-table-wrap ck-has-mlist">
            <table className="ck-table ck-mt-table">
              <thead><tr>
                {isPartner && <th><input type="checkbox" aria-label="סימון כל התיקים המוצגים" checked={shown.length > 0 && shown.every((m) => sel.has(m.matter_id))} onChange={(ev) => setSel(setAll(shown.map((m) => m.matter_id), ev.target.checked))} /></th>}
                {head("name", "תיק")}{head("owner", "אחראי")}<th>סטטוס</th><th>ניגוד עניינים</th><th>סיכון</th>{head("due", "המועד הקרוב")}{head("updated", "עודכן")}{head("opened", "נקלט")}
                {isPartner && <th><span className="sr-only">סל</span></th>}
              </tr></thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.matter_id} className={m.sla_breached ? "breach" : ""}>
                    {isPartner && <td>{pick(m)}</td>}
                    <td className="ck-mt-name"><Link to={`/workspace?matter=${m.matter_id}`}>{cn.name(m)}</Link><small className="ck-meta">{sub(m)}</small></td>
                    <td>{owner(m)}</td>
                    <td><span className="ck-mt-stack">{MATTER_STATUS[m.matter_status] ?? m.matter_status}<small className="ck-meta">{RESPONSE[m.partner_response]}</small></span></td>
                    <td>{conflict(m)}</td>
                    <td>{riskBadge(m.risk_level)}</td>
                    <td>{due(m)}</td>
                    <td>{updated(m)}</td>
                    <td>{fmt(m.dispatched_at)}</td>
                    {isPartner && <td>{trashBtn(m)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

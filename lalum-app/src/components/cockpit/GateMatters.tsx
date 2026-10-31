import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../Icon";
import { useClientNames } from "./ClientNames";
import { PRACTICE } from "../../lib/cockpit/shared";
import { recentMatterIds } from "../../lib/cockpit/recentMatters";
import type { GateMatter } from "../../lib/cockpit/gateMatters";

// The entry gate's two matter tools (owner, 31.10.2026, after the home screen of Clio's app): a search over every matter the
// member may read, and the matters opened last. Labels go through the client names mask like every matter label in the cockpit:
// hidden, a matter shows its code; the search then matches codes only.
const open = (id: string) => `/workspace?matter=${id}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });

export function GateSearch({ matters }: { matters: GateMatter[] | null }) {
  const cn = useClientNames();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(false);
  const hits = useMemo(() => (matters ?? []).filter((m) => cn.match(m, q)).slice(0, 6), [matters, q, cn]);
  return (
    <div className="gate-find" role="search" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShown(false); }}>
      <span className="gate-find-ic"><Icon name="search" size={20} /></span>
      <input
        type="search" placeholder="חיפוש תיק" aria-label="חיפוש תיק" autoComplete="off"
        aria-controls="gate-find-list" aria-expanded={shown}
        value={q} onChange={(e) => { setQ(e.target.value); setShown(true); }} onFocus={() => setShown(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) nav(open(hits[0].matter_id)); if (e.key === "Escape") setShown(false); }}
      />
      {shown && (
        <div className="gate-find-pop" id="gate-find-list">
          <div className="gate-find-head">{q.trim() ? `${hits.length ? "תוצאות" : "לא נמצא תיק תואם"}` : "תיקים אחרונים"}</div>
          {matters == null ? <div className="gate-find-empty">טוען...</div> : hits.length > 0 && (
            <ul role="list">
              {hits.map((m) => (
                <li key={m.matter_id}>
                  <Link to={open(m.matter_id)}>
                    <span className="gate-find-name">{cn.name(m)}</span>
                    <span className="gate-find-meta">{PRACTICE[m.practice_area] ?? m.practice_area} · {day(m.dispatched_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!cn.revealed && <div className="gate-find-note">שמות הלקוחות מוסתרים: החיפוש לפי מספר תיק.</div>}
        </div>
      )}
    </div>
  );
}

/** Four matters: the ones opened last on this browser first, then the newest ones, so the row is full from the first day. */
export function GateRecent({ matters }: { matters: GateMatter[] | null }) {
  const cn = useClientNames();
  const [ids] = useState(recentMatterIds);
  if (!matters || matters.length === 0) return null;
  const byId = new Map(matters.map((m) => [m.matter_id, m]));
  const seen = ids.map((id) => byId.get(id)).filter((m): m is GateMatter => !!m).slice(0, 4);
  const seenIds = new Set(seen.map((m) => m.matter_id));
  const list = [...seen, ...matters.filter((m) => !seenIds.has(m.matter_id))].slice(0, 4);
  return (
    <section className="gate-recent" aria-labelledby="gate-recent-h">
      <div className="gate-recent-top">
        <h2 id="gate-recent-h">תיקים אחרונים</h2>
        <Link to="/workspace">לכל התיקים</Link>
      </div>
      <ul role="list">
        {list.map((m) => (
          <li key={m.matter_id}>
            <Link to={open(m.matter_id)} className="gate-rcard">
              <span className="gate-rcard-ic"><Icon name="folder" size={18} /></span>
              <span className="gate-rcard-name">{cn.name(m)}</span>
              <span className="gate-rcard-meta">{PRACTICE[m.practice_area] ?? m.practice_area}</span>
              <span className="gate-rcard-date">{seenIds.has(m.matter_id) ? "נצפה לאחרונה" : `נפתח ${day(m.dispatched_at)}`}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

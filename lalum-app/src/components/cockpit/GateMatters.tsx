import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../Icon";
import { useClientNames } from "./ClientNames";
import { PRACTICE } from "../../lib/cockpit/shared";
import { recentMatterIds } from "../../lib/cockpit/recentMatters";
import { PRACTICE_EN, useCkLang } from "../../lib/cockpit/ckLang";
import type { GateMatter } from "../../lib/cockpit/gateMatters";

// The entry gate's two matter tools (owner, 31.10.2026, after the home screen of Clio's app): a search over every matter the
// member may read, and the matters opened last. Labels go through the client names mask like every matter label in the cockpit:
// hidden, a matter shows its code; the search then matches codes only.
const open = (id: string) => `/workspace?matter=${id}`;
const day = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "numeric", year: "2-digit" });
const practice = (code: string, en: boolean) => (en ? PRACTICE_EN[code] : PRACTICE[code]) ?? code;

export function GateSearch({ matters }: { matters: GateMatter[] | null }) {
  const cn = useClientNames();
  const { lang, tx, locale } = useCkLang();
  const en = lang === "en";
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(false);
  const hits = useMemo(() => (matters ?? []).filter((m) => cn.match(m, q)).slice(0, 6), [matters, q, cn]);
  return (
    <div className="gate-find" role="search" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShown(false); }}>
      <span className="gate-find-ic"><Icon name="search" size={20} /></span>
      <input
        type="search" placeholder={tx("חיפוש תיק", "Search matters")} aria-label={tx("חיפוש תיק", "Search matters")} autoComplete="off"
        aria-controls="gate-find-list" aria-expanded={shown}
        value={q} onChange={(e) => { setQ(e.target.value); setShown(true); }} onFocus={() => setShown(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) nav(open(hits[0].matter_id)); if (e.key === "Escape") setShown(false); }}
      />
      {shown && (
        <div className="gate-find-pop" id="gate-find-list">
          <div className="gate-find-head">{q.trim() ? (hits.length ? tx("תוצאות", "Results") : tx("לא נמצא תיק תואם", "No matching matter")) : tx("תיקים אחרונים", "Recent matters")}</div>
          {matters == null ? <div className="gate-find-empty">{tx("טוען...", "Loading...")}</div> : hits.length > 0 && (
            <ul role="list">
              {hits.map((m) => (
                <li key={m.matter_id}>
                  <Link to={open(m.matter_id)}>
                    <span className="gate-find-name" dir={en ? "auto" : undefined}>{cn.name(m)}</span>
                    <span className="gate-find-meta">{practice(m.practice_area, en)} · {day(m.dispatched_at, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!cn.revealed && <div className="gate-find-note">{tx("שמות הלקוחות מוסתרים: החיפוש לפי מספר תיק.", "Client names are hidden: search by matter number.")}</div>}
        </div>
      )}
    </div>
  );
}

/** Four matters: the ones opened last on this browser first, then the newest ones, so the row is full from the first day. */
export function GateRecent({ matters }: { matters: GateMatter[] | null }) {
  const cn = useClientNames();
  const { lang, tx, locale } = useCkLang();
  const en = lang === "en";
  const [ids] = useState(recentMatterIds);
  if (!matters || matters.length === 0) return null;
  const byId = new Map(matters.map((m) => [m.matter_id, m]));
  const seen = ids.map((id) => byId.get(id)).filter((m): m is GateMatter => !!m).slice(0, 4);
  const seenIds = new Set(seen.map((m) => m.matter_id));
  const list = [...seen, ...matters.filter((m) => !seenIds.has(m.matter_id))].slice(0, 4);
  return (
    <section className="gate-recent" aria-labelledby="gate-recent-h">
      <div className="gate-recent-top">
        <h2 id="gate-recent-h">{tx("תיקים אחרונים", "Recent matters")}</h2>
        <Link to="/workspace">{tx("לכל התיקים", "All matters")}</Link>
      </div>
      <ul role="list">
        {list.map((m) => (
          <li key={m.matter_id}>
            <Link to={open(m.matter_id)} className="gate-rcard">
              <span className="gate-rcard-ic"><Icon name="folder" size={18} /></span>
              <span className="gate-rcard-name" dir={en ? "auto" : undefined}>{cn.name(m)}</span>
              <span className="gate-rcard-meta">{practice(m.practice_area, en)}</span>
              <span className="gate-rcard-date">{seenIds.has(m.matter_id) ? tx("נצפה לאחרונה", "Viewed recently") : `${tx("נפתח", "Opened")} ${day(m.dispatched_at, locale)}`}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

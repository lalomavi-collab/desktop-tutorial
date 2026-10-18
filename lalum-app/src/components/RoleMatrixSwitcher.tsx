import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "./AppLink";
import { useLang } from "../context/LangContext";

// Entry by who you are, in four institutional tabs instead of one flat list of
// keywords. Every link and every sentence comes from copy the site already has
// (t.data.audiences and the mediation lead on the home strings); this only
// regroups them. Mediation is a service the practice provides, so its tab
// carries the existing line and a link to its existing page, nothing more.

type Cell = { label: string; body: string; to: string };
type Tab = { code: string; title: string; lede: string; cells: Cell[]; cta?: { label: string; to: string } };

const TITLES = {
  he: ["ארגונים וטכנולוגיה", "נדל״ן והתחדשות עירונית", "רשויות ודירקטוריונים", "יישוב סכסוכים"],
  en: ["Enterprise and tech", "Real estate and urban renewal", "Public authorities and boards", "Dispute resolution"],
};
const CODES = ["ENTERPRISE", "REAL-ESTATE", "PUBLIC", "DISPUTES"];
const RE = "/real-estate-legal-advisory";

export function RoleMatrixSwitcher() {
  const { t, lang } = useLang();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const names = TITLES[lang === "he" ? "he" : "en"];
  const [tech, pub, biz, priv] = t.home.audiences;

  const tabs: Tab[] = [
    {
      code: CODES[0], title: names[0], lede: tech.body,
      cells: [...tech.rubrics, ...biz.rubrics.filter((r) => r.to !== RE)],
      cta: { label: tech.cta, to: tech.to },
    },
    {
      code: CODES[1], title: names[1], lede: priv.body,
      cells: [...biz.rubrics.filter((r) => r.to === RE), ...priv.rubrics],
      cta: { label: priv.cta, to: priv.to },
    },
    { code: CODES[2], title: names[2], lede: pub.body, cells: pub.rubrics, cta: { label: pub.cta, to: pub.to } },
    {
      code: CODES[3], title: names[3], lede: t.home.advisoryMediationLead,
      cells: [{ label: t.home.advisoryMediationTitle, body: t.home.advisoryMediationLead, to: "/mediation-dispute-resolution" }],
    },
  ];

  const onKey = (e: KeyboardEvent, i: number) => {
    const rtl = document.documentElement.dir === "rtl";
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + tabs.length) % tabs.length;
    setActive(n);
    refs.current[n]?.focus();
  };

  const cur = tabs[active];
  return (
    <div className="rms">
      <div className="rms-tabs" role="tablist" aria-label={t.ui.nav.menu}>
        {tabs.map((tb, i) => (
          <button
            key={tb.code}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`rms-tab-${i}`}
            aria-selected={i === active}
            aria-controls="rms-panel"
            tabIndex={i === active ? 0 : -1}
            className="rms-tab"
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span dir="ltr" className="mono rms-code">[{String(i + 1).padStart(2, "0")}] {tb.code}</span>
            <span className="rms-name">{tb.title}</span>
          </button>
        ))}
      </div>
      <div id="rms-panel" role="tabpanel" aria-labelledby={`rms-tab-${active}`} className="rms-panel">
        <p className="rms-lede">{cur.lede}</p>
        <div className="bento rms-grid">
          {cur.cells.map((c) => (
            <Link key={c.label + c.to} to={c.to} className="bento-cell rms-cell">
              <strong>{c.label}</strong>
              {c.body !== cur.lede && <span>{c.body}</span>}
              <em aria-hidden="true">&rarr;</em>
            </Link>
          ))}
        </div>
        {cur.cta && <Link to={cur.cta.to} className="btn btn-clay rms-cta">{cur.cta.label}</Link>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../context/LangContext";

// Persisted acknowledgment of the current Privacy Policy version. Bump VERSION
// whenever the policy changes again, and every user is prompted afresh.
const KEY = "lalum-privacy-ack";
const VERSION = "2026-07-amendment-13";
// A "Later" choice snoozes the notice, persisted in localStorage so a page
// reload or a return visit within the window does not bring it back. It
// reappears once the snooze lapses, so the update is not forgotten. "Confirm"
// records the acknowledgment permanently for this version.
const SNOOZE_KEY = "lalum-privacy-ack-snooze";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Ack = { version: string; ts: number };

function acknowledged(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Ack).version === VERSION : false;
  } catch {
    return false;
  }
}

function snoozed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as Ack;
    return s.version === VERSION && Date.now() - s.ts < SNOOZE_MS;
  } catch {
    return false;
  }
}

// A one-time modal that informs clients the Privacy Policy was updated for
// Amendment 13, links to the updated policy, and records an explicit "I have
// read it" confirmation. It appears until the user confirms the current version.
export function PrivacyUpdateNotice() {
  const { t, dir } = useLang();
  const p = t.ui.privacyUpdate;
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (acknowledged() || snoozed()) return;
    setOpen(true);
  }, []);

  function confirm() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, ts: Date.now() } satisfies Ack));
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function later() {
    try {
      localStorage.setItem(SNOOZE_KEY, JSON.stringify({ version: VERSION, ts: Date.now() } satisfies Ack));
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="cookie-overlay" role="dialog" aria-modal="true" aria-label={p.aria}>
      <div dir={dir} className="cookie-modal privacy-update-modal">
        <h2 className="h3" style={{ fontSize: 22, margin: "0 0 12px" }}>{p.title}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.72, color: "var(--slate)", margin: "0 0 16px" }}>{p.body}</p>

        <Link to="/legal#privacy" target="_blank" rel="noopener noreferrer" className="privacy-update-link">
          {p.linkText}
        </Link>

        <label className="consent" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span className="consent-text">{p.ack}</span>
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 22 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={later}>{p.later}</button>
          <button
            type="button"
            className="btn btn-clay btn-sm"
            onClick={confirm}
            disabled={!checked}
            style={{ opacity: checked ? 1 : 0.5, cursor: checked ? "pointer" : "not-allowed" }}
          >
            {p.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import { useCkLang } from "../../lib/cockpit/ckLang";
import "../../styles/cockpit-quick.css";

// The quick add button (owner, 31.10.2026, after the "+" of Clio's mobile app; learnt from it, not copied): one round button
// at the bottom of every cockpit screen that opens the everyday actions. Each item opens a screen that already exists, so
// nothing here writes data or bypasses a screen's own checks.
const CLOCK = <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5" /></svg>;
const ITEMS: Array<{ to: string; label: string; hint: string; en: [string, string]; icon: ReactNode }> = [
  { to: "/workspace/hours", label: "טיימר ושעות", hint: "הפעלת טיימר על תיק או רישום ידני", en: ["Timer and hours", "Start a timer on a matter or log time by hand"], icon: CLOCK },
  { to: "/workspace", label: "תיק חדש", hint: "העלאת מסמך או הדבקת טקסט", en: ["New matter", "Upload a document or paste text"], icon: <Icon name="folder" size={20} /> },
  { to: "/workspace/tasks", label: "משימה", hint: "אחראי ומועד יעד", en: ["Task", "Owner and due date"], icon: <Icon name="check" size={20} /> },
  { to: "/workspace/scheduling", label: "פגישה ביומן", hint: "פגישות ומועדים ביומן", en: ["Meeting", "Meetings and deadlines in the calendar"], icon: <Icon name="calendar" size={20} /> },
  { to: "/workspace/inquiries", label: "פניות לקוחות", hint: "מענה לפנייה חדשה", en: ["Client inquiries", "Answer a new inquiry"], icon: <Icon name="phone" size={20} /> },
];

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const { lang, tx } = useCkLang();
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="ck-quick" ref={box}>
      {open && (
        <nav className="ck-quick-menu" id="ck-quick-menu" aria-label={tx("פעולות מהירות", "Quick actions")}>
          <ul role="list">
            {ITEMS.map((it) => (
              <li key={it.to}>
                <Link to={it.to} onClick={() => setOpen(false)}>
                  <span className="ck-quick-ic">{it.icon}</span>
                  <span className="ck-quick-tx"><b>{lang === "en" ? it.en[0] : it.label}</b><small>{lang === "en" ? it.en[1] : it.hint}</small></span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <button ref={btn} type="button" className="ck-quick-btn" aria-expanded={open} aria-controls="ck-quick-menu" aria-label={open ? tx("סגירת הפעולות המהירות", "Close quick actions") : tx("פעולות מהירות", "Quick actions")} onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? "x" : "plus"} size={26} />
      </button>
    </div>
  );
}

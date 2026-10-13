import { useEffect, useState } from "react";
import { money } from "../../lib/cockpit/shared";
import { iso, trustBalance, wip } from "../../lib/cockpit/crm";
import type { TimeEntry, TrustEntry } from "../../lib/cockpit/crm";

const ACTIONS = ["ניסוח", "מחקר משפטי", "שיחה עם לקוח", "ישיבה", "הופעה בבית משפט"];
const clock = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");

/** Timer, WIP and trust ledger for one matter. The rate is locked when the timer starts. Invoicing hands off to the Invoice4U flow. */
export function BillingAndTrustTab({ matterId, rate, time, trust, onTime, onTrust }: {
  matterId: string; rate: number; time: TimeEntry[]; trust: TrustEntry[]; onTime: (t: TimeEntry[]) => void; onTrust: (t: TrustEntry[]) => void;
}) {
  const [running, setRunning] = useState(false);
  const [secs, setSecs] = useState(0);
  const [action, setAction] = useState(ACTIONS[0]);
  const [lockedRate, setLockedRate] = useState(rate);
  useEffect(() => { if (!running) return; const id = window.setInterval(() => setSecs((s) => s + 1), 1000); return () => window.clearInterval(id); }, [running]);

  const start = () => { setLockedRate(rate); setRunning(true); };
  const stop = () => {
    setRunning(false);
    if (secs >= 1) onTime([...time, { id: `t${time.length + 1}-${Date.now()}`, matterId, on: iso(new Date()), hours: Math.round((secs / 3600) * 100) / 100, rate: lockedRate, action, billed: false }]);
    setSecs(0);
  };
  const mine = time.filter((t) => t.matterId === matterId);
  const w = wip(mine);
  const bal = trustBalance(trust, matterId);
  const [amount, setAmount] = useState(0);
  const post = (kind: "DEPOSIT" | "APPLY") => {
    if (amount <= 0 || (kind === "APPLY" && amount > bal)) return;
    onTrust([...trust, { id: `tr${trust.length + 1}-${Date.now()}`, matterId, on: iso(new Date()), kind, amount, note: kind === "DEPOSIT" ? "הפקדה" : "קיזוז מול חשבונית" }]);
    setAmount(0);
  };
  return (
    <section aria-label="חיוב ונאמנות" className="ck-stack">
      <div className="ck-card">
        <div className="ck-card-head"><h3 className="ck-title">שעות בצבר</h3><span className="ck-badge yellow">{w.hours} שעות, {money(w.amount)}</span></div>
        <ul className="crm-list">{mine.map((t) => <li key={t.id}><span>{t.action} <span className="ck-meta" dir="ltr">{t.on}</span></span><span>{t.hours} ש׳ × {money(t.rate)} {t.billed && <span className="ck-badge green">חויב</span>}</span></li>)}</ul>
        <a className="ck-btn" href="/settings/billing">הפקת חשבונית ב-Invoice4U</a>
      </div>
      <div className="ck-card">
        <div className="ck-card-head"><h3 className="ck-title">פנקס נאמנות</h3><span className="ck-badge green">{money(bal)}</span></div>
        <div className="ck-meta">כספי לקוח המוחזקים בנאמנות הם התחייבות. הם אינם הכנסה ולא ייכללו בדוחות הכנסות.</div>
        <div className="crm-actions" style={{ margin: "8px 0" }}>
          <input className="ck-input" type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} aria-label="סכום" style={{ maxWidth: 140 }} />
          <button type="button" className="ck-btn primary" onClick={() => post("DEPOSIT")}>הפקדת כספי נאמנות</button>
          <button type="button" className="ck-btn" disabled={amount > bal} onClick={() => post("APPLY")}>קיזוז מול חשבונית</button>
        </div>
        <ul className="crm-list">{trust.filter((e) => e.matterId === matterId).map((e) => <li key={e.id}><span>{e.note} <span className="ck-meta" dir="ltr">{e.on}</span></span><span>{e.kind === "DEPOSIT" ? "+" : "-"}{money(e.amount)}</span></li>)}</ul>
      </div>
      <div className="crm-timer" role="group" aria-label="טיימר">
        <b aria-live="off">{clock(secs)}</b>
        <select className="ck-select" value={action} onChange={(e) => setAction(e.target.value)} disabled={running} aria-label="סוג פעולה">{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select>
        <span className="ck-meta">תעריף נעול: {money(running ? lockedRate : rate)} לשעה</span>
        {running ? <button type="button" className="ck-btn primary" onClick={stop}>עצירה ושמירה</button> : <button type="button" className="ck-btn primary" onClick={start}>התחלה</button>}
      </div>
    </section>
  );
}

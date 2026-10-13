import { useState } from "react";
import { clientMessages } from "../../lib/cockpit/crm";
import { fmt } from "../../lib/cockpit/shared";
import type { Message } from "../../lib/cockpit/crmDemo";

/** Receives ALL rows only to prove the filter in the demo. In production the client query never returns internal rows. */
export function SecureCommsFeed({ messages, onSend }: { messages: Message[]; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const shown = clientMessages(messages);
  const send = () => { const t = text.trim(); if (t) { onSend(t); setText(""); } };
  return (
    <section aria-label="הודעות" className="ck-stack">
      <h3 className="ck-title">הודעות לצוות</h3>
      <div className="crm-chat" role="log" aria-live="polite">
        {shown.map((m) => <div key={m.id} className={`crm-bubble${m.from === "CLIENT" ? " me" : ""}`}>{m.text}<div className="ck-meta" dir="ltr">{fmt(m.at)}</div></div>)}
      </div>
      <div className="crm-actions">
        <input className="ck-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} aria-label="הודעה" style={{ flex: 1 }} />
        <button type="button" className="ck-btn primary" onClick={send}>שליחה</button>
      </div>
    </section>
  );
}

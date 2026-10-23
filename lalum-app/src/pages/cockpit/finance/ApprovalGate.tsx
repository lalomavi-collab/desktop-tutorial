import { useState } from "react";
import type { ReactNode } from "react";

/** Keeps an action that talks to the history system out of reach until the person asks for it on purpose.
 *  The approval lasts for the time the screen stays open; opening it again starts closed. */
export function ApprovalGate({ what, children }: { what: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return <>{children}</>;
  return (
    <div className="ck-stack">
      <div className="ck-meta">{what} פונה למערכת ההיסטוריה (Invoice4U). הפעולה כבויה עד שתאשרו אותה.</div>
      <div className="ck-row">
        <button className="ck-btn" type="button" onClick={() => { if (window.confirm(`לאפשר ${what}? זו פנייה למערכת ההיסטוריה (Invoice4U), לקריאה בלבד.`)) setOpen(true); }}>
          אישור וחשיפת הכפתורים
        </button>
      </div>
    </div>
  );
}

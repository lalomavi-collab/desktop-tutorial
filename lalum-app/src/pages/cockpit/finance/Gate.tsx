import type { ReactNode } from "react";

/** Disables every control inside when the signed-in user's finance level is below the level the area needs.
 *  The database and the edge function enforce the same levels; this only keeps the screen honest. */
export function Gate({ level, need, children }: { level: number; need: number; children: ReactNode }) {
  const blocked = level < need;
  return (
    <fieldset disabled={blocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {blocked && <div className="ck-warn">ההרשאה שלך מאפשרת צפייה בלבד באזור הזה.</div>}
      {children}
    </fieldset>
  );
}

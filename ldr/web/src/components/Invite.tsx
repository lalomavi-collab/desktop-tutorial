import { useEffect, useState } from "react";
import { supabase, type Profile } from "../lib/supabase";
import { rankFor, badgesFor } from "../lib/reputation";

export default function Invite({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [firm, setFirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!profile.firm_id) return;
    supabase.from("ldr_firms").select("id,name").eq("id", profile.firm_id).maybeSingle()
      .then(({ data }) => setFirm(data as any));
  }, [profile.firm_id]);

  async function createInvite(forFirm: boolean) {
    setBusy(true);
    const { data, error } = await supabase.from("ldr_invites")
      .insert({ inviter_id: profile.id, firm_id: forFirm ? profile.firm_id : null })
      .select("token").single();
    setBusy(false);
    if (error || !data) { notify("שגיאה ביצירת הזמנה"); return; }
    const url = `${window.location.origin}${window.location.pathname}?invite=${data.token}`;
    setLink(url);
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    notify("לינק הזמנה נוצר והועתק ✂️");
  }

  async function createFirm() {
    if (!firmName.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from("ldr_firms")
      .insert({ name: firmName, owner_id: profile.id }).select("id,name").single();
    if (!error && data) {
      await supabase.from("ldr_profiles").update({ firm_id: data.id }).eq("id", profile.id);
      await supabase.from("ldr_firm_members").insert({ firm_id: data.id, user_id: profile.id, role: "owner" });
      setFirm(data as any);
      notify("המשרד נוצר — עכשיו אפשר לשתף קולגות");
    } else notify("שגיאה ביצירת משרד");
    setBusy(false);
  }

  return (
    <div className="container" style={{ paddingTop: 26 }}>
      <h2>הזמנות ושיתוף</h2>
      <div className="grid cols-2">
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>הזמנת חברים לקהילה</h3>
          <p className="muted">צרו לינק אישי ושלחו לקולגות — הם מצטרפים בקליק עם המייל שלהם.</p>
          <button className="btn btn-gold" disabled={busy} onClick={() => createInvite(false)}>
            יצירת לינק הזמנה
          </button>
          {link && (
            <div className="card" style={{ background: "var(--obsidian-3)", padding: 12, marginTop: 14, wordBreak: "break-all", fontSize: 13 }} dir="ltr">
              {link}
            </div>
          )}
        </div>

        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>המשרד שלי</h3>
          {firm ? (
            <>
              <p>משרד פעיל: <b className="gold">{firm.name}</b></p>
              <p className="muted">שתפו עמית/ה במשרד — לכיסוי הדדי בימים שאינכם במשרד.</p>
              <button className="btn btn-gold" disabled={busy} onClick={() => createInvite(true)}>
                הזמנת קולגה למשרד
              </button>
            </>
          ) : (
            <>
              <p className="muted">צרו משרד כדי לשתף תיקים פנימית עם עו"ד נוסף (כיסוי הדדי).</p>
              <label>שם המשרד</label>
              <input value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="משרד עו״ד ..." />
              <button className="btn btn-gold" style={{ marginTop: 14 }} disabled={busy} onClick={createFirm}>
                יצירת משרד
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card pad" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>המוניטין שלך</h3>

        {(() => {
          const rp = rankFor(profile.reputation);
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "Frank Ruhl Libre, serif", fontWeight: 900, fontSize: 20 }}>
                  {rp.rank.icon} {rp.rank.title}
                </span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {rp.next ? `עוד ${rp.toNext} נק׳ ל${rp.next.icon} ${rp.next.title}` : "הדרגה הגבוהה ביותר 🏆"}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: "var(--obsidian-3)", marginTop: 8, overflow: "hidden" }}>
                <div style={{ width: `${rp.pct}%`, height: "100%", background: "var(--gold)" }} />
              </div>
            </div>
          );
        })()}

        <div className="grid cols-3">
          <div className="stat"><div className="n">{profile.reputation}</div><div className="l">נקודות מוניטין</div></div>
          <div className="stat"><div className="n">{profile.contribution_count}</div><div className="l">תיקים ששותפו</div></div>
          <div className="stat"><div className="n">{profile.prediction_count}</div><div className="l">חיזויים שתרמת</div></div>
        </div>

        <div className="divider" />
        <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>תגי הישג</div>
        <div className="chip-select">
          {badgesFor(profile).map((b) => (
            <span
              key={b.key}
              className={"chip " + (b.earned ? "on" : "")}
              title={b.hint}
              style={{ opacity: b.earned ? 1 : 0.4 }}
            >
              {b.icon} {b.label}
            </span>
          ))}
        </div>

        <div className="banner" style={{ marginTop: 16 }}>
          🎁 בתקופת ההשקה הגישה לקהילה <b>חינמית ומלאה</b>. ככל שתתרמו יותר — המוניטין עולה,
          וכאשר נפעיל גישה הדדית, התורמים המובילים ייהנו מגישה מורחבת.
        </div>
      </div>
    </div>
  );
}

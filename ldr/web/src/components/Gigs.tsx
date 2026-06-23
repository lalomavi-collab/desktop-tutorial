import { useEffect, useState } from "react";
import {
  supabase, PRACTICE_AREAS, JURISDICTIONS, PRACTICE_AREA_LABELS, JURISDICTION_LABELS,
  CURRENCY_SYMBOL, type Profile, type Gig, type Currency,
} from "../lib/supabase";
import { rankFor } from "../lib/reputation";
import Avatar from "./Avatar";

const OWNER_SELECT = "*, owner:ldr_profiles!owner_id(display_name,reputation,verification_status,experience_tier)";

export default function Gigs({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const [view, setView] = useState<"browse" | "create">("browse");
  const [juris, setJuris] = useState("");
  const [area, setArea] = useState("");
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = supabase.from("ldr_gigs").select(OWNER_SELECT).eq("status", "active");
    if (juris) q = q.eq("jurisdiction", juris);
    if (area) q = q.eq("practice_area", area);
    const { data } = await q.order("created_at", { ascending: false }).limit(60);
    setGigs((data as Gig[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="container" style={{ paddingTop: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Legal Gigs — שוק הפתרונות</h2>
        <button className="btn btn-gold" onClick={() => setView(view === "create" ? "browse" : "create")}>
          {view === "create" ? "← לשוק" : "+ פרסום שירות"}
        </button>
      </div>
      <p className="muted">
        פתרונות טקטיים מקומיים שעו״ד מציעים בתחום השיפוט שלהם. דפדפו לפי מדינה — ופתחו ערוץ מאובטח לשיתוף פעולה.
      </p>

      {view === "create" ? (
        <GigBuilder profile={profile} notify={notify} onDone={() => { setView("browse"); load(); }} />
      ) : (
        <>
          <div className="card pad" style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
            <div>
              <label>מדינה (Country Node)</label>
              <select value={juris} onChange={(e) => setJuris(e.target.value)}>
                <option value="">כל העולם</option>
                {JURISDICTIONS.map((j) => <option key={j.key} value={j.key}>{j.flag} {j.label}</option>)}
              </select>
            </div>
            <div>
              <label>תחום</label>
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">כל התחומים</option>
                {PRACTICE_AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </div>
            <button className="btn btn-gold" onClick={load} disabled={loading}>
              {loading ? <span className="spinner" /> : "סינון"}
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            {loading ? (
              <div className="center" style={{ padding: 40 }}><span className="spinner" /></div>
            ) : gigs.length === 0 ? (
              <div className="card pad center">
                <p className="muted">אין עדיין שירותים בקריטריון הזה. היו הראשונים לפרסם פתרון בתחום השיפוט שלכם.</p>
                <button className="btn btn-gold" onClick={() => setView("create")}>פרסום שירות ראשון</button>
              </div>
            ) : (
              <div className="grid cols-2">
                {gigs.map((g) => {
                  const rp = rankFor(g.owner?.reputation ?? 0);
                  return (
                    <div key={g.id} className="card pad">
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="tag">{JURISDICTION_LABELS[g.jurisdiction] ?? g.jurisdiction}</span>
                        <span className="tag">{PRACTICE_AREA_LABELS[g.practice_area] ?? g.practice_area}</span>
                      </div>
                      <h3 style={{ margin: "10px 0 4px" }}>{g.title}</h3>
                      {g.scope && <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{g.scope}</p>}

                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                        <Avatar name={g.owner?.display_name ?? null} size={36}
                          verified={g.owner?.verification_status === "verified"} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{g.owner?.display_name || "עו״ד"}</div>
                          <div className="gold" style={{ fontSize: 11 }} dir="ltr">{rp.rank.icon} {rp.rank.title}</div>
                        </div>
                        {(g.fee_min != null || g.fee_max != null) && (
                          <div className="gold" style={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                            {CURRENCY_SYMBOL[g.currency]}{g.fee_min ?? ""}{g.fee_max != null ? `–${g.fee_max}` : ""}
                          </div>
                        )}
                      </div>

                      <button
                        className="btn btn-ghost" style={{ width: "100%", marginTop: 12 }}
                        onClick={() => notify("פתיחת ערוץ Escrow מאובטח — בקרוב במודול ההפניות 🔐")}
                      >
                        פתיחת ערוץ מאובטח
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GigBuilder({
  profile, notify, onDone,
}: { profile: Profile; notify: (m: string) => void; onDone: () => void }) {
  const [jurisdiction, setJurisdiction] = useState(profile.jurisdiction ?? "IL");
  const [area, setArea] = useState(profile.practice_areas?.[0] ?? PRACTICE_AREAS[0].key);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [feeMin, setFeeMin] = useState("");
  const [feeMax, setFeeMax] = useState("");
  const [busy, setBusy] = useState(false);

  async function publish() {
    if (!title.trim()) { notify("הוסיפו כותרת לשירות"); return; }
    setBusy(true);
    const { error } = await supabase.from("ldr_gigs").insert({
      owner_id: profile.id, jurisdiction, practice_area: area,
      title: title.trim(), scope: scope.trim(),
      fee_min: feeMin ? Number(feeMin) : null,
      fee_max: feeMax ? Number(feeMax) : null,
      currency,
    });
    setBusy(false);
    if (error) { notify("שגיאה בפרסום: " + error.message); return; }
    notify("השירות פורסם לשוק 🎯");
    onDone();
  }

  return (
    <div className="card pad" style={{ marginTop: 16, maxWidth: 680 }}>
      <h3 style={{ marginTop: 0 }}>פרסום פתרון טקטי</h3>
      <div className="grid cols-2">
        <div>
          <label>מדינה (תחום שיפוט)</label>
          <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
            {JURISDICTIONS.map((j) => <option key={j.key} value={j.key}>{j.flag} {j.label}</option>)}
          </select>
        </div>
        <div>
          <label>תחום</label>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            {PRACTICE_AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
      </div>

      <label>כותרת השירות</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="למשל: רישום חברה מזורז בגרמניה" />

      <label>תיאור / היקף</label>
      <textarea value={scope} onChange={(e) => setScope(e.target.value)}
        placeholder="מה כולל השירות, לוחות זמנים, מה נדרש מהצד המפנה" />

      <div className="grid cols-3">
        <div>
          <label>מטבע</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {(["EUR", "USD", "ILS", "GBP"] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>מחיר מ-</label>
          <input dir="ltr" inputMode="numeric" value={feeMin}
            onChange={(e) => setFeeMin(e.target.value.replace(/[^\d]/g, ""))} placeholder="500" />
        </div>
        <div>
          <label>עד</label>
          <input dir="ltr" inputMode="numeric" value={feeMax}
            onChange={(e) => setFeeMax(e.target.value.replace(/[^\d]/g, ""))} placeholder="1500" />
        </div>
      </div>

      <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy || !title.trim()} onClick={publish}>
        {busy ? <span className="spinner" /> : "פרסום לשוק"}
      </button>
    </div>
  );
}

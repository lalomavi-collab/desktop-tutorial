import { useEffect, useState } from "react";
import {
  supabase, DOMAIN_LABELS, EXPOSURE_LABELS, RISK_FACTOR_LABELS,
  type LdrCase, type Profile,
} from "../lib/supabase";
import { riskBand } from "../lib/riskEngine";

export default function Dashboard({
  profile, notify, onNew,
}: { profile: Profile; notify: (m: string) => void; onNew: () => void }) {
  const [cases, setCases] = useState<LdrCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<LdrCase | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("ldr_cases").select("*").order("created_at", { ascending: false }).limit(60);
    setCases((data as LdrCase[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="container animate-in" style={{ paddingTop: 26 }}>
      <div className="section-header">
        <h2>⚖️ חדר ההחלטות</h2>
        <button className="btn btn-gold" onClick={onNew}>+ תיק חדש</button>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 20 }}>תיקים אנונימיים פתוחים לתיקוף — הצביעו, הציעו חלופות והציפו נקודות עיוורות.</p>

      {loading ? (
        <div className="grid cols-2">
          {[1,2,3,4].map((i) => (
            <div key={i} className="card pad">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-line short" />
                  <div className="skeleton skeleton-line shorter" style={{ marginTop: 6 }} />
                </div>
                <div className="skeleton" style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0 }} />
              </div>
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" style={{ marginTop: 6 }} />
            </div>
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="card pad center" style={{ padding: "50px 22px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚖️</div>
          <p className="muted">אין עדיין תיקים. היו הראשונים לשתף ולפתוח את החכמה הקולקטיבית.</p>
          <button className="btn btn-gold" onClick={onNew}>שיתוף תיק ראשון</button>
        </div>
      ) : (
        <div className="grid cols-2 stagger-children">
          {cases.map((c) => {
            const band = riskBand(c.ai_risk_score ?? 0);
            return (
              <div key={c.case_id} className="card pad card-interactive" style={{ cursor: "pointer" }} onClick={() => setOpen(c)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="tag">{DOMAIN_LABELS[c.legal_domain]}</span>
                    <span className="tag">{EXPOSURE_LABELS[c.economic_exposure]}</span>
                  </div>
                  <div className={"risk-dial " + band.cls} style={{ width: 56, height: 56, ["--val" as any]: c.ai_risk_score ?? 0 }}>
                    <span className="num" style={{ fontSize: 16 }}>{Math.round(c.ai_risk_score ?? 0)}</span>
                  </div>
                </div>
                <p style={{ lineHeight: 1.6, maxHeight: 72, overflow: "hidden", color: "var(--cream-dim)", fontSize: 14, margin: "0 0 10px" }}>
                  {c.proposed_strategy}
                </p>
                <div className="chip-select">
                  {c.risk_factors.slice(0, 3).map((f) => (
                    <span key={f} className="chip" style={{ fontSize: 11 }}>{RISK_FACTOR_LABELS[f] ?? f}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <CaseDetail c={open} profile={profile} notify={notify}
          onClose={() => { setOpen(null); load(); }} />
      )}
    </div>
  );
}

function CaseDetail({
  c, profile, notify, onClose,
}: { c: LdrCase; profile: Profile; notify: (m: string) => void; onClose: () => void }) {
  const band = riskBand(c.ai_risk_score ?? 0);
  const [prob, setProb] = useState(0.6);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [consensus, setConsensus] = useState<{ count: number; mean: number | null }>({ count: 0, mean: null });

  async function loadConsensus() {
    const { data } = await supabase.from("ldr_peer_predictions")
      .select("success_probability").eq("case_id", c.case_id);
    const ps = (data ?? []).map((r: any) => r.success_probability);
    setConsensus({ count: ps.length, mean: ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null });
  }
  useEffect(() => { loadConsensus(); }, []);

  async function vote() {
    setBusy(true);
    const { error } = await supabase.from("ldr_peer_predictions").upsert({
      case_id: c.case_id, peer_id: profile.id,
      success_probability: prob, alternative_strategy: alt || null,
    }, { onConflict: "case_id,peer_id" });
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    notify("ההצבעה נקלטה — תודה על התרומה!");
    loadConsensus();
  }

  return (
    <div onClick={onClose} className="modal-backdrop">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>תיק אנונימי</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="risk-meter" style={{ marginTop: 12 }}>
          <div className={"risk-dial " + band.cls} style={{ ["--val" as any]: c.ai_risk_score ?? 0 }}>
            <span className="num">{Math.round(c.ai_risk_score ?? 0)}</span>
          </div>
          <div>
            <span className="tag">{DOMAIN_LABELS[c.legal_domain]}</span>{" "}
            <span className="tag">{EXPOSURE_LABELS[c.economic_exposure]}</span>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              קונצנזוס עמיתים: {consensus.mean === null ? "—" : Math.round(consensus.mean * 100) + "% הצלחה"} ({consensus.count} מצביעים)
            </div>
          </div>
        </div>

        <div className="divider" />
        <p style={{ lineHeight: 1.8 }}>{c.proposed_strategy}</p>
        <div className="chip-select">
          {c.risk_factors.map((f) => <span key={f} className="chip">{RISK_FACTOR_LABELS[f] ?? f}</span>)}
        </div>

        {c.owner_id !== profile.id && (
          <>
            <div className="divider" />
            <h4 style={{ margin: "0 0 4px" }}>החיזוי שלך</h4>
            <label>סיכויי הצלחה למתווה: <b className="gold">{Math.round(prob * 100)}%</b></label>
            <input type="range" min={0} max={1} step={0.05} value={prob}
              onChange={(e) => setProb(Number(e.target.value))} />
            <label>חלופה טקטית / נקודה עיוורת (אופציונלי)</label>
            <textarea style={{ minHeight: 90 }} value={alt} onChange={(e) => setAlt(e.target.value)}
              placeholder="מה הייתם עושים אחרת? מה פוספס?" />
            <button className="btn btn-gold" style={{ width: "100%", marginTop: 14 }} disabled={busy} onClick={vote}>
              {busy ? <span className="spinner" /> : "שליחת חיזוי"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

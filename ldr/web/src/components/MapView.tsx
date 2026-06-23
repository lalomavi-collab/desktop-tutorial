import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  supabase, PRACTICE_AREA_LABELS, EXPERIENCE_LABELS,
  JURISDICTION_LABELS, PRACTICE_AREAS,
  type Profile, type ExperienceTier,
} from "../lib/supabase";
import { rankFor } from "../lib/reputation";
import Avatar from "./Avatar";

// ── Colour per practice-area category (Waze-hazard palette) ─────────────────
const AREA_COLOR: Record<string, string> = {
  real_estate: "#D4AF37", urban_renewal: "#D4AF37", planning_building: "#D4AF37",
  commercial: "#4FC3F7", corporate_vc: "#4FC3F7", banking_finance: "#4FC3F7",
  litigation: "#EF5350", criminal: "#EF5350", admin_constitutional: "#EF5350",
  labor: "#AB47BC", ip: "#AB47BC", privacy_cyber: "#AB47BC",
  family_inheritance: "#66BB6A", adr: "#66BB6A", insurance_tort: "#66BB6A",
  tax: "#FF9800", insolvency: "#FF9800",
  regulation: "#26C6DA", energy_infra: "#26C6DA", environment: "#26C6DA",
};
function areaColor(areas: string[]) { return AREA_COLOR[areas?.[0]] ?? "#D4AF37"; }

// ── Entry type (real + demo merged) ─────────────────────────────────────────
interface AttyEntry {
  id: string;
  name: string | null;
  lat: number; lng: number;
  practice_areas: string[];
  jurisdiction: string | null;
  experience_tier: ExperienceTier | null;
  reputation: number;
  headline: string | null;
  verified: boolean;
  demo: boolean;
  avatar_url: string | null;
}

function dist(a: AttyEntry, loc: [number, number]) {
  return Math.hypot(a.lat - loc[0], a.lng - loc[1]) * 111;
}

// ── Custom circular marker icon ──────────────────────────────────────────────
function pinIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:38px;height:38px;border-radius:50%;
        background:${color};border:3px solid #1B1B1B;
        box-shadow:0 0 14px ${color}99, 0 2px 8px #000a;
        display:flex;align-items:center;justify-content:center;
        font-size:15px;cursor:pointer;transition:transform .15s;
        font-weight:800;color:#1B1B1B;
      " title="${label}">⚖</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

function mePinIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:#00E5FF;border:3px solid #fff;
      box-shadow:0 0 14px #00E5FFaa, 0 0 0 6px #00E5FF33;
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MapView({ profile, notify }: { profile: Profile; notify: (m: string) => void }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerMap = useRef<Map<string, L.Marker>>(new Map());
  const meMark = useRef<L.Marker | null>(null);

  const [attorneys, setAttorneys] = useState<AttyEntry[]>([]);
  const [selected, setSelected] = useState<AttyEntry | null>(null);
  const [filterArea, setFilterArea] = useState("");
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [connPending, setConnPending] = useState<Set<string>>(new Set());

  // ── Load attorneys ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [{ data: rp }, { data: dp }] = await Promise.all([
        supabase.from("ldr_profiles")
          .select("id,display_name,lat,lng,practice_areas,jurisdiction,experience_tier,reputation,headline,avatar_url")
          .eq("verification_status", "verified")
          .not("lat", "is", null)
          .neq("id", profile.id),
        supabase.from("ldr_demo_attorneys")
          .select("id,display_name,lat,lng,practice_areas,jurisdiction,experience_tier,reputation,headline,avatar_url")
          .not("lat", "is", null),
      ]);
      const real: AttyEntry[] = ((rp ?? []) as any[]).map((r) => ({
        id: r.id, name: r.display_name, lat: r.lat, lng: r.lng,
        practice_areas: r.practice_areas ?? [], jurisdiction: r.jurisdiction,
        experience_tier: r.experience_tier, reputation: r.reputation,
        headline: r.headline, verified: true, demo: false, avatar_url: r.avatar_url,
      }));
      const demo: AttyEntry[] = ((dp ?? []) as any[]).map((d) => ({
        id: d.id, name: d.display_name, lat: d.lat, lng: d.lng,
        practice_areas: d.practice_areas ?? [], jurisdiction: d.jurisdiction,
        experience_tier: d.experience_tier, reputation: d.reputation,
        headline: d.headline, verified: true, demo: true, avatar_url: d.avatar_url ?? null,
      }));
      setAttorneys([...real, ...demo]);
      setLoading(false);
    })();
  }, []);

  // ── Load connections ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ldr_connections")
        .select("requester_id,addressee_id,status");
      const acc = new Set<string>(), pend = new Set<string>();
      (data ?? []).forEach((c: any) => {
        const other = c.requester_id === profile.id ? c.addressee_id : c.requester_id;
        if (c.status === "accepted") acc.add(other);
        else pend.add(other);
      });
      setConnected(acc);
      setConnPending(pend);
    })();
  }, []);

  // ── Init map ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      center: [32.08, 34.78],
      zoom: 10,
      zoomControl: false,
      attributionControl: false,
    });

    // Waze-like dark tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: "© CartoDB · OSM" }).addTo(map);

    // Close card on map click
    map.on("click", () => setSelected(null));

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Sync markers whenever attorneys or filter changes ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markerMap.current.forEach((m) => m.remove());
    markerMap.current.clear();

    const show = filterArea
      ? attorneys.filter((a) => a.practice_areas.includes(filterArea))
      : attorneys;

    show.forEach((atty) => {
      const color = areaColor(atty.practice_areas);
      const m = L.marker([atty.lat, atty.lng], { icon: pinIcon(color, atty.name ?? "") })
        .addTo(map);
      m.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelected(atty);
        map.panTo([atty.lat, atty.lng], { animate: true });
      });
      markerMap.current.set(atty.id, m);
    });
  }, [attorneys, filterArea]);

  // ── Selected: pulse the marker ──────────────────────────────────────────
  useEffect(() => {
    markerMap.current.forEach((m, id) => {
      const el = m.getElement();
      if (!el) return;
      const inner = el.querySelector("div") as HTMLElement | null;
      if (!inner) return;
      inner.style.transform = id === selected?.id ? "scale(1.35)" : "scale(1)";
      inner.style.zIndex   = id === selected?.id ? "999" : "auto";
    });
  }, [selected]);

  // ── Locate me ───────────────────────────────────────────────────────────
  function locateMe() {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc: [number, number] = [coords.latitude, coords.longitude];
        setUserLoc(loc);
        mapRef.current?.flyTo(loc, 14, { animate: true });
        if (meMark.current) meMark.current.remove();
        meMark.current = L.marker(loc, { icon: mePinIcon(), zIndexOffset: 1000 })
          .addTo(mapRef.current!)
          .bindPopup("אני כאן");
        // Save location to profile
        supabase.from("ldr_profiles").update({ lat: loc[0], lng: loc[1] }).eq("id", profile.id);
      },
      () => notify("אשרו גישה למיקום בדפדפן"),
    );
  }

  // ── Connect ─────────────────────────────────────────────────────────────
  async function connect(id: string) {
    setConnPending((p) => new Set(p).add(id));
    const { error } = await supabase.from("ldr_connections")
      .insert({ requester_id: profile.id, addressee_id: id });
    if (error && error.code !== "23505") {
      setConnPending((p) => { const n = new Set(p); n.delete(id); return n; });
      notify("שגיאה בחיבור");
    } else {
      notify("בקשה נשלחה 🤝");
    }
  }

  // ── Sorted list ─────────────────────────────────────────────────────────
  const filtered = filterArea
    ? attorneys.filter((a) => a.practice_areas.includes(filterArea))
    : attorneys;
  const sorted = [...filtered].sort((a, b) =>
    userLoc
      ? dist(a, userLoc) - dist(b, userLoc)
      : b.reputation - a.reputation,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 58px)", position: "relative", overflow: "hidden" }}>

      {/* ── Top Waze-style search bar ── */}
      <div style={{
        position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
        zIndex: 1001, display: "flex", gap: 8, alignItems: "center",
        background: "rgba(20,20,26,0.96)", border: "1px solid #D4AF3755",
        borderRadius: 28, padding: "6px 12px", backdropFilter: "blur(16px)",
        boxShadow: "0 4px 24px #000c",
        width: "min(500px, calc(100vw - 24px))",
      }}>
        <span style={{ fontSize: 18 }}>⚖️</span>
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          style={{
            flex: 1, background: "transparent", border: "none",
            color: "#D4AF37", fontWeight: 700, fontSize: 14, outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">כל התחומים — {filtered.length} עורכי דין</option>
          {PRACTICE_AREAS.map((a) => (
            <option key={a.key} value={a.key}>{a.icon} {a.label}</option>
          ))}
        </select>
        <button
          onClick={locateMe}
          title="הראה אותי"
          style={{
            background: userLoc ? "#D4AF3722" : "transparent",
            border: `1px solid ${userLoc ? "#D4AF37" : "#555"}`,
            borderRadius: 20, padding: "4px 10px", color: "#D4AF37",
            cursor: "pointer", fontSize: 18,
          }}
        >📍</button>
      </div>

      {/* ── Map canvas ── */}
      <div ref={mapEl} style={{ flex: 1, width: "100%" }} />

      {/* ── Floating attorney card (selected) ── */}
      {selected && (
        <div style={{
          position: "absolute",
          bottom: BOTTOM_H + 16,
          left: "50%", transform: "translateX(-50%)",
          zIndex: 1002, width: "min(480px, calc(100vw - 24px))",
          animation: "slideUp .2s ease",
        }}>
          <AttyCard
            atty={selected}
            isConn={connected.has(selected.id) || connPending.has(selected.id)}
            connLabel={connected.has(selected.id) ? "✓ מחובר" : connPending.has(selected.id) ? "⏳ ממתין" : null}
            userLoc={userLoc}
            onConnect={() => connect(selected.id)}
            onFocus={() => mapRef.current?.flyTo([selected.lat, selected.lng], 15)}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      {/* ── Bottom drawer (Waze-style cards strip) ── */}
      <div style={{
        height: BOTTOM_H, flexShrink: 0,
        background: "rgba(16,16,20,0.97)",
        borderTop: "1px solid #2a2a2e",
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center",
        gap: 10, padding: "0 14px",
        overflowX: "auto", overflowY: "hidden",
      }}>
        {loading ? (
          <span className="spinner" style={{ margin: "0 auto" }} />
        ) : sorted.length === 0 ? (
          <p className="muted" style={{ margin: "0 auto", fontSize: 13 }}>אין עורכי דין בסינון זה</p>
        ) : (
          <>
            {/* "Near me" label */}
            <div style={{ flexShrink: 0, textAlign: "center", paddingInlineEnd: 8, borderInlineEnd: "1px solid #333" }}>
              <div style={{ fontSize: 20 }}>🗺</div>
              <div className="muted" style={{ fontSize: 10, whiteSpace: "nowrap" }}>
                {userLoc ? "קרוב אליך" : "לפי מוניטין"}
              </div>
            </div>
            {sorted.map((a) => (
              <MiniCard
                key={a.id}
                atty={a}
                userLoc={userLoc}
                active={selected?.id === a.id}
                onClick={() => {
                  setSelected(a);
                  mapRef.current?.flyTo([a.lat, a.lng], 14, { animate: true });
                }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const BOTTOM_H = 148;

// ── Attorney card (floating popup) ────────────────────────────────────────────
function AttyCard({ atty, isConn, connLabel, userLoc, onConnect, onFocus, onClose }: {
  atty: AttyEntry;
  isConn: boolean; connLabel: string | null;
  userLoc: [number, number] | null;
  onConnect: () => void; onFocus: () => void; onClose: () => void;
}) {
  const rp = rankFor(atty.reputation);
  const color = areaColor(atty.practice_areas);
  const km = userLoc ? dist(atty, userLoc).toFixed(1) : null;

  return (
    <div style={{
      background: "rgba(22,22,28,0.98)",
      border: `1.5px solid ${color}`,
      borderRadius: 18,
      padding: 16,
      boxShadow: `0 8px 32px #000c, 0 0 24px ${color}22`,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar name={atty.name} size={50} verified={atty.verified} url={atty.avatar_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>
            {atty.name || "עו״ד אנונימי"}
            {atty.demo && <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> · להמחשה</span>}
          </div>
          <div style={{ color, fontSize: 12, fontWeight: 700, marginTop: 1 }} dir="ltr">
            {rp.rank.icon} {rp.rank.title} · {atty.reputation} מוניטין
          </div>
          {atty.experience_tier && (
            <div className="muted" style={{ fontSize: 12 }}>{EXPERIENCE_LABELS[atty.experience_tier]}</div>
          )}
          {atty.jurisdiction && (
            <div className="muted" style={{ fontSize: 12 }}>
              {JURISDICTION_LABELS[atty.jurisdiction] ?? atty.jurisdiction}
              {km && <> · <span style={{ color }}>~{km} ק"מ</span></>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={onFocus} title="מרכז במפה"
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>🎯</button>
          <button onClick={onClose} title="סגור"
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#666", lineHeight: 1 }}>✕</button>
        </div>
      </div>

      {atty.headline && (
        <p className="muted" style={{ fontSize: 13, margin: "10px 0 0", lineHeight: 1.5 }}>{atty.headline}</p>
      )}

      <div className="chip-select" style={{ marginTop: 10 }}>
        {atty.practice_areas.slice(0, 4).map((k) => (
          <span key={k} className="chip" style={{ borderColor: color, color, fontSize: 11 }}>
            {PRACTICE_AREA_LABELS[k] ?? k}
          </span>
        ))}
      </div>

      {!atty.demo && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            className="btn btn-gold" style={{ flex: 1 }}
            disabled={isConn}
            onClick={onConnect}
          >
            {connLabel ?? "🤝 בקש שיתוף פעולה"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Mini card in the bottom strip ────────────────────────────────────────────
function MiniCard({ atty, userLoc, active, onClick }: {
  atty: AttyEntry; userLoc: [number, number] | null;
  active: boolean; onClick: () => void;
}) {
  const color = areaColor(atty.practice_areas);
  const km = userLoc ? dist(atty, userLoc).toFixed(1) : null;
  return (
    <div
      onClick={onClick}
      style={{
        flexShrink: 0, width: 130, padding: "10px 12px", borderRadius: 14,
        background: active ? `${color}18` : "rgba(30,30,36,0.9)",
        border: `1.5px solid ${active ? color : "#2a2a2e"}`,
        cursor: "pointer", transition: "all .18s",
        boxShadow: active ? `0 0 16px ${color}44` : "none",
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: color, marginBottom: 6,
        boxShadow: `0 0 6px ${color}`,
      }} />
      <div style={{
        fontWeight: 700, fontSize: 13, color: active ? color : "#eee",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {atty.name?.split(" ").slice(-1)[0] ?? "עו״ד"}
      </div>
      <div style={{ fontSize: 11, color: color + "cc", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {PRACTICE_AREA_LABELS[atty.practice_areas[0]] ?? "—"}
      </div>
      {km
        ? <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>~{km} ק"מ</div>
        : <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>{atty.reputation} מוניטין</div>
      }
    </div>
  );
}

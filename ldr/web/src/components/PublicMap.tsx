import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase, PRACTICE_AREA_LABELS, EXPERIENCE_LABELS } from "../lib/supabase";
import { useI18n } from "../i18n";

// ── Live 3D vector map (MapLibre + free OpenFreeMap tiles): tilted city view
// with real building extrusions, attorney face pins with a seniority ring,
// and a live-activity ticker so the map feels alive. Centred on the country
// the connected user belongs to (default Israel). Tap a pin → card with
// profile / chat / book-a-meeting. ──

// Free, key-less vector style with 3D buildings.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const CLAY = "#D97757";
const LEVEL_COLOR: Record<string, string> = { junior: "#6E9E8E", mid: "#C99A3F", senior: "#D97757" };
const levelColor = (tier: string | null) => LEVEL_COLOR[tier ?? "mid"] ?? CLAY;
const LEGEND = [
  { tier: "senior", key: "level.senior" },
  { tier: "mid", key: "level.mid" },
  { tier: "junior", key: "level.junior" },
];
const COUNTRY_CENTER: Record<string, [number, number, number]> = {
  IL: [31.9, 34.9, 8], US: [39.5, -98.3, 4], UK: [54.0, -2.5, 6],
  DE: [51.2, 10.4, 6], FR: [46.6, 2.4, 6], CA: [56.1, -106, 4],
};
const CURRENCY: Record<string, string> = { IL: "₪", US: "$", UK: "£", DE: "€", FR: "€", CA: "$" };
// Rough IL region from coordinates.
function regionOf(lat: number, lng: number): string {
  if (lat >= 32.5) return "north";
  if (lat <= 31.55) return "south";
  if (lng >= 35.0 && lat <= 31.95) return "jerusalem";
  return "center";
}
const REGIONS = ["all", "center", "jerusalem", "north", "south"];
// Map filter chips → which practice-area keys they include.
const SPEC_FILTERS: { key: string; label: string; areas: string[] }[] = [
  { key: "commercial", label: "spec.commercial", areas: ["commercial", "corporate_vc", "banking"] },
  { key: "criminal", label: "spec.criminal", areas: ["criminal", "litigation"] },
  { key: "family", label: "spec.family", areas: ["family", "mediation"] },
  { key: "realestate", label: "spec.realestate", areas: ["real_estate", "urban_renewal"] },
];

interface Pin {
  id: string; name: string; lat: number; lng: number; jurisdiction: string;
  areas: string[]; reputation: number; avatar_url: string | null; tier: string | null; rate: number | null;
  quickBook: boolean; consultOnly: boolean;
}
type Panel = { kind: "chat" | "schedule" | "profile"; pin: Pin } | null;

export default function PublicMap() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const markerEls = useRef<Record<string, HTMLElement>>({});
  const allPins = useRef<Pin[]>([]);
  const visiblePins = useRef<Pin[]>([]);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [country, setCountry] = useState("IL");
  const [countries, setCountries] = useState<string[]>(["IL"]);
  const [selected, setSelected] = useState<Pin | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [quickOnly, setQuickOnly] = useState(false);
  const [consultOnly, setConsultOnly] = useState(false);
  const [region, setRegion] = useState("all");
  const [tilted, setTilted] = useState(true);
  const [activity, setActivity] = useState<{ name: string; verb: string } | null>(null);
  const { t } = useI18n();

  // Init map + load data once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("ldr_demo_attorneys")
        .select("id,display_name,lat,lng,jurisdiction,practice_areas,reputation,avatar_url,experience_tier,hourly_rate,quick_book,consultation_only")
        .not("lat", "is", null);
      if (cancelled || !el.current || map.current) return;

      // Default to the connected user's country (license / jurisdiction), then
      // their last choice, then Israel.
      let initial = localStorage.getItem("lawdin_country") || "IL";
      try {
        const { data: ures } = await supabase.auth.getUser();
        if (ures?.user) {
          const { data: prof } = await supabase.from("ldr_profiles")
            .select("jurisdiction,license_country").eq("id", ures.user.id).maybeSingle();
          const jc = (prof as any)?.license_country || (prof as any)?.jurisdiction;
          if (jc) initial = jc;
        }
      } catch { /* anonymous visitor — keep default */ }
      if (cancelled) return;

      const c = COUNTRY_CENTER[initial] ?? COUNTRY_CENTER.IL;
      const m = new maplibregl.Map({
        container: el.current,
        style: MAP_STYLE,
        center: [c[1], c[0]], zoom: c[2], pitch: 50, bearing: -14,
        attributionControl: false, dragRotate: true,
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-left");
      m.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "© OpenFreeMap © OpenMapTiles © OSM" }), "bottom-right");
      m.on("click", () => setSelected(null));
      map.current = m;

      allPins.current = ((data ?? []) as any[]).map((r) => ({
        id: r.id, name: r.display_name, lat: r.lat, lng: r.lng, jurisdiction: r.jurisdiction ?? "IL",
        areas: r.practice_areas ?? [], reputation: r.reputation, avatar_url: r.avatar_url, tier: r.experience_tier, rate: r.hourly_rate ?? null,
        quickBook: !!r.quick_book, consultOnly: !!r.consultation_only,
      }));
      const present = Array.from(new Set(allPins.current.map((p) => p.jurisdiction)));
      const ordered = ["IL", "US", "UK", "DE", "FR", "CA"].filter((cc) => present.includes(cc));
      setCountries(ordered.length ? ordered : present);
      setCountry(initial);
      m.on("load", () => { if (!cancelled) setReady(true); });
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  // Re-render markers when filters change.
  useEffect(() => {
    if (!ready || !map.current) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    markerEls.current = {};
    setSelected(null);
    const q = query.trim().toLowerCase();
    const specAreas = areaFilter ? (SPEC_FILTERS.find((s) => s.key === areaFilter)?.areas ?? []) : null;
    const pins = allPins.current.filter((p) => {
      if (p.jurisdiction !== country) return false;
      if (country === "IL" && region !== "all" && regionOf(p.lat, p.lng) !== region) return false;
      if (quickOnly && !p.quickBook) return false;
      if (consultOnly && !p.consultOnly) return false;
      if (specAreas && !p.areas.some((a) => specAreas.includes(a))) return false;
      if (q) {
        const hay = (p.name + " " + p.areas.map((a) => PRACTICE_AREA_LABELS[a] ?? a).join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    visiblePins.current = pins;
    setCount(pins.length);
    pins.forEach((p, i) => {
      const ring = levelColor(p.tier);
      const face = p.avatar_url
        ? `background-image:url('${p.avatar_url}');background-size:cover;background-position:center;`
        : `background:${ring};`;
      const online = i % 3 !== 2 ? `<span class="lawpin-online"></span>` : "";
      const elm = document.createElement("div");
      elm.className = "lawpin";
      elm.innerHTML = `<div class="lawpin-face" style="${face}box-shadow:0 0 0 3px ${ring},0 6px 16px rgba(0,0,0,.28);"></div>${online}<div class="lawpin-stem"></div>`;
      elm.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected(p); setPanel(null);
        map.current?.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.current.getZoom(), 12.5), duration: 700 });
      });
      const mk = new maplibregl.Marker({ element: elm, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map.current!);
      markers.current.push(mk);
      markerEls.current[p.id] = elm;
    });
    if (pins.length) {
      const b = new maplibregl.LngLatBounds();
      pins.forEach((p) => b.extend([p.lng, p.lat]));
      map.current.fitBounds(b, { padding: 80, maxZoom: 13.5, duration: 900 });
    } else {
      const c = COUNTRY_CENTER[country]; if (c) map.current.flyTo({ center: [c[1], c[0]], zoom: c[2], duration: 900 });
    }
  }, [country, ready, query, areaFilter, quickOnly, consultOnly, region]);

  // Tilt toggle — flatten ↔ 3D city view.
  useEffect(() => {
    map.current?.easeTo({ pitch: tilted ? 50 : 0, bearing: tilted ? -14 : 0, duration: 600 });
  }, [tilted]);

  // Live-activity ticker — periodically surface a random visible attorney with
  // a green "ping" on their pin, so the map reads as live and busy.
  useEffect(() => {
    if (!ready) return;
    const VERBS = ["map.live.online", "map.live.available", "map.live.replied", "map.live.joined"];
    let vi = 0;
    const id = window.setInterval(() => {
      const pool = visiblePins.current;
      if (!pool.length) return;
      const p = pool[(vi * 7 + 3) % pool.length];
      vi += 1;
      setActivity({ name: p.name, verb: t(VERBS[vi % VERBS.length]) });
      const elm = markerEls.current[p.id];
      if (elm) { elm.classList.add("lawpin-ping"); window.setTimeout(() => elm.classList.remove("lawpin-ping"), 2400); }
      window.setTimeout(() => setActivity(null), 3200);
    }, 4200);
    return () => window.clearInterval(id);
  }, [ready, t]);

  const rating = (rep: number) => (Math.min(5, 3.8 + rep / 1500)).toFixed(1);

  return (
    <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", border: "1px solid #E8E5DD", boxShadow: "0 12px 40px rgba(31,30,29,0.12)", height: 480, background: "#eef0ea" }}>
      <div ref={el} role="application" aria-label="מפת מיקומי עורכי דין" style={{ position: "absolute", inset: 0 }} />

      {/* Top controls: search + country + filter */}
      <div style={{ position: "absolute", top: 14, insetInline: 14, zIndex: 600, display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span className="ms" style={{ position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)", color: "#707884" }}>search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("map.search")} style={{ width: "100%", height: 48, paddingInline: "44px 16px", borderRadius: 16, border: "2px solid transparent", background: "rgba(255,255,255,.97)", boxShadow: "0 8px 24px rgba(31,30,29,.12)", fontFamily: "inherit", fontSize: 14, outline: "none" }} />
        </div>
        <select value={country} onChange={(e) => { setCountry(e.target.value); try { localStorage.setItem("lawdin_country", e.target.value); } catch { /* ignore */ } }} aria-label={t("map.country")}
          style={{ height: 48, borderRadius: 16, border: "none", background: "rgba(255,255,255,.97)", boxShadow: "0 8px 24px rgba(31,30,29,.12)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, padding: "0 12px", cursor: "pointer", color: "#1F1E1D" }}>
          {countries.map((c) => <option key={c} value={c}>{t("c." + c)}</option>)}
        </select>
        <button onClick={() => setFilterOpen(true)} aria-label="פילטרים" style={{ height: 48, width: 48, border: "none", borderRadius: 16, background: (areaFilter || consultOnly) ? CLAY : "#fff", color: (areaFilter || consultOnly) ? "#fff" : "#1F1E1D", display: "grid", placeItems: "center", boxShadow: "0 8px 24px rgba(31,30,29,.12)", cursor: "pointer" }}>
          <span className="ms">tune</span>
        </button>
      </div>

      {/* Quick-connect chip — fast path, especially for clients */}
      <button onClick={() => setQuickOnly((v) => !v)}
        style={{ position: "absolute", top: 72, insetInlineStart: 14, zIndex: 600, display: "flex", alignItems: "center", gap: 7, border: "none", borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(31,30,29,.12)", background: quickOnly ? CLAY : "rgba(255,255,255,.96)", color: quickOnly ? "#fff" : "#1F1E1D" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} /> ⚡ {t("map.quickConnect")}
      </button>

      {/* Count chip */}
      <div style={{ position: "absolute", top: 74, insetInlineStart: "50%", transform: "translateX(-50%)", zIndex: 600, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.96)", border: "1px solid #E8E5DD", borderRadius: 999, padding: "6px 14px", boxShadow: "0 4px 16px rgba(31,30,29,.1)", fontSize: 13, fontWeight: 700, color: CLAY, whiteSpace: "nowrap" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} /> ⚖️ {count} {t("map.count")}
      </div>

      {/* Tilt toggle — 3D city view ↔ flat */}
      <button onClick={() => setTilted((v) => !v)} aria-label={t("map.tilt")} title={t("map.tilt")}
        style={{ position: "absolute", top: 72, insetInlineEnd: 14, zIndex: 600, height: 38, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, border: "none", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, boxShadow: "0 4px 16px rgba(31,30,29,.12)", background: tilted ? CLAY : "rgba(255,255,255,.96)", color: tilted ? "#fff" : "#1F1E1D" }}>
        <span className="ms" style={{ fontSize: 18 }}>deployed_code</span>3D
      </button>

      {/* Live-activity ticker — makes the map feel alive */}
      {activity && (
        <div style={{ position: "absolute", bottom: 14, insetInlineStart: 14, zIndex: 640, display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,.97)", border: "1px solid #E8E5DD", borderRadius: 999, padding: "8px 14px", boxShadow: "0 8px 24px rgba(31,30,29,.16)", fontSize: 13, maxWidth: "70%", animation: "fadeUp .3s ease both" }}>
          <span className="lawpin-online" style={{ position: "static", width: 9, height: 9 }} />
          <span style={{ fontWeight: 700, color: "#1F1E1D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activity.name}</span>
          <span style={{ color: "#6B6862", whiteSpace: "nowrap" }}>{activity.verb}</span>
        </div>
      )}

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 14, insetInlineEnd: 14, zIndex: 600, background: "rgba(255,255,255,.96)", border: "1px solid #E8E5DD", borderRadius: 14, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 16px rgba(31,30,29,.1)" }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: "#3f4753" }}>{t("map.tenure")}</div>
        {LEGEND.map((l) => (
          <div key={l.tier} style={{ display: "flex", alignItems: "center", gap: 7, color: "#3f4753", marginTop: 3 }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: LEVEL_COLOR[l.tier], boxShadow: `0 0 6px ${LEVEL_COLOR[l.tier]}` }} />{t(l.key)}
          </div>
        ))}
      </div>

      {/* Lawyer card */}
      {selected && !panel && (
        <div style={{ position: "absolute", bottom: 16, insetInline: 16, zIndex: 650, background: "#fff", borderRadius: 24, padding: 16, boxShadow: "0 16px 48px rgba(31,30,29,.22)", display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 76, height: 76, borderRadius: 18, overflow: "hidden", flexShrink: 0, background: "#E8E5DD" }}>
            {selected.avatar_url && <img src={selected.avatar_url} alt={selected.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <h3 className="font-headline" style={{ margin: 0, fontSize: 17, color: "#1F1E1D" }}>{selected.name}</h3>
              <span style={{ display: "flex", alignItems: "center", gap: 3, background: "#fdf3e7", color: "#b45309", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 13 }}>
                <span className="ms" style={{ fontSize: 16, color: "#f59e0b", fontVariationSettings: "'FILL' 1" }}>star</span>{rating(selected.reputation)}
              </span>
            </div>
            <p style={{ color: "#6B6862", fontSize: 13, margin: "3px 0 8px" }}>
              {PRACTICE_AREA_LABELS[selected.areas?.[0]] ?? "עו״ד"} · {EXPERIENCE_LABELS[selected.tier as keyof typeof EXPERIENCE_LABELS] ?? ""}
            </p>
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 4, background: "#fdf3e7", color: "#b45309", padding: "3px 10px", borderRadius: 999, fontWeight: 800, fontSize: 14, marginBottom: 10 }}>
              {selected.rate != null
                ? (<>{CURRENCY[selected.jurisdiction] ?? "₪"}{selected.rate}<span style={{ fontSize: 11, fontWeight: 600, color: "#6B6862" }}>{t("map.perHour")}</span></>)
                : (<span style={{ fontSize: 13 }}>{t("map.byAgreement")}</span>)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPanel({ kind: "profile", pin: selected })} style={{ flex: 1, border: "1px solid #E8E5DD", padding: "10px", borderRadius: 12, background: "#fff", color: "#1F1E1D", fontWeight: 700, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>{t("map.viewProfile")}</button>
              <button onClick={() => setPanel({ kind: "chat", pin: selected })} style={{ flex: 1, border: "1px solid #E8E5DD", padding: "10px", borderRadius: 12, background: "#fff", color: "#1F1E1D", fontWeight: 700, fontFamily: "inherit", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><span className="ms" style={{ fontSize: 17 }}>chat_bubble</span>{t("map.chat")}</button>
              <button onClick={() => setPanel({ kind: "schedule", pin: selected })} style={{ flex: 1.3, border: "none", padding: "10px", borderRadius: 12, background: CLAY, color: "#fff", fontWeight: 700, fontFamily: "inherit", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><span className="ms" style={{ fontSize: 17 }}>event</span>{t("map.schedule")}</button>
            </div>
          </div>
          <button onClick={() => setSelected(null)} aria-label="סגירה" style={{ position: "absolute", top: -12, insetInlineEnd: -12, width: 30, height: 30, borderRadius: "50%", background: "#fff", border: "1px solid #E8E5DD", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(31,30,29,.1)" }}>
            <span className="ms" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {panel?.kind === "chat" && <ChatPanel pin={panel.pin} onClose={() => setPanel(null)} t={t} />}
      {panel?.kind === "schedule" && <SchedulePanel pin={panel.pin} onClose={() => setPanel(null)} t={t} />}
      {panel?.kind === "profile" && (
        <ProfileCardPanel pin={panel.pin} onClose={() => setPanel(null)}
          onChat={() => setPanel({ kind: "chat", pin: panel.pin })}
          onSchedule={() => setPanel({ kind: "schedule", pin: panel.pin })} t={t} />
      )}

      {/* Filter drawer */}
      {filterOpen && (
        <>
          <div onClick={() => setFilterOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 700, background: "rgba(0,0,0,.25)" }} />
          <div style={{ position: "absolute", insetInline: 0, bottom: 0, zIndex: 701, background: "rgba(255,255,255,.98)", borderRadius: "24px 24px 0 0", padding: "16px 18px 22px", boxShadow: "0 -10px 40px rgba(0,0,0,.2)" }}>
            <div style={{ width: 46, height: 5, background: "#E8E5DD", borderRadius: 999, margin: "0 auto 16px" }} />
            <h2 className="font-headline" style={{ margin: "0 0 16px", fontSize: 20, color: "#1F1E1D" }}>{t("filter.title")}</h2>
            {country === "IL" && (
              <>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#6B6862", margin: "0 0 10px" }}>{t("filter.region")}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {REGIONS.map((rg) => (
                    <button key={rg} onClick={() => setRegion(rg)} style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: region === rg ? CLAY : "#F2F0E9", color: region === rg ? "#fff" : "#3f4753", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>{t("reg." + rg)}</button>
                  ))}
                </div>
              </>
            )}
            <p style={{ fontWeight: 700, fontSize: 13, color: "#6B6862", margin: "0 0 10px" }}>{t("filter.specialization")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[{ key: null, i: "apps", l: t("filter.all") }, ...SPEC_FILTERS.map((s) => ({ key: s.key, i: { commercial: "corporate_fare", criminal: "gavel", family: "family_restroom", realestate: "home_work" }[s.key]!, l: t(s.label) }))].map((s) => {
                const on = areaFilter === s.key;
                return (
                  <button key={s.key ?? "all"} onClick={() => setAreaFilter(s.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, background: "#F2F0E9", border: `2px solid ${on ? CLAY : "transparent"}`, color: on ? CLAY : "#1F1E1D", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>
                    <span className="ms">{s.i}</span>{s.l}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setConsultOnly((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 12, padding: 14, borderRadius: 16, background: consultOnly ? "#fdf3e7" : "#F2F0E9", border: `2px solid ${consultOnly ? CLAY : "transparent"}`, color: "#1F1E1D", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>
              <span>{t("filter.consultation")}</span>
              <span className="ms" style={{ color: consultOnly ? CLAY : "#bfc7d5" }}>{consultOnly ? "toggle_on" : "toggle_off"}</span>
            </button>
            <button onClick={() => setFilterOpen(false)} style={{ width: "100%", padding: 15, marginTop: 18, border: "none", borderRadius: 16, background: CLAY, color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "inherit", cursor: "pointer" }}>{t("filter.apply")}</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Direct chat panel ──
function ChatPanel({ pin, onClose, t }: { pin: Pin; onClose: () => void; t: (k: string) => string }) {
  const [msgs, setMsgs] = useState<{ me: boolean; text: string }[]>([{ me: false, text: t("chat.hello") }]);
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { me: true, text: text.trim() }]);
    // Persist outgoing message for authenticated users (best-effort).
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) supabase.from("ldr_messages").insert({ sender_id: data.user.id, recipient_ref: pin.id, recipient_name: pin.name, body: text.trim() });
    }).catch(() => {});
    setText("");
  };
  return (
    <div style={{ position: "absolute", bottom: 16, insetInline: 16, zIndex: 660, background: "#fff", borderRadius: 22, boxShadow: "0 16px 48px rgba(31,30,29,.22)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 360 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderBottom: "1px solid #E8E5DD" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#E8E5DD" }}>{pin.avatar_url && <img src={pin.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{t("chat.with")} {pin.name}</div>
        <button onClick={onClose} aria-label="סגירה" style={{ border: "none", background: "none", cursor: "pointer", color: "#6B6862" }}><span className="ms">close</span></button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8, minHeight: 120 }}>
        {msgs.map((mm, i) => (
          <div key={i} style={{ alignSelf: mm.me ? "flex-start" : "flex-end", maxWidth: "75%", background: mm.me ? CLAY : "#F2F0E9", color: mm.me ? "#fff" : "#1F1E1D", padding: "8px 12px", borderRadius: 14, fontSize: 14 }}>{mm.text}</div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #E8E5DD" }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t("chat.placeholder")} style={{ flex: 1, border: "1px solid #E8E5DD", borderRadius: 12, padding: "10px 12px", fontFamily: "inherit", fontSize: 14, outline: "none" }} />
        <button onClick={send} style={{ border: "none", background: CLAY, color: "#fff", borderRadius: 12, padding: "0 16px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>{t("chat.send")}</button>
      </div>
    </div>
  );
}

// ── Schedule-a-meeting panel (availability-based) ──
function SchedulePanel({ pin, onClose, t }: { pin: Pin; onClose: () => void; t: (k: string) => string }) {
  const [day, setDay] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const days = Array.from({ length: 5 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const times = ["10:00", "12:00", "14:00", "16:00"];
  const fmt = (d: Date) => d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
  return (
    <div style={{ position: "absolute", bottom: 16, insetInline: 16, zIndex: 660, background: "#fff", borderRadius: 22, boxShadow: "0 16px 48px rgba(31,30,29,.22)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#E8E5DD" }}>{pin.avatar_url && <img src={pin.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{t("sched.with")} {pin.name}</div>
        <button onClick={onClose} aria-label="סגירה" style={{ border: "none", background: "none", cursor: "pointer", color: "#6B6862" }}><span className="ms">close</span></button>
      </div>
      {booked ? (
        <div style={{ textAlign: "center", padding: "18px 8px" }}>
          <span className="ms" style={{ fontSize: 44, color: "#10b981", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p style={{ fontWeight: 700, margin: "8px 0 0" }}>{t("sched.booked")}</p>
          <p style={{ color: "#6B6862", fontSize: 13 }}>{fmt(days[day!])} · {time}</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "#6B6862", margin: "0 0 10px" }}>{t("sched.pick")}</p>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {days.map((d, i) => (
              <button key={i} onClick={() => setDay(i)} style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 12, border: `2px solid ${day === i ? CLAY : "#E8E5DD"}`, background: day === i ? "#fdf3e7" : "#fff", color: "#1F1E1D", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{fmt(d)}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
            {times.map((tm) => (
              <button key={tm} onClick={() => setTime(tm)} disabled={day === null} style={{ padding: "8px 16px", borderRadius: 12, border: `2px solid ${time === tm ? CLAY : "#E8E5DD"}`, background: time === tm ? "#fdf3e7" : "#fff", color: day === null ? "#bbb" : "#1F1E1D", fontWeight: 600, fontSize: 14, cursor: day === null ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{tm}</button>
            ))}
          </div>
          <button disabled={day === null || !time} onClick={() => {
            setBooked(true);
            supabase.auth.getUser().then(({ data }) => {
              if (data?.user && day !== null && time) supabase.from("ldr_meetings").insert({ requester_id: data.user.id, attorney_ref: pin.id, attorney_name: pin.name, meet_date: days[day].toISOString().slice(0, 10), meet_time: time, status: "requested" });
            }).catch(() => {});
          }} style={{ width: "100%", padding: 14, border: "none", borderRadius: 14, background: day !== null && time ? CLAY : "#E8E5DD", color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: "inherit", cursor: day !== null && time ? "pointer" : "not-allowed" }}>{t("sched.confirm")}</button>
        </>
      )}
    </div>
  );
}

// ── Rich public attorney profile (broad card people can learn from) ──
function ProfileCardPanel({ pin, onClose, onChat, onSchedule, t }: {
  pin: Pin; onClose: () => void; onChat: () => void; onSchedule: () => void; t: (k: string) => string;
}) {
  const ring = levelColor(pin.tier);
  const rating = Math.min(5, 3.8 + pin.reputation / 1500);
  const reviews = [
    { name: "★★★★★", text: t("prof.review1") },
    { name: "★★★★★", text: t("prof.review2") },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 680, background: "rgba(31,30,29,.35)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", insetInline: 0, bottom: 0, maxHeight: "92%", overflowY: "auto",
        background: "#fff", borderRadius: "24px 24px 0 0", boxShadow: "0 -16px 48px rgba(31,30,29,.25)",
      }}>
        {/* Header */}
        <div style={{ position: "relative", padding: "22px 18px 16px", borderBottom: "1px solid #E8E5DD" }}>
          <button onClick={onClose} aria-label="סגירה" style={{ position: "absolute", top: 14, insetInlineEnd: 14, width: 32, height: 32, borderRadius: "50%", border: "1px solid #E8E5DD", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><span className="ms">close</span></button>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 84, height: 84, borderRadius: "50%", overflow: "hidden", border: `3px solid ${ring}`, flexShrink: 0, background: "#E8E5DD" }}>
              {pin.avatar_url && <img src={pin.avatar_url} alt={pin.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div>
              <h2 className="font-headline" style={{ margin: 0, fontSize: 21, color: "#1F1E1D" }}>{pin.name}</h2>
              <p style={{ margin: "4px 0", color: "#6B6862", fontSize: 14 }}>{EXPERIENCE_LABELS[pin.tier as keyof typeof EXPERIENCE_LABELS] ?? ""} · {(t("c." + pin.jurisdiction) || "").replace(/^[^ ]+ /, "")}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#f59e0b", letterSpacing: 1 }}>{"★".repeat(Math.round(rating))}</span>
                <b style={{ fontSize: 14 }}>{rating.toFixed(1)}</b>
                <span style={{ color: "#6B6862", fontSize: 13 }}>({20 + (pin.reputation % 80)})</span>
              </div>
            </div>
          </div>
          {/* Price */}
          <div style={{ marginTop: 14, display: "inline-flex", alignItems: "baseline", gap: 4, background: "#fdf3e7", color: "#b45309", padding: "6px 14px", borderRadius: 999, fontWeight: 800, fontSize: 16 }}>
            {pin.rate != null
              ? (<>{CURRENCY[pin.jurisdiction] ?? "₪"}{pin.rate}<span style={{ fontSize: 12, fontWeight: 600, color: "#6B6862" }}>{t("map.perHour")}</span></>)
              : (<span style={{ fontSize: 14 }}>{t("map.byAgreement")}</span>)}
          </div>
        </div>

        <div style={{ padding: "16px 18px" }}>
          {/* About */}
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>{t("prof.about")}</h3>
          <p style={{ margin: "0 0 18px", color: "#3a3a38", fontSize: 14, lineHeight: 1.7 }}>{t("prof.bio")}</p>

          {/* Areas */}
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{t("prof.areas")}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {(pin.areas ?? []).map((a) => (
              <span key={a} style={{ background: "#eef4f1", color: "#3f6b5c", fontWeight: 600, fontSize: 13, padding: "5px 12px", borderRadius: 999 }}>{PRACTICE_AREA_LABELS[a] ?? a}</span>
            ))}
          </div>

          {/* Reviews */}
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{t("prof.reviews")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {reviews.map((r, i) => (
              <div key={i} style={{ background: "#F2F0E9", borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ color: "#f59e0b", fontSize: 13 }}>{r.name}</div>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: "#3a3a38" }}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sticky CTAs */}
        <div style={{ position: "sticky", bottom: 0, display: "flex", gap: 10, padding: 16, background: "#fff", borderTop: "1px solid #E8E5DD" }}>
          <button onClick={onChat} style={{ flex: 1, border: "1px solid #E8E5DD", padding: 13, borderRadius: 14, background: "#fff", color: "#1F1E1D", fontWeight: 700, fontFamily: "inherit", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><span className="ms" style={{ fontSize: 18 }}>chat_bubble</span>{t("map.chat")}</button>
          <button onClick={onSchedule} style={{ flex: 1.4, border: "none", padding: 13, borderRadius: 14, background: CLAY, color: "#fff", fontWeight: 700, fontFamily: "inherit", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><span className="ms" style={{ fontSize: 18 }}>event</span>{t("map.schedule")}</button>
        </div>
      </div>
    </div>
  );
}

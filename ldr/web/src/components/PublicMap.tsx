import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, PRACTICE_AREA_LABELS, EXPERIENCE_LABELS } from "../lib/supabase";
import { useI18n } from "../i18n";

// ── 2D raster map (Leaflet + free CartoDB tiles): Hebrew place labels are baked
// into the tiles (server-rendered, always correct, no RTL plugin needed), no API
// key, locked to Israel with a mask. Face pins, filters, and a live-activity
// ticker. Tap a pin → card with profile / chat / book-a-meeting. ──

// Free, key-less raster tiles with local (Hebrew) labels.
const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

const CLAY = "#D97757";
// Pin colour by legal specialization (matches the on-map legend).
const SPECS: { key: string; label: string; color: string; areas: string[] }[] = [
  { key: "realestate", label: "התחדשות עירונית", color: "#D97757", areas: ["real_estate", "urban_renewal", "planning_building"] },
  { key: "corporate", label: "מסחרי / חברות + AI", color: "#10b981", areas: ["commercial", "corporate_vc", "banking", "banking_finance", "tax"] },
  { key: "criminal", label: "פלילי / ליטיגציה", color: "#3b82f6", areas: ["criminal", "litigation", "admin_constitutional"] },
  { key: "family", label: "דיני משפחה", color: "#f59e0b", areas: ["family", "family_inheritance", "mediation", "adr"] },
];
const specColor = (areas: string[]): string => {
  const a = areas?.[0];
  for (const s of SPECS) if (s.areas.includes(a)) return s.color;
  return CLAY;
};
const CURRENCY: Record<string, string> = { IL: "₪", US: "$", UK: "£", DE: "€", FR: "€", CA: "$" };
// Israel-only view, grouped by city. Major cities with their centres; each pin
// is assigned to the nearest city (within ~18 km), else "other".
const IL_CENTER: [number, number, number] = [31.7, 34.9, 7.3];
// Lock the viewport to Israel (with a small margin) so only Israel is shown.
const IL_BOUNDS: [[number, number], [number, number]] = [[33.9, 29.2], [36.1, 33.6]];
// Simplified outline of Israel (lng,lat). Used as a hole in a world-covering
// mask so only Israel renders — neighbouring countries and their labels are
// hidden, keeping the map focused and free of off-topic political labels.
const ISRAEL_OUTLINE: [number, number][] = [
  [35.62, 33.28], [35.78, 33.23], [35.90, 32.68], [35.57, 32.38], [35.55, 31.76],
  [35.47, 31.49], [35.40, 31.10], [35.20, 30.60], [35.00, 30.10], [34.95, 29.55],
  [34.92, 30.40], [34.50, 30.90], [34.27, 31.22], [34.49, 31.59], [34.64, 31.85],
  [34.75, 32.08], [34.88, 32.45], [35.00, 32.83], [35.10, 33.08], [35.30, 33.10],
  [35.55, 33.24], [35.62, 33.28],
];
const IL_CITIES: { key: string; label: string; lat: number; lng: number }[] = [
  { key: "tlv", label: "תל אביב", lat: 32.0853, lng: 34.7818 },
  { key: "jlm", label: "ירושלים", lat: 31.7683, lng: 35.2137 },
  { key: "haifa", label: "חיפה", lat: 32.7940, lng: 34.9896 },
  { key: "rishon", label: "ראשון לציון", lat: 31.9730, lng: 34.7925 },
  { key: "petah", label: "פתח תקווה", lat: 32.0840, lng: 34.8878 },
  { key: "ramatgan", label: "רמת גן", lat: 32.0684, lng: 34.8248 },
  { key: "herzliya", label: "הרצליה", lat: 32.1624, lng: 34.8443 },
  { key: "netanya", label: "נתניה", lat: 32.3215, lng: 34.8532 },
  { key: "raanana", label: "רעננה", lat: 32.1848, lng: 34.8713 },
  { key: "kfarsaba", label: "כפר סבא", lat: 32.1750, lng: 34.9070 },
  { key: "modiin", label: "מודיעין", lat: 31.8980, lng: 35.0104 },
  { key: "ashdod", label: "אשדוד", lat: 31.8040, lng: 34.6550 },
  { key: "beersheva", label: "באר שבע", lat: 31.2518, lng: 34.7913 },
  { key: "nazareth", label: "נצרת", lat: 32.6996, lng: 35.3035 },
  { key: "eilat", label: "אילת", lat: 29.5577, lng: 34.9519 },
];
function cityOf(lat: number, lng: number): string {
  let best = "other", bestD = Infinity;
  for (const c of IL_CITIES) {
    const d = Math.hypot(lat - c.lat, lng - c.lng) * 111;
    if (d < bestD) { bestD = d; best = c.key; }
  }
  return bestD <= 18 ? best : "other";
}
const cityCenter = (key: string): [number, number, number] | null => {
  const c = IL_CITIES.find((x) => x.key === key);
  return c ? [c.lat, c.lng, 12] : null;
};
// Regions of Israel for the map filter card.
const REGIONS: { key: string; label: string }[] = [
  { key: "all", label: "כל הארץ" },
  { key: "center", label: "תל אביב והמרכז" },
  { key: "jerusalem", label: "ירושלים" },
  { key: "north", label: "חיפה והצפון" },
  { key: "south", label: "באר שבע והדרום" },
];
function regionOf(lat: number, lng: number): string {
  if (lat >= 32.5) return "north";
  if (lat <= 31.5) return "south";
  if (lng >= 34.95 && lat <= 32.0) return "jerusalem";
  return "center";
}
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
  quickBook: boolean; consultOnly: boolean; license?: string; demo?: boolean;
}

// Featured founder profile, always shown on the map (Bar member, Tel Aviv).
const FEATURED: Pin[] = [{
  id: "featured-lalum",
  name: "ד״ר אברהם ללום, עו״ד",
  lat: 32.0809, lng: 34.7806,
  jurisdiction: "IL",
  areas: ["real_estate", "urban_renewal", "commercial"],
  reputation: 2450, avatar_url: "https://i.pravatar.cc/200?img=12", tier: "senior", rate: null,
  quickBook: true, consultOnly: false, license: "43481",
}];

// Illustrative ("בטא") Israeli attorneys, dozens per city, so the general map
// shows a full bench of lawyers across every city. Real Israeli first names
// (women and men) with common surnames, gendered avatars, 5-digit Bar licences,
// and a clear "להמחשה" flag so a card never looks like a real credential.
const FEM_FIRST = [
  "דנה", "שירה", "נועה", "תמר", "ליאת", "הילה", "מאיה", "שני", "יעל", "רוני",
  "עדי", "מיכל", "אורית", "גלית", "סיגל", "ענת", "רותם", "אביגיל", "טל", "הדס",
  "נטע", "ספיר", "שירן", "ליהי", "אורלי",
];
const MASC_FIRST = [
  "יוסי", "מיכאל", "רונן", "אבי", "עומר", "איתי", "גיא", "דניאל", "אורי", "נדב",
  "עידו", "אסף", "ליאור", "עמית", "תומר", "יונתן", "ניר", "אלון", "שחר", "רועי",
  "בן", "איתמר", "יובל", "דור", "ערן",
];
const SURNAMES = [
  "לוי", "כהן", "פרידמן", "אזולאי", "מזרחי", "שפירא", "ביטון", "גולן", "נחמיאס", "חדד",
  "רוזן", "אלקיים", "שלום", "ברקוביץ׳", "פרץ", "דהן", "אוחיון", "בר־און", "אדרי", "מלכה",
  "אבוטבול", "סבן", "טל", "גבאי", "וקנין", "הראל", "שרון", "נחום", "עזרא", "יוספי",
];
const SPEC_SETS: string[][] = [
  ["real_estate", "urban_renewal"], ["urban_renewal", "planning_building"],
  ["criminal", "litigation"], ["litigation", "admin_constitutional"],
  ["family_inheritance", "adr"], ["family_inheritance", "litigation"],
  ["commercial", "corporate_vc"], ["corporate_vc", "banking_finance"],
  ["tax", "commercial"], ["labor", "litigation"],
];
const PER_CITY = 18; // dozens of attorneys per city

// Deterministic pseudo-random in [0,1) from an integer seed (no Math.random,
// so the bench is stable across renders and never reshuffles under the user).
const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

// Great-circle distance in km between two points (haversine), plus a friendly
// Hebrew label, so a card can show "distance from you" like a ride-hailing app.
function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} מ׳ ממך` : `${km.toFixed(1)} ק״מ ממך`;
}

const IL_DEMO: Pin[] = IL_CITIES.flatMap((c, ci) =>
  Array.from({ length: PER_CITY }, (_, j) => {
    const n = ci * 100 + j;
    const female = j % 2 === 0;
    const first = (female ? FEM_FIRST : MASC_FIRST)[(ci * 7 + j) % 25];
    const surname = SURNAMES[(ci * 5 + j) % SURNAMES.length];
    // Spread pins around the city centre on a small spiral (radius up to ~3.5 km).
    const ang = rnd(n) * Math.PI * 2;
    const rad = 0.006 + rnd(n + 1) * 0.026;
    // pravatar serves gendered portraits: 1..60 lean male, 61..70 are a mix; pick
    // a stable image per attorney, biasing women toward the higher band.
    const img = female ? 49 + ((ci * 3 + j) % 21) : 1 + ((ci * 4 + j) % 48);
    return {
      id: `demo-${c.key}-${j}`,
      name: `עו״ד ${first} ${surname}`,
      lat: c.lat + Math.sin(ang) * rad,
      lng: c.lng + Math.cos(ang) * rad,
      jurisdiction: "IL",
      areas: SPEC_SETS[(ci * 3 + j) % SPEC_SETS.length],
      reputation: 700 + Math.floor(rnd(n + 2) * 2100),
      avatar_url: `https://i.pravatar.cc/160?img=${img}`,
      tier: rnd(n + 3) > 0.6 ? "senior" : rnd(n + 3) > 0.25 ? "mid" : "junior",
      rate: 350 + Math.floor(rnd(n + 4) * 12) * 50,
      quickBook: rnd(n + 5) > 0.45,
      consultOnly: rnd(n + 6) > 0.7,
      license: String(20000 + Math.floor(rnd(n + 7) * 39999)),
      demo: true,
    } as Pin;
  })
);
type Panel = { kind: "chat" | "schedule" | "profile"; pin: Pin } | null;

export default function PublicMap() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);
  const markerEls = useRef<Record<string, HTMLElement>>({});
  const allPins = useRef<Pin[]>([]);
  const visiblePins = useRef<Pin[]>([]);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [regionCounts, setRegionCounts] = useState<Record<string, number>>({});
  const [cityCounts, setCityCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Pin | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [quickOnly, setQuickOnly] = useState(false);
  const [consultOnly, setConsultOnly] = useState(false);
  const [region, setRegion] = useState("all");
  const [city, setCity] = useState("all");
  const [activity, setActivity] = useState<{ name: string; verb: string } | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const { t } = useI18n();

  // Ask the client for their location once, so each card can show "distance from
  // you", like a ride-hailing app. Silent if denied; the card just omits the line.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  }, []);

  // Init map + load data once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Show everyone active in Israel: real app users (verified attorneys and
      // private clients with a location) merged with the Israeli illustrative set.
      const [{ data: demo }, { data: real }] = await Promise.all([
        supabase.from("ldr_demo_attorneys")
          .select("id,display_name,lat,lng,jurisdiction,practice_areas,reputation,avatar_url,experience_tier,hourly_rate,quick_book,consultation_only,license_no")
          .not("lat", "is", null),
        supabase.from("ldr_profiles")
          .select("id,display_name,lat,lng,jurisdiction,practice_areas,reputation,avatar_url,experience_tier,role,verification_status")
          .not("lat", "is", null)
          .or("verification_status.eq.verified,role.eq.client"),
      ]);
      if (cancelled || !el.current || map.current) return;

      const m = L.map(el.current, {
        center: [IL_CENTER[0], IL_CENTER[1]],
        zoom: IL_CENTER[2],
        minZoom: 7,
        zoomControl: false,
        attributionControl: false,
        maxBounds: L.latLngBounds([IL_BOUNDS[0][1], IL_BOUNDS[0][0]], [IL_BOUNDS[1][1], IL_BOUNDS[1][0]]),
        maxBoundsViscosity: 1,
      });
      L.tileLayer(TILE_URL, { subdomains: "abcd", maxZoom: 19, detectRetina: true, attribution: "© OpenStreetMap © CARTO" }).addTo(m);
      L.control.zoom({ position: "bottomleft" }).addTo(m);
      // Mask everything outside Israel so only Israel is visible (lat,lng rings).
      const outer: [number, number][] = [[-85, -180], [-85, 180], [85, 180], [85, -180]];
      const hole: [number, number][] = ISRAEL_OUTLINE.map(([lng, lat]) => [lat, lng]);
      L.polygon([outer, hole], { stroke: false, fillColor: "#e9ecf1", fillOpacity: 1, interactive: false }).addTo(m);
      m.on("click", () => setSelected(null));
      map.current = m;
      setTimeout(() => m.invalidateSize(), 0);

      const realPins: Pin[] = ((real ?? []) as any[]).map((r) => ({
        id: r.id, name: r.display_name ?? "עו״ד", lat: r.lat, lng: r.lng, jurisdiction: r.jurisdiction ?? "IL",
        areas: r.practice_areas ?? [], reputation: r.reputation ?? 0, avatar_url: r.avatar_url, tier: r.experience_tier, rate: null,
        quickBook: false, consultOnly: false,
      }));
      const demoPins: Pin[] = ((demo ?? []) as any[]).map((r) => ({
        id: r.id, name: r.display_name, lat: r.lat, lng: r.lng, jurisdiction: r.jurisdiction ?? "IL",
        areas: r.practice_areas ?? [], reputation: r.reputation ?? 0, avatar_url: r.avatar_url, tier: r.experience_tier, rate: r.hourly_rate ?? null,
        quickBook: !!r.quick_book, consultOnly: !!r.consultation_only, license: r.license_no ?? undefined, demo: true,
      }));
      // Israel only; real users first, then featured, then the (Israeli) demo set.
      // Use whichever illustrative bench is fuller: a curated DB set if it ever
      // grows past the bundled one, otherwise the bundled dozens-per-city bench.
      const demoSource = demoPins.length > IL_DEMO.length ? demoPins : IL_DEMO;
      allPins.current = [...FEATURED, ...realPins, ...demoSource].filter((p) => (p.jurisdiction || "IL") === "IL");
      const counts: Record<string, number> = {};
      const cc: Record<string, number> = {};
      allPins.current.forEach((p) => {
        const rk = regionOf(p.lat, p.lng); counts[rk] = (counts[rk] ?? 0) + 1;
        const ck = cityOf(p.lat, p.lng); cc[ck] = (cc[ck] ?? 0) + 1;
      });
      setRegionCounts(counts);
      setCityCounts(cc);
      if (!cancelled) setReady(true);
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
      // A specific city takes precedence; otherwise filter by region.
      if (city !== "all") { if (cityOf(p.lat, p.lng) !== city) return false; }
      else if (region !== "all" && regionOf(p.lat, p.lng) !== region) return false;
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
      const ring = specColor(p.areas);
      // Build the marker with DOM nodes (no innerHTML) so user-controlled names
      // and avatar URLs can never inject HTML/CSS (prevents stored XSS).
      const initials = (p.name || "עו״ד").replace(/^ד״ר\s*/, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("");
      const safeUrl = p.avatar_url && /^https?:\/\//i.test(p.avatar_url) ? p.avatar_url : null;
      const elm = document.createElement("div");
      elm.className = "lawpin";
      elm.setAttribute("role", "button");
      elm.title = p.name;
      const faceEl = document.createElement("div");
      faceEl.className = "lawpin-face";
      faceEl.style.boxShadow = `0 0 0 3px ${ring}, 0 6px 16px rgba(0,0,0,.28)`;
      if (safeUrl) {
        faceEl.style.backgroundImage = `url("${safeUrl.replace(/["\\]/g, "")}")`;
        faceEl.style.backgroundSize = "cover";
        faceEl.style.backgroundPosition = "center";
      } else {
        faceEl.style.background = ring;
        const ini = document.createElement("span");
        ini.className = "lawpin-initials";
        ini.textContent = initials;
        faceEl.appendChild(ini);
      }
      elm.appendChild(faceEl);
      if (i % 3 !== 2) {
        const dot = document.createElement("span");
        dot.className = "lawpin-online";
        elm.appendChild(dot);
      }
      const stem = document.createElement("div");
      stem.className = "lawpin-stem";
      elm.appendChild(stem);
      const nameEl = document.createElement("div");
      nameEl.className = "lawpin-name";
      nameEl.textContent = p.name;
      elm.appendChild(nameEl);
      const icon = L.divIcon({ html: elm, className: "", iconSize: [48, 72], iconAnchor: [24, 60] });
      const mk = L.marker([p.lat, p.lng], { icon }).addTo(map.current!);
      mk.on("click", () => {
        setSelected(p); setPanel(null);
        map.current?.setView([p.lat, p.lng], Math.max(map.current.getZoom(), 12), { animate: true });
      });
      markers.current.push(mk);
      markerEls.current[p.id] = elm;
    });
    const cc = city !== "all" ? cityCenter(city) : null;
    if (cc) {
      map.current.setView([cc[0], cc[1]], cc[2], { animate: true });
    } else if (pins.length) {
      map.current.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [60, 60], maxZoom: 13 });
    } else {
      map.current.setView([IL_CENTER[0], IL_CENTER[1]], IL_CENTER[2], { animate: true });
    }
  }, [ready, query, areaFilter, quickOnly, consultOnly, region, city]);

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
    <>
    {/* Region + city selectors (above the map): country → region → specific city */}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center", justifyContent: "flex-end" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#6B6862", marginInlineEnd: 4 }}>אזור:</span>
      {REGIONS.map((r) => (
        <button key={r.key} onClick={() => { setRegion(r.key); setCity("all"); }}
          style={{ padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: (region === r.key && city === "all") ? "#1A1A1A" : "#F2F0E9", color: (region === r.key && city === "all") ? "#fff" : "#3f4753" }}>
          {r.label}{regionCounts[r.key] ? ` (${regionCounts[r.key]})` : ""}
        </button>
      ))}
      <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="עיר"
        style={{ height: 36, borderRadius: 999, border: "none", background: city !== "all" ? "#1A1A1A" : "#F2F0E9", color: city !== "all" ? "#fff" : "#3f4753", fontFamily: "inherit", fontSize: 13, fontWeight: 700, padding: "0 14px", cursor: "pointer" }}>
        <option value="all">עיר ספציפית…</option>
        {IL_CITIES.filter((c) => cityCounts[c.key])
          .sort((a, b) => (cityCounts[b.key] ?? 0) - (cityCounts[a.key] ?? 0))
          .map((c) => <option key={c.key} value={c.key}>{c.label} ({cityCounts[c.key]})</option>)}
      </select>
    </div>
    <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", border: "1px solid #E8E5DD", boxShadow: "0 12px 40px rgba(31,30,29,0.12)", height: 480, background: "#eef0ea" }}>
      <div ref={el} role="application" aria-label="מפת מיקומי עורכי דין" style={{ position: "absolute", inset: 0 }} />

      {/* Top controls: search + country + filter */}
      <div style={{ position: "absolute", top: 14, insetInline: 14, zIndex: 600, display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span className="ms" style={{ position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)", color: "#707884" }}>search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("map.search")} style={{ width: "100%", height: 48, paddingInline: "44px 16px", borderRadius: 16, border: "2px solid transparent", background: "rgba(255,255,255,.97)", boxShadow: "0 8px 24px rgba(31,30,29,.12)", fontFamily: "inherit", fontSize: 14, outline: "none" }} />
        </div>
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

      {/* Live-activity ticker — makes the map feel alive */}
      {activity && (
        <div style={{ position: "absolute", bottom: 14, insetInlineStart: 14, zIndex: 640, display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,.97)", border: "1px solid #E8E5DD", borderRadius: 999, padding: "8px 14px", boxShadow: "0 8px 24px rgba(31,30,29,.16)", fontSize: 13, maxWidth: "70%", animation: "fadeUp .3s ease both" }}>
          <span className="lawpin-online" style={{ position: "static", width: 9, height: 9 }} />
          <span style={{ fontWeight: 700, color: "#1F1E1D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activity.name}</span>
          <span style={{ color: "#6B6862", whiteSpace: "nowrap" }}>{activity.verb}</span>
        </div>
      )}

      {/* Legend — by legal specialization */}
      <div style={{ position: "absolute", bottom: 14, insetInlineEnd: 14, zIndex: 600, background: "rgba(255,255,255,.96)", border: "1px solid #E8E5DD", borderRadius: 14, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 16px rgba(31,30,29,.1)" }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: "#3f4753" }}>סינון במפה</div>
        {SPECS.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 7, color: "#3f4753", marginTop: 3 }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: s.color, boxShadow: `0 0 6px ${s.color}` }} />{s.label}
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
            <p style={{ color: "#6B6862", fontSize: 13, margin: "3px 0 6px" }}>
              {PRACTICE_AREA_LABELS[selected.areas?.[0]] ?? "עו״ד"} · {EXPERIENCE_LABELS[selected.tier as keyof typeof EXPERIENCE_LABELS] ?? ""}
            </p>
            {userLoc && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#eef7ff", color: "#1d6fb8", padding: "2px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>
                <span className="ms" style={{ fontSize: 15 }}>near_me</span>{formatDistance(kmBetween(userLoc, { lat: selected.lat, lng: selected.lng }))}
              </div>
            )}
            {selected.license && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#6B6862" }} dir="rtl">רישיון לשכה: <span dir="ltr">{selected.license}</span></span>
                {selected.demo && <span style={{ fontSize: 10, fontWeight: 800, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", padding: "1px 7px", borderRadius: 999 }}>בטא · להמחשה</span>}
              </div>
            )}
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
          distance={userLoc ? formatDistance(kmBetween(userLoc, { lat: panel.pin.lat, lng: panel.pin.lng })) : null}
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
            <p style={{ fontWeight: 700, fontSize: 13, color: "#6B6862", margin: "0 0 10px" }}>אזור</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {REGIONS.map((r) => (
                <button key={r.key} onClick={() => { setRegion(r.key); setCity("all"); }} style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: (region === r.key && city === "all") ? CLAY : "#F2F0E9", color: (region === r.key && city === "all") ? "#fff" : "#3f4753", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>{r.label}{regionCounts[r.key] ? ` (${regionCounts[r.key]})` : ""}</button>
              ))}
            </div>
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
    </>
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
function ProfileCardPanel({ pin, onClose, onChat, onSchedule, distance, t }: {
  pin: Pin; onClose: () => void; onChat: () => void; onSchedule: () => void; distance?: string | null; t: (k: string) => string;
}) {
  const ring = specColor(pin.areas);
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
          {distance && (
            <div style={{ marginTop: 14, marginInlineStart: 8, display: "inline-flex", alignItems: "center", gap: 4, background: "#eef7ff", color: "#1d6fb8", padding: "6px 14px", borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
              <span className="ms" style={{ fontSize: 17 }}>near_me</span>{distance}
            </div>
          )}
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

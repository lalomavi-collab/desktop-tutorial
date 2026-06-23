import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, PRACTICE_AREA_LABELS, EXPERIENCE_LABELS } from "../lib/supabase";

// Three seniority levels → ring colour (Fiverr-style level signal).
const LEVEL_COLOR: Record<string, string> = {
  junior: "#6EC1E4",  // רמה 1
  mid: "#33CCFF",     // רמה 2
  senior: "#FFC83D",  // בכיר / Top
};
const levelColor = (tier: string | null) => LEVEL_COLOR[tier ?? "mid"] ?? "#33CCFF";

const LEGEND: { tier: string; label: string }[] = [
  { tier: "senior", label: "בכיר" },
  { tier: "mid", label: "מנוסה" },
  { tier: "junior", label: "מתחיל" },
];

interface Pin {
  id: string; name: string; lat: number; lng: number;
  areas: string[]; reputation: number; avatar_url: string | null; tier: string | null;
}

// Public, read-only Waze-style map for the landing: every attorney's location,
// shown as a FACE with a colour ring indicating seniority level.
export default function PublicMap() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("ldr_demo_attorneys")
        .select("id,display_name,lat,lng,practice_areas,reputation,avatar_url,experience_tier")
        .not("lat", "is", null);
      if (cancelled || !el.current || map.current) return;

      const m = L.map(el.current, {
        center: [31.7, 35.0], zoom: 7,
        zoomControl: false, attributionControl: false, scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 20,
      }).addTo(m);
      L.control.zoom({ position: "bottomright" }).addTo(m);
      map.current = m;

      const pins: Pin[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id, name: r.display_name, lat: r.lat, lng: r.lng,
        areas: r.practice_areas ?? [], reputation: r.reputation,
        avatar_url: r.avatar_url, tier: r.experience_tier,
      }));
      setCount(pins.length);
      const group: L.Layer[] = [];
      pins.forEach((p) => {
        const ring = levelColor(p.tier);
        const face = p.avatar_url
          ? `background-image:url('${p.avatar_url}');background-size:cover;background-position:center;`
          : `background:${ring};`;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:46px;height:46px;border-radius:50%;${face}
            border:3px solid ${ring};box-shadow:0 0 0 2px #0d1020,0 0 16px ${ring}cc,0 2px 8px #000a;"></div>`,
          iconSize: [46, 46], iconAnchor: [23, 23], popupAnchor: [0, -24],
        });
        const mk = L.marker([p.lat, p.lng], { icon }).addTo(m);
        mk.bindPopup(
          `<b>${p.name}</b><br/>${PRACTICE_AREA_LABELS[p.areas?.[0]] ?? ""}` +
          `<br/><span style="color:${ring}">${EXPERIENCE_LABELS[p.tier as keyof typeof EXPERIENCE_LABELS] ?? ""} · ${p.reputation} מוניטין</span>`,
        );
        group.push(mk);
      });
      if (group.length) {
        const fg = L.featureGroup(group as L.Marker[]);
        m.fitBounds(fg.getBounds().pad(0.25));
      }
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  return (
    <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", border: "1px solid var(--line)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
      <div ref={el} role="application" aria-label="מפת מיקומי עורכי דין ברשת"
        style={{ height: 380, width: "100%", background: "#0d1020" }} />

      {/* Floating count label */}
      <div style={{
        position: "absolute", top: 14, insetInlineStart: "50%", transform: "translateX(-50%)",
        zIndex: 500, display: "flex", alignItems: "center", gap: 8,
        background: "rgba(20,22,34,0.92)", border: "1px solid var(--line)",
        borderRadius: 999, padding: "7px 16px", backdropFilter: "blur(12px)",
        fontSize: 13, fontWeight: 700, color: "var(--gold)", whiteSpace: "nowrap",
      }}>
        <span className="conn-dot connected" /> ⚖️ {count} עורכי דין על המפה
      </div>

      {/* Level legend (Fiverr-style) */}
      <div style={{
        position: "absolute", bottom: 14, insetInlineStart: 14, zIndex: 500,
        display: "flex", flexDirection: "column", gap: 5,
        background: "rgba(20,22,34,0.9)", border: "1px solid var(--line)",
        borderRadius: 12, padding: "8px 12px", backdropFilter: "blur(12px)", fontSize: 11,
      }}>
        <span className="muted" style={{ fontWeight: 700, marginBottom: 2 }}>דרגת ותק</span>
        {LEGEND.map((l) => (
          <span key={l.tier} style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--cream-dim)" }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: LEVEL_COLOR[l.tier], boxShadow: `0 0 6px ${LEVEL_COLOR[l.tier]}` }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

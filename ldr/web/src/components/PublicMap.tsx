import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, PRACTICE_AREA_LABELS } from "../lib/supabase";

// Practice-area colour palette (Waze-style hazard colours).
const AREA_COLOR: Record<string, string> = {
  real_estate: "#33CCFF", urban_renewal: "#33CCFF", planning_building: "#33CCFF",
  commercial: "#4FC3F7", corporate_vc: "#4FC3F7", banking_finance: "#4FC3F7",
  litigation: "#EF5350", criminal: "#EF5350", admin_constitutional: "#EF5350",
  labor: "#AB47BC", ip: "#AB47BC", privacy_cyber: "#AB47BC",
  family_inheritance: "#66BB6A", adr: "#66BB6A", insurance_tort: "#66BB6A",
  tax: "#FF9800", insolvency: "#FF9800",
  regulation: "#26C6DA", energy_infra: "#26C6DA", environment: "#26C6DA",
};
const areaColor = (areas: string[]) => AREA_COLOR[areas?.[0]] ?? "#33CCFF";

interface Pin {
  id: string; name: string; lat: number; lng: number;
  areas: string[]; reputation: number; avatar_url: string | null;
}

// Public, read-only Waze-style map shown on the landing page: every attorney's
// location, visible before login. Uses demo attorneys (anon-readable).
export default function PublicMap() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("ldr_demo_attorneys")
        .select("id,display_name,lat,lng,practice_areas,reputation,avatar_url")
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
        areas: r.practice_areas ?? [], reputation: r.reputation, avatar_url: r.avatar_url,
      }));
      setCount(pins.length);
      const group: L.Layer[] = [];
      pins.forEach((p) => {
        const color = areaColor(p.areas);
        const face = p.avatar_url
          ? `background-image:url('${p.avatar_url}');background-size:cover;background-position:center;`
          : `background:${color};`;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:40px;height:40px;border-radius:50%;${face}
            border:3px solid ${color};box-shadow:0 0 14px ${color}aa,0 2px 8px #000a;"></div>`,
          iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -22],
        });
        const mk = L.marker([p.lat, p.lng], { icon }).addTo(m);
        mk.bindPopup(
          `<b>${p.name}</b><br/>${PRACTICE_AREA_LABELS[p.areas?.[0]] ?? ""}` +
          `<br/><span style="color:#33CCFF">${p.reputation} מוניטין</span>`,
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
      {/* Floating Waze-style label */}
      <div style={{
        position: "absolute", top: 14, insetInlineStart: "50%", transform: "translateX(-50%)",
        zIndex: 500, display: "flex", alignItems: "center", gap: 8,
        background: "rgba(20,22,34,0.92)", border: "1px solid var(--line)",
        borderRadius: 999, padding: "7px 16px", backdropFilter: "blur(12px)",
        fontSize: 13, fontWeight: 700, color: "var(--gold)", whiteSpace: "nowrap",
      }}>
        <span className="conn-dot connected" /> ⚖️ {count} עורכי דין על המפה
      </div>
    </div>
  );
}

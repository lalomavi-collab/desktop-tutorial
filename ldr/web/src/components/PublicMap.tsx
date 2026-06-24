import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, PRACTICE_AREA_LABELS, EXPERIENCE_LABELS } from "../lib/supabase";

// ── Stitch-style light map: every attorney's location as a face pin with a
// seniority-level ring + online dot; tap a pin for a floating lawyer card. ──

const LEVEL_COLOR: Record<string, string> = {
  junior: "#10b981",  // מתחיל
  mid: "#0061a5",     // מנוסה
  senior: "#f59e0b",  // בכיר
};
const levelColor = (tier: string | null) => LEVEL_COLOR[tier ?? "mid"] ?? "#0061a5";

const LEGEND = [
  { tier: "senior", label: "בכיר" },
  { tier: "mid", label: "מנוסה" },
  { tier: "junior", label: "מתחיל" },
];

const SPECIALIZATIONS = [
  { icon: "corporate_fare", label: "מסחרי" },
  { icon: "gavel", label: "פלילי" },
  { icon: "family_restroom", label: "משפחה" },
  { icon: "home_work", label: "נדל״ן" },
];

interface Pin {
  id: string; name: string; lat: number; lng: number;
  areas: string[]; reputation: number; avatar_url: string | null; tier: string | null;
}

export default function PublicMap() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState<Pin | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("ldr_demo_attorneys")
        .select("id,display_name,lat,lng,practice_areas,reputation,avatar_url,experience_tier")
        .not("lat", "is", null);
      if (cancelled || !el.current || map.current) return;

      const m = L.map(el.current, {
        center: [31.9, 34.85], zoom: 9,
        zoomControl: false, attributionControl: false, scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 20,
      }).addTo(m);
      map.current = m;
      m.on("click", () => setSelected(null));

      const pins: Pin[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id, name: r.display_name, lat: r.lat, lng: r.lng,
        areas: r.practice_areas ?? [], reputation: r.reputation,
        avatar_url: r.avatar_url, tier: r.experience_tier,
      }));
      setCount(pins.length);
      const group: L.Layer[] = [];
      pins.forEach((p, i) => {
        const ring = levelColor(p.tier);
        const face = p.avatar_url
          ? `background-image:url('${p.avatar_url}');background-size:cover;background-position:center;`
          : `background:${ring};`;
        const online = i % 3 !== 2
          ? `<div style="position:absolute;top:-2px;right:-2px;width:13px;height:13px;background:#10b981;border-radius:50%;border:2px solid #fff;"></div>` : "";
        const icon = L.divIcon({
          className: "",
          html: `<div style="position:relative;">
            <div style="width:48px;height:48px;border-radius:50%;${face}
              border:4px solid #fff;box-shadow:0 0 0 3px ${ring},0 6px 16px rgba(0,0,0,.25);"></div>${online}
            <div style="width:13px;height:13px;background:#fff;transform:rotate(45deg);margin:-6px auto 0;box-shadow:2px 2px 4px rgba(0,0,0,.12)"></div>
          </div>`,
          iconSize: [48, 60], iconAnchor: [24, 56], popupAnchor: [0, -50],
        });
        const mk = L.marker([p.lat, p.lng], { icon }).addTo(m);
        mk.on("click", () => setSelected(p));
        group.push(mk);
      });
      if (group.length) {
        m.fitBounds(L.featureGroup(group as L.Marker[]).getBounds().pad(0.3));
      }
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  return (
    <div className="stitch-map" style={{
      position: "relative", borderRadius: 22, overflow: "hidden",
      border: "1px solid #dfe2eb", boxShadow: "0 12px 40px rgba(0,29,54,0.15)",
      height: 480, background: "#e8edf5",
    }}>
      <div ref={el} role="application" aria-label="מפת מיקומי עורכי דין ברשת"
        style={{ position: "absolute", inset: 0 }} />

      {/* Floating search + filter */}
      <div style={{ position: "absolute", top: 14, insetInline: 14, zIndex: 600, display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span className="ms" style={{ position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)", color: "#707884" }}>search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש עו״ד, משרד או תחום..."
            style={{
              width: "100%", height: 48, paddingInline: "44px 16px", borderRadius: 16,
              border: "2px solid transparent", background: "rgba(255,255,255,.96)",
              boxShadow: "0 8px 24px rgba(0,29,54,.12)", fontFamily: "inherit", fontSize: 14, outline: "none",
            }} />
        </div>
        <button onClick={() => setFilterOpen(true)} aria-label="פילטרים"
          style={{ height: 48, width: 48, border: "none", borderRadius: 16, background: "#0061a5", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 8px 24px rgba(0,29,54,.12)", cursor: "pointer" }}>
          <span className="ms">tune</span>
        </button>
      </div>

      {/* Count chip */}
      <div style={{
        position: "absolute", top: 74, insetInlineStart: "50%", transform: "translateX(-50%)",
        zIndex: 600, display: "flex", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,.95)", border: "1px solid #dfe2eb",
        borderRadius: 999, padding: "6px 14px", boxShadow: "0 4px 16px rgba(0,29,54,.1)",
        fontSize: 13, fontWeight: 700, color: "#0061a5", whiteSpace: "nowrap",
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} /> ⚖️ {count} עורכי דין על המפה
      </div>

      {/* Level legend */}
      <div style={{
        position: "absolute", bottom: 14, insetInlineEnd: 14, zIndex: 600,
        background: "rgba(255,255,255,.95)", border: "1px solid #bfc7d5", borderRadius: 14,
        padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,29,54,.1)",
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: "#3f4753" }}>דרגת ותק</div>
        {LEGEND.map((l) => (
          <div key={l.tier} style={{ display: "flex", alignItems: "center", gap: 7, color: "#3f4753", marginTop: 3 }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: LEVEL_COLOR[l.tier], boxShadow: `0 0 6px ${LEVEL_COLOR[l.tier]}` }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Lawyer card */}
      {selected && (
        <div style={{
          position: "absolute", bottom: 16, insetInline: 16, zIndex: 650,
          background: "#fff", borderRadius: 24, padding: 16,
          boxShadow: "0 16px 48px rgba(0,29,54,.22)", display: "flex", gap: 14, alignItems: "center",
        }}>
          <div style={{ width: 76, height: 76, borderRadius: 18, overflow: "hidden", flexShrink: 0, background: "#dfe2eb" }}>
            {selected.avatar_url && <img src={selected.avatar_url} alt={selected.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <h3 className="font-headline" style={{ margin: 0, fontSize: 17, color: "#171c22" }}>{selected.name}</h3>
              <span style={{ display: "flex", alignItems: "center", gap: 3, background: "#fff7ed", color: "#b45309", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 13 }}>
                <span className="ms" style={{ fontSize: 16, color: "#f59e0b", fontVariationSettings: "'FILL' 1" }}>star</span>
                {(selected.reputation / 250).toFixed(1)}
              </span>
            </div>
            <p style={{ color: "#5f5e5e", fontSize: 13, margin: "3px 0 10px" }}>
              {PRACTICE_AREA_LABELS[selected.areas?.[0]] ?? "עו״ד"} · {EXPERIENCE_LABELS[selected.tier as keyof typeof EXPERIENCE_LABELS] ?? ""}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, border: "none", padding: 11, borderRadius: 12, background: "#0061a5", color: "#fff", fontWeight: 700, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
                צפייה בפרופיל
              </button>
              <button aria-label="צ׳אט" style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid #bfc7d5", background: "#fff", color: "#3f4753", display: "grid", placeItems: "center", cursor: "pointer" }}>
                <span className="ms">chat_bubble</span>
              </button>
            </div>
          </div>
          <button onClick={() => setSelected(null)} aria-label="סגירה"
            style={{ position: "absolute", top: -12, insetInlineEnd: -12, width: 30, height: 30, borderRadius: "50%", background: "#fff", border: "1px solid #bfc7d5", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,29,54,.1)" }}>
            <span className="ms" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {/* Filter drawer */}
      {filterOpen && (
        <>
          <div onClick={() => setFilterOpen(false)}
            style={{ position: "absolute", inset: 0, zIndex: 700, background: "rgba(0,0,0,.25)" }} />
          <div style={{
            position: "absolute", insetInline: 0, bottom: 0, zIndex: 701,
            background: "rgba(255,255,255,.97)", backdropFilter: "blur(16px)",
            borderRadius: "24px 24px 0 0", padding: "16px 18px 22px", boxShadow: "0 -10px 40px rgba(0,0,0,.2)",
          }}>
            <div style={{ width: 46, height: 5, background: "#bfc7d5", borderRadius: 999, margin: "0 auto 16px" }} />
            <h2 className="font-headline" style={{ margin: "0 0 16px", fontSize: 20, color: "#171c22" }}>סינון חיפוש</h2>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#5f5e5e", margin: "0 0 10px" }}>מרחק</p>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
              {["עד 5 ק״מ", "10 ק״מ", "כל העיר", "ארצי"].map((d, i) => (
                <button key={d} style={{ padding: "9px 18px", borderRadius: 999, border: "none", background: i === 0 ? "#0099ff" : "#e5e8f1", color: i === 0 ? "#fff" : "#3f4753", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>{d}</button>
              ))}
            </div>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#5f5e5e", margin: "0 0 10px" }}>תחום התמחות</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              {SPECIALIZATIONS.map((s, i) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, background: "#eaeef7", border: `2px solid ${i === 0 ? "#0061a5" : "transparent"}`, color: i === 0 ? "#0061a5" : "#171c22", fontWeight: 600, cursor: "pointer" }}>
                  <span className="ms">{s.icon}</span>{s.label}
                </div>
              ))}
            </div>
            <button onClick={() => setFilterOpen(false)}
              style={{ width: "100%", padding: 15, border: "none", borderRadius: 16, background: "#0061a5", color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "inherit", cursor: "pointer" }}>
              החל סינון
            </button>
          </div>
        </>
      )}
    </div>
  );
}

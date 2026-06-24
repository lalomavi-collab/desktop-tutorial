import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, PRACTICE_AREA_LABELS, EXPERIENCE_LABELS } from "../lib/supabase";
import { useI18n } from "../i18n";

// ── Light, colourful map (Anthropic palette): attorney face pins with a
// seniority ring; tap a pin → card with profile / chat / book-a-meeting.
// Country selector filters pins by jurisdiction. ──

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
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const allPins = useRef<Pin[]>([]);
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
  const { t } = useI18n();

  // Init map + load data once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("ldr_demo_attorneys")
        .select("id,display_name,lat,lng,jurisdiction,practice_areas,reputation,avatar_url,experience_tier,hourly_rate,quick_book,consultation_only")
        .not("lat", "is", null);
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { center: [31.9, 34.9], zoom: 8, zoomControl: false, attributionControl: false, scrollWheelZoom: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 20 }).addTo(m);
      map.current = m;
      layer.current = L.layerGroup().addTo(m);
      m.on("click", () => setSelected(null));
      allPins.current = ((data ?? []) as any[]).map((r) => ({
        id: r.id, name: r.display_name, lat: r.lat, lng: r.lng, jurisdiction: r.jurisdiction ?? "IL",
        areas: r.practice_areas ?? [], reputation: r.reputation, avatar_url: r.avatar_url, tier: r.experience_tier, rate: r.hourly_rate ?? null,
        quickBook: !!r.quick_book, consultOnly: !!r.consultation_only,
      }));
      const present = Array.from(new Set(allPins.current.map((p) => p.jurisdiction)));
      const ordered = ["IL", "US", "UK", "DE", "FR", "CA"].filter((c) => present.includes(c));
      setCountries(ordered.length ? ordered : present);
      setReady(true);
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  // Re-render markers when country changes.
  useEffect(() => {
    if (!ready || !map.current || !layer.current) return;
    layer.current.clearLayers();
    setSelected(null);
    const q = query.trim().toLowerCase();
    const specAreas = areaFilter ? (SPEC_FILTERS.find((s) => s.key === areaFilter)?.areas ?? []) : null;
    const pins = allPins.current.filter((p) => {
      if (p.jurisdiction !== country) return false;
      if (quickOnly && !p.quickBook) return false;
      if (consultOnly && !p.consultOnly) return false;
      if (specAreas && !p.areas.some((a) => specAreas.includes(a))) return false;
      if (q) {
        const hay = (p.name + " " + p.areas.map((a) => PRACTICE_AREA_LABELS[a] ?? a).join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    setCount(pins.length);
    const group: L.Marker[] = [];
    pins.forEach((p, i) => {
      const ring = levelColor(p.tier);
      const face = p.avatar_url
        ? `background-image:url('${p.avatar_url}');background-size:cover;background-position:center;`
        : `background:${ring};`;
      const online = i % 3 !== 2 ? `<div style="position:absolute;top:-2px;right:-2px;width:13px;height:13px;background:#10b981;border-radius:50%;border:2px solid #fff;"></div>` : "";
      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;"><div style="width:48px;height:48px;border-radius:50%;${face}border:4px solid #fff;box-shadow:0 0 0 3px ${ring},0 6px 16px rgba(0,0,0,.25);"></div>${online}<div style="width:13px;height:13px;background:#fff;transform:rotate(45deg);margin:-6px auto 0;box-shadow:2px 2px 4px rgba(0,0,0,.12)"></div></div>`,
        iconSize: [48, 60], iconAnchor: [24, 56], popupAnchor: [0, -50],
      });
      const mk = L.marker([p.lat, p.lng], { icon }).addTo(layer.current!);
      mk.on("click", () => { setSelected(p); setPanel(null); });
      group.push(mk);
    });
    if (group.length) {
      map.current.fitBounds(L.featureGroup(group).getBounds().pad(0.3));
    } else {
      const c = COUNTRY_CENTER[country]; if (c) map.current.setView([c[0], c[1]], c[2]);
    }
  }, [country, ready, query, areaFilter, quickOnly, consultOnly]);

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
        <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label={t("map.country")}
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

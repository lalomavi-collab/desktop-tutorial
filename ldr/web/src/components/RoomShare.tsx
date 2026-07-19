import { useEffect, useState } from "react";
import { supabase, type Profile } from "../lib/supabase";

const BASIS: Record<string, string> = { hourly: "לפי שעות", daily: "יומי", weekly: "שבועי", flexible: "גמיש" };
const DAYS = [{ k: "sun", l: "א׳" }, { k: "mon", l: "ב׳" }, { k: "tue", l: "ג׳" }, { k: "wed", l: "ד׳" }, { k: "thu", l: "ה׳" }, { k: "fri", l: "ו׳" }];

interface Room {
  id: string; host_id: string; title: string; city: string | null; address: string | null;
  basis: string; price: number | null; available_days: string[] | null; notes: string | null; active: boolean;
  host?: { display_name: string | null };
}
interface Booking { id: string; room_id: string; renter_id: string; from_date: string | null; to_date: string | null; message: string | null; status: string; renter?: { display_name: string | null }; }

export default function RoomShare({ profile, notify }: { profile: Profile; notify: (m: string) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [view, setView] = useState<"browse" | "mine" | "list">("browse");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("ldr_room_shares")
      .select("*, host:ldr_profiles!host_id(display_name)").order("created_at", { ascending: false }).limit(100);
    setRooms((data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const mine = rooms.filter((r) => r.host_id === profile.id);
  const browse = rooms.filter((r) => r.active && r.host_id !== profile.id);

  return (
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 900 }}>
      <div className="section-header">
        <h2>🤝 שיתוף חדרים בין עו״ד</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${view === "browse" ? "btn-gold" : "btn-ghost"}`} onClick={() => setView("browse")}>חדרים זמינים</button>
          <button className={`btn ${view === "mine" ? "btn-gold" : "btn-ghost"}`} onClick={() => setView("mine")}>החדרים שלי</button>
          <button className="btn btn-gold" onClick={() => setView("list")}>+ פרסום חדר</button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 18 }}>
        מגדירים זמינות (לפי שעות / יומי / שבועי), עמית שוכר ומשלם ישירות. בלי עמלה, בלי מתווך.
      </p>

      {view === "list" ? (
        <RoomForm profile={profile} notify={notify} onDone={() => { setView("mine"); load(); }} />
      ) : loading ? (
        <div className="center" style={{ paddingTop: 40 }}><span className="spinner" /></div>
      ) : view === "mine" ? (
        <MyRooms rooms={mine} profile={profile} notify={notify} />
      ) : browse.length === 0 ? (
        <div className="card pad center" style={{ color: "var(--cream-dim)" }}>אין כרגע חדרים זמינים. היו הראשונים לפרסם!</div>
      ) : (
        <div className="grid cols-2">
          {browse.map((r) => <RoomCard key={r.id} room={r} profile={profile} notify={notify} />)}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, profile, notify }: { room: Room; profile: Profile; notify: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  async function book() {
    setBusy(true);
    const { error } = await supabase.from("ldr_room_bookings").insert({ room_id: room.id, renter_id: profile.id, from_date: from || null, to_date: to || null, message: msg.trim() || null });
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    setDone(true); notify("בקשת ההזמנה נשלחה למארח ✓");
  }
  return (
    <div className="card pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>{room.title}</strong>
        <span className="tag tag-gold">{BASIS[room.basis] ?? room.basis}</span>
      </div>
      <div className="muted" style={{ fontSize: 12.5, margin: "6px 0" }}>📍 {room.city || ""}{room.address ? ` · ${room.address}` : ""} · מאת {room.host?.display_name || "עו״ד"}</div>
      {room.available_days?.length ? (
        <div style={{ display: "flex", gap: 5, margin: "8px 0" }}>
          {DAYS.map((d) => <span key={d.k} className="chip" style={{ fontSize: 11, opacity: room.available_days!.includes(d.k) ? 1 : 0.3 }}>{d.l}</span>)}
        </div>
      ) : null}
      {room.notes && <p style={{ fontSize: 13, color: "var(--cream-dim)", margin: "6px 0" }}>{room.notes}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <span style={{ fontWeight: 800, color: "var(--gold)" }}>{room.price ? `₪${room.price}` : "בתיאום"}</span>
        {done ? <span className="muted" style={{ fontSize: 13 }}>✓ נשלחה בקשה</span>
          : <button className="btn btn-gold" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => setOpen((o) => !o)}>{open ? "סגירה" : "בקשת הזמנה"}</button>}
      </div>
      {open && !done && (
        <div style={{ marginTop: 12, borderTop: "1px dashed var(--line)", paddingTop: 12 }}>
          <div className="grid cols-2">
            <div><label>מתאריך</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label>עד תאריך</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <label style={{ marginTop: 10 }}>הודעה למארח</label>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="למשל: צריך חדר ישיבות ליום ג׳..." style={{ minHeight: 60 }} />
          <button className="btn btn-gold" style={{ width: "100%", marginTop: 10 }} disabled={busy} onClick={book}>{busy ? <span className="spinner" /> : "שליחת בקשה"}</button>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>התשלום מתבצע ישירות מולכם ומול המארח — LAWdin לא גובה עמלה.</p>
        </div>
      )}
    </div>
  );
}

function MyRooms({ rooms, profile, notify }: { rooms: Room[]; profile: Profile; notify: (m: string) => void }) {
  const [bookings, setBookings] = useState<Record<string, Booking[]>>({});
  useEffect(() => {
    (async () => {
      if (!rooms.length) return;
      const { data } = await supabase.from("ldr_room_bookings")
        .select("*, renter:ldr_profiles!renter_id(display_name)")
        .in("room_id", rooms.map((r) => r.id)).order("created_at", { ascending: false });
      const map: Record<string, Booking[]> = {};
      ((data as any[]) ?? []).forEach((b) => { (map[b.room_id] ??= []).push(b); });
      setBookings(map);
    })();
  }, [rooms.map((r) => r.id).join(",")]);

  async function setStatus(b: Booking, status: string) {
    const { error } = await supabase.from("ldr_room_bookings").update({ status }).eq("id", b.id);
    if (error) { notify("שגיאה: " + error.message); return; }
    setBookings((prev) => { const c = { ...prev }; c[b.room_id] = c[b.room_id].map((x) => x.id === b.id ? { ...x, status } : x); return c; });
    notify("עודכן ✓");
  }

  if (!rooms.length) return <div className="card pad center" style={{ color: "var(--cream-dim)" }}>לא פרסמתם חדרים. לחצו "פרסום חדר".</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rooms.map((r) => (
        <div key={r.id} className="card pad">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{r.title} <span className="muted" style={{ fontSize: 12 }}>· {BASIS[r.basis]} · {r.price ? `₪${r.price}` : "בתיאום"}</span></strong>
            <span className="tag">{(bookings[r.id]?.length ?? 0)} בקשות</span>
          </div>
          {(bookings[r.id] ?? []).map((b) => (
            <div key={b.id} className="card pad" style={{ marginTop: 8, background: "var(--obsidian-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span><b>{b.renter?.display_name || "עו״ד"}</b> <span className="muted" style={{ fontSize: 12 }}>{b.from_date || ""}{b.to_date ? ` → ${b.to_date}` : ""}</span></span>
                <span className="tag">{b.status}</span>
              </div>
              {b.message && <p style={{ fontSize: 13, margin: "6px 0 0", color: "var(--cream-dim)" }}>{b.message}</p>}
              {b.status === "requested" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn btn-gold" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setStatus(b, "approved")}>אישור</button>
                  <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setStatus(b, "declined")}>דחייה</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RoomForm({ profile, notify, onDone }: { profile: Profile; notify: (m: string) => void; onDone: () => void }) {
  const [title, setTitle] = useState(""); const [city, setCity] = useState(""); const [address, setAddress] = useState("");
  const [basis, setBasis] = useState("daily"); const [price, setPrice] = useState(""); const [days, setDays] = useState<string[]>([]);
  const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false);
  const toggle = (k: string) => setDays((d) => d.includes(k) ? d.filter((x) => x !== k) : [...d, k]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { notify("יש להזין כותרת"); return; }
    setBusy(true);
    const { error } = await supabase.from("ldr_room_shares").insert({
      host_id: profile.id, title: title.trim(), city: city.trim() || null, address: address.trim() || null,
      basis, price: price ? parseInt(price, 10) : null, available_days: days, notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    notify("החדר פורסם ✓"); onDone();
  }
  return (
    <form className="card pad" onSubmit={submit} style={{ maxWidth: 620 }}>
      <label>כותרת</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: חדר ישיבות מעוצב במשרד בת״א" />
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div><label>עיר</label><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="תל אביב" /></div>
        <div><label>כתובת</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="רוטשילד 22" /></div>
      </div>
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div>
          <label>בסיס</label>
          <select value={basis} onChange={(e) => setBasis(e.target.value)}>
            {Object.entries(BASIS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div><label>מחיר (₪)</label><input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="250" /></div>
      </div>
      <label style={{ marginTop: 12 }}>ימי זמינות</label>
      <div style={{ display: "flex", gap: 6 }}>
        {DAYS.map((d) => (
          <button key={d.k} type="button" onClick={() => toggle(d.k)}
            style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${days.includes(d.k) ? "var(--gold)" : "var(--line)"}`, background: days.includes(d.k) ? "rgba(51,204,255,0.12)" : "transparent", color: "var(--cream)", cursor: "pointer", fontWeight: 700 }}>{d.l}</button>
        ))}
      </div>
      <label style={{ marginTop: 12 }}>הערות</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="פרטים: ציוד, חניה, נגישות..." />
      <button className="btn btn-gold" style={{ width: "100%", marginTop: 14 }} disabled={busy}>{busy ? <span className="spinner" /> : "פרסום החדר"}</button>
      <p className="muted center" style={{ fontSize: 11, marginTop: 8 }}>השכרה ותשלום ישירות מול העמית — LAWdin לא גובה עמלה.</p>
    </form>
  );
}

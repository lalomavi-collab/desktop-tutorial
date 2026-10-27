// lalum-travel-time: admin-only. Estimated one-way driving time from the office
// to a destination. Uses live Google traffic when GOOGLE_MAPS_API_KEY is set,
// otherwise a sensible per-area estimate from the Herzliya office.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

async function isAdmin(admin: ReturnType<typeof createClient>, userId: string, email: string | undefined) {
  if (email && email.toLowerCase() === "avraham@lalum.co") return true;
  const { data } = await admin.from("lalum_profiles").select("is_admin").eq("id", userId).maybeSingle();
  return Boolean(data?.is_admin);
}

// One-way driving minutes from the Herzliya office under typical daytime traffic.
const ESTIMATES: [RegExp, number][] = [
  [/herzliya|הרצליה/i, 12],
  [/ra'?anana|רעננה/i, 15],
  [/kfar ?saba|כפר ?סבא/i, 20],
  [/netanya|נתניה/i, 25],
  [/tel ?aviv|תל ?אביב/i, 30],
  [/ramat ?gan|רמת ?גן/i, 32],
  [/petah|petach|פתח ?תקווה/i, 32],
  [/rishon|ראשון/i, 38],
  [/jerusalem|ירושלים/i, 75],
  [/haifa|חיפה/i, 75],
  [/be'?er ?sheva|באר ?שבע/i, 105],
];

function estimate(dest: string): number {
  for (const [re, m] of ESTIMATES) if (re.test(dest)) return m;
  return 45;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { code: "not_configured" });
  const asUser = createClient(url, serviceKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });
  const admin = createClient(url, serviceKey);
  if (!(await isAdmin(admin, user.id, user.email))) return json(403, { code: "forbidden" });
  let body: { destination?: string; arrive_by?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const destination = (body.destination ?? "").toString().trim();
  if (!destination) return json(400, { code: "no_destination" });
  const origin = Deno.env.get("LALUM_OFFICE_ADDRESS") ?? "Herzliya, Israel";
  const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (mapsKey) {
    try {
      const arriveBy = body.arrive_by ? Math.floor(new Date(body.arrive_by).getTime() / 1000) : Math.floor(Date.now() / 1000) + 3600;
      const u = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      u.searchParams.set("origins", origin);
      u.searchParams.set("destinations", destination);
      u.searchParams.set("departure_time", String(arriveBy));
      u.searchParams.set("traffic_model", "pessimistic");
      u.searchParams.set("mode", "driving");
      u.searchParams.set("key", mapsKey);
      const r = await fetch(u.toString());
      const d = await r.json();
      const el = d?.rows?.[0]?.elements?.[0];
      const secs = el?.duration_in_traffic?.value ?? el?.duration?.value;
      if (typeof secs === "number") return json(200, { minutes: Math.ceil(secs / 60), source: "maps" });
    } catch (e) { console.log("MAPSERR " + String(e).slice(0, 160)); }
  }
  return json(200, { minutes: estimate(destination), source: "estimate" });
});

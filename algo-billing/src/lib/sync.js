import { supabase } from "./supabase.js";

/* ---------- field mapping ---------- */
function toDbClient(c) {
  return { id: c.id, name: c.name, rate: c.rate, email: c.email || null, auto_bill: c.autoBill };
}
function fromDbClient(r) {
  return { id: r.id, name: r.name, rate: Number(r.rate), email: r.email || "", autoBill: r.auto_bill };
}
function toDbLog(l) {
  return {
    id: l.id, client_id: l.clientId || null, client_name: l.client,
    log_date: l.date, hours: l.hours, description: l.description,
    rate: l.rate, total: l.total, status: l.status,
  };
}
function fromDbLog(r) {
  return {
    id: r.id, clientId: r.client_id, client: r.client_name,
    date: r.log_date, hours: Number(r.hours), description: r.description,
    rate: Number(r.rate), total: Number(r.total), status: r.status,
  };
}

/* ---------- public API ---------- */
export async function pullAll() {
  if (!supabase) return null;
  try {
    const [{ data: clients, error: ce }, { data: logs, error: le }] = await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("time_logs").select("*").order("log_date", { ascending: false }),
    ]);
    if (ce || le) return null;
    return { clients: clients.map(fromDbClient), logs: logs.map(fromDbLog) };
  } catch { return null; }
}

export async function upsertClient(c) {
  if (!supabase) return;
  try { await supabase.from("clients").upsert(toDbClient(c)); } catch { /* no-op */ }
}

export async function upsertLog(l) {
  if (!supabase) return;
  try { await supabase.from("time_logs").upsert(toDbLog(l)); } catch { /* no-op */ }
}

export async function deleteClient(id) {
  if (!supabase) return;
  try { await supabase.from("clients").delete().eq("id", id); } catch { /* no-op */ }
}

export async function deleteLog(id) {
  if (!supabase) return;
  try { await supabase.from("time_logs").delete().eq("id", id); } catch { /* no-op */ }
}

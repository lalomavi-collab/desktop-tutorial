import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { Icon } from "../components/Icon";
import { SchedulingEmbed } from "../components/SchedulingEmbed";
import { SchedulingConsole } from "../components/SchedulingConsole";
import { accountingUrl, paymentsEnabled, accountingDashboardEnabled, bankTransfer, paymentsComingSoon } from "../lib/content";
import { LeumiMark } from "../components/BrandMarks";

// When set, an embedded Calendly replaces the manual day/time picker.
const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL as string | undefined;

const SLOTS = ["09:00", "10:30", "12:00", "14:00", "15:30"];

type DayOption = { key: string; wd: string; dm: string };

function nextBusinessDays(count: number, lang: "en" | "he"): DayOption[] {
  const out: DayOption[] = [];
  const d = new Date();
  const wdEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const wdHe = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
  let guard = 0;
  while (out.length < count && guard < 30) {
    d.setDate(d.getDate() + 1);
    guard++;
    const day = d.getDay();
    if (day === 5 || day === 6) continue; // skip Fri/Sat
    out.push({
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      wd: lang === "he" ? wdHe[day] : wdEn[day],
      dm: `${mo[d.getMonth()]} ${d.getDate()}`,
    });
  }
  return out;
}

type MsgRow = {
  id: string;
  category: string;
  subject: string | null;
  body: string;
  ai_draft: string | null;
  reply: string | null;
  replied_at: string | null;
  handled: boolean;
  created_at: string;
  user_email: string | null;
};

type Milestone = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  client_email: string | null;
  hosted_url: string | null;
  created_at: string;
};

type CallRow = {
  id: string;
  caller_phone: string;
  duration_seconds: number;
  client_intent: string | null;
  is_billable: boolean;
  is_processed: boolean;
  summary: string | null;
  created_at: string;
  // PostgREST embeds one-to-many relations as arrays.
  lalum_crm_tasks: { title: string; priority: string; due_date: string; status: string }[] | null;
  lalum_billing_ledgers: { amount: number; currency: string; billed_hours: number }[] | null;
};

export function Portal() {
  const { user, signOut, demoMode } = useAuth();
  const { t, lang } = useLang();
  const P = t.ui.portal;
  const M = P.messages;
  const C = P.calls;
  const days = useMemo(() => nextBusinessDays(6, lang), [lang]);

  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [topic, setTopic] = useState("");
  const [bookBusy, setBookBusy] = useState(false);
  const [bookMsg, setBookMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [msgCat, setMsgCat] = useState("general");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgResult, setMsgResult] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [files, setFiles] = useState<{ name: string; path: string; size: number }[]>([]);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileMsg, setFileMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const loadFiles = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase.storage
      .from("client-files")
      .list(user.id, { sortBy: { column: "created_at", order: "desc" } });
    if (data) {
      setFiles(
        data
          .filter((o) => o.id)
          .map((o) => ({ name: o.name, path: `${user.id}/${o.name}`, size: (o.metadata?.size as number) ?? 0 })),
      );
    }
  }, [user]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [thread, setThread] = useState<MsgRow[]>([]);
  const [inbox, setInbox] = useState<MsgRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [chargingId, setChargingId] = useState<string | undefined>();
  const [chargedIds, setChargedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<Record<string, "draft" | "send" | undefined>>({});

  const [myBills, setMyBills] = useState<Milestone[]>([]);
  const [allBills, setAllBills] = useState<Milestone[]>([]);
  const [payBusy, setPayBusy] = useState<string | undefined>();
  const [billEmail, setBillEmail] = useState("");
  const [billName, setBillName] = useState("");
  const [billPhone, setBillPhone] = useState("");
  const [billTitle, setBillTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCurrency, setBillCurrency] = useState("ILS");
  const [billBusy, setBillBusy] = useState(false);
  const [billMsg, setBillMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Bank-transfer (Bank Leumi) declaration by the client.
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferRef, setTransferRef] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferMsg, setTransferMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Admin-only, firm-wide view of every client's uploaded documents.
  type AdminFile = { name: string; raw_name: string; path: string; size: number; created_at: string | null; url: string };
  type AdminClient = { client_id: string; email: string; name: string; file_count: number; files: AdminFile[] };
  const [adminDocs, setAdminDocs] = useState<AdminClient[]>([]);
  const [docsState, setDocsState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [zipBusy, setZipBusy] = useState<string | undefined>();
  const [openClient, setOpenClient] = useState<string | undefined>();

  // Admin inbox: grouped into a folder per client, with a search box and a
  // "needs reply" filter so a long list stays easy to work through.
  const [inboxQuery, setInboxQuery] = useState("");
  const [inboxUnhandledOnly, setInboxUnhandledOnly] = useState(false);
  const [openInboxClient, setOpenInboxClient] = useState<string | undefined>();
  const [openCaller, setOpenCaller] = useState<string | undefined>();

  const loadAdminDocs = useCallback(async () => {
    if (!supabase) return;
    setDocsState("loading");
    try {
      const { data, error } = await supabase.functions.invoke("lalum-admin-files", { body: { action: "list" } });
      if (error) throw error;
      setAdminDocs(((data?.clients ?? []) as AdminClient[]));
      setDocsState("ready");
    } catch {
      // Function not deployed yet, or the caller is not authorised: hide quietly.
      setDocsState("unavailable");
    }
  }, []);

  async function downloadAllZip(c: AdminClient) {
    if (!supabase) return;
    setZipBusy(c.client_id);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of c.files) {
        let url = f.url;
        if (!url) {
          const { data } = await supabase.functions.invoke("lalum-admin-files", { body: { action: "sign", path: f.path } });
          url = (data?.url as string) ?? "";
        }
        if (!url) continue;
        const blob = await (await fetch(url)).blob();
        zip.file(f.name, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      const label = (c.name || c.email || c.client_id).replace(/[^\w.@-]+/g, "_");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = `${label}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } finally {
      setZipBusy(undefined);
    }
  }

  useEffect(() => {
    if (isAdmin) void loadAdminDocs();
  }, [isAdmin, loadAdminDocs]);

  const loadMessages = useCallback(async () => {
    if (!supabase || !user) return;
    const emailAdmin = (user.email ?? "").toLowerCase() === "avraham@lalum.co";
    let admin = emailAdmin;
    if (!emailAdmin) {
      const { data } = await supabase.from("lalum_profiles").select("is_admin").eq("id", user.id).maybeSingle();
      admin = Boolean(data?.is_admin);
    }
    setIsAdmin(admin);
    const own = await supabase.from("lalum_messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (own.data) setThread(own.data as MsgRow[]);
    const mine = await supabase.from("billing_milestones").select("*").order("created_at", { ascending: false });
    if (mine.data) setMyBills(mine.data as Milestone[]);
    if (admin) {
      const all = await supabase.from("lalum_messages").select("*").order("created_at", { ascending: false });
      if (all.data) setInbox(all.data as MsgRow[]);
      setAllBills((mine.data as Milestone[]) ?? []);
      const callRes = await supabase
        .from("lalum_calls_meta")
        .select(
          "id, caller_phone, duration_seconds, client_intent, is_billable, is_processed, summary, created_at, lalum_crm_tasks(title, priority, due_date, status), lalum_billing_ledgers(amount, currency, billed_hours)"
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (callRes.data) setCalls(callRes.data as unknown as CallRow[]);
    }
  }, [user]);

  // One-click: turn a billable call into a payment request, reusing the amount
  // the voice billing already computed (gross, VAT included).
  async function chargeForCall(c: CallRow) {
    const bill = c.lalum_billing_ledgers?.[0];
    if (!supabase || !bill || chargingId) return;
    setChargingId(c.id);
    try {
      const title = `${t.ui.portal.calls.chargeTitle} · ${c.caller_phone}`;
      const { error } = await supabase.from("billing_milestones").insert({
        title,
        amount: bill.amount,
        currency: bill.currency,
        client_email: null,
        // The caller's real number, so an Invoice4U payment page can be issued.
        client_phone: c.caller_phone,
        client_name: t.ui.portal.calls.chargeTitle,
      });
      if (error) throw error;
      setChargedIds((s) => new Set(s).add(c.id));
      await loadMessages();
    } catch {
      window.alert(t.ui.portal.billing.err);
    } finally {
      setChargingId(undefined);
    }
  }

  async function payMilestone(id: string) {
    if (!supabase) return;
    setPayBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("lalum-pay-create", { body: { milestone_id: id } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url as string;
      else throw new Error("no_url");
    } catch {
      window.alert(t.ui.portal.billing.payErr);
      setPayBusy(undefined);
    }
  }

  async function createMilestone(e: FormEvent) {
    e.preventDefault();
    const B = t.ui.portal.billing;
    if (!supabase || !billTitle.trim() || !billAmount) return;
    setBillBusy(true);
    setBillMsg(null);
    try {
      const { error } = await supabase.from("billing_milestones").insert({ client_email: billEmail || null, client_name: billName || null, client_phone: billPhone || null, title: billTitle.trim(), amount: Number(billAmount), currency: billCurrency });
      if (error) throw error;
      setBillMsg({ tone: "ok", text: B.createdOk });
      setBillTitle("");
      setBillAmount("");
      setBillEmail("");
      setBillName("");
      setBillPhone("");
      await loadMessages();
    } catch (err) {
      setBillMsg({ tone: "err", text: err instanceof Error ? err.message : B.err });
    } finally {
      setBillBusy(false);
    }
  }

  async function copyPayLink(id: string) {
    if (!supabase) return;
    setPayBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("lalum-pay-create", { body: { milestone_id: id } });
      if (error) throw error;
      if (data?.url) {
        try { await navigator.clipboard.writeText(data.url as string); } catch { window.prompt("Link", data.url as string); }
        await loadMessages();
      }
    } catch {
      window.alert(t.ui.portal.billing.payErr);
    } finally {
      setPayBusy(undefined);
    }
  }

  // Client declares that a bank transfer to Bank Leumi was made. This does not
  // move money; it records the client's confirmation into the admin inbox so
  // the firm can match and verify the incoming transfer.
  async function declareBankTransfer() {
    if (!supabase || !user) return;
    const T = P.transfer;
    setTransferBusy(true);
    setTransferMsg(null);
    try {
      const ref = transferRef.trim();
      const body =
        `הלקוח מאשר שביצע העברה בנקאית ל${bankTransfer.bankName} (חשבון ${bankTransfer.account}).` +
        (ref ? `\nעבור: ${ref}` : "");
      const { error } = await supabase
        .from("lalum_messages")
        .insert({ user_id: user.id, user_email: user.email, category: "bank_transfer", subject: "אישור העברה בנקאית", body });
      if (error) throw error;
      void supabase.functions.invoke("lalum-message", { body: { category: "bank_transfer", subject: "אישור העברה בנקאית", body } });
      setTransferMsg({ tone: "ok", text: T.ok });
      setTransferRef("");
      await loadMessages();
    } catch {
      setTransferMsg({ tone: "err", text: T.err });
    } finally {
      setTransferBusy(false);
    }
  }

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function draftReply(id: string) {
    if (!supabase) return;
    setRowBusy((b) => ({ ...b, [id]: "draft" }));
    try {
      const { data, error } = await supabase.functions.invoke("lalum-draft-reply", { body: { message_id: id } });
      if (error) throw error;
      setDrafts((d) => ({ ...d, [id]: (data?.draft as string) ?? "" }));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Draft failed");
    } finally {
      setRowBusy((b) => ({ ...b, [id]: undefined }));
    }
  }

  async function sendReply(id: string, fallback: string) {
    if (!supabase) return;
    const text = (drafts[id] ?? fallback).trim();
    if (!text) return;
    setRowBusy((b) => ({ ...b, [id]: "send" }));
    try {
      const { error } = await supabase.functions.invoke("lalum-send-reply", { body: { message_id: id, reply: text } });
      if (error) throw error;
      setDrafts((d) => {
        const n = { ...d };
        delete n[id];
        return n;
      });
      await loadMessages();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Send failed");
    } finally {
      setRowBusy((b) => ({ ...b, [id]: undefined }));
    }
  }

  async function submitBooking(e: FormEvent) {
    e.preventDefault();
    if (!day || !slot) return;
    setBookBusy(true);
    setBookMsg(null);
    try {
      if (supabase) {
        const { error } = await supabase.from("lalum_consultation_requests").insert({ requested_day: day, requested_slot: slot, topic: topic || null });
        if (error) throw error;
        // Best-effort confirmation email via Resend (no-op if not deployed).
        void supabase.functions.invoke("lalum-notify", { body: { day, slot, topic } });
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setBookMsg({ tone: "ok", text: `${P.book.okPrefix}${day} ${P.book.okAt} ${slot}. ${P.book.okSuffix}` });
      setDay("");
      setSlot("");
      setTopic("");
    } catch (err) {
      setBookMsg({ tone: "err", text: err instanceof Error ? err.message : P.book.err });
    } finally {
      setBookBusy(false);
    }
  }

  async function submitMessage(e: FormEvent) {
    e.preventDefault();
    const M = P.messages;
    if (!msgBody.trim()) return;
    setMsgBusy(true);
    setMsgResult(null);
    try {
      if (supabase) {
        const { error } = await supabase
          .from("lalum_messages")
          .insert({ user_id: user?.id, user_email: user?.email, category: msgCat, subject: msgSubject || null, body: msgBody });
        if (error) throw error;
        const { error: fnError } = await supabase.functions.invoke("lalum-message", {
          body: { category: msgCat, subject: msgSubject, body: msgBody },
        });
        if (fnError) throw fnError;
        await loadMessages();
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setMsgResult({ tone: "ok", text: M.ok });
      setMsgSubject("");
      setMsgBody("");
      setMsgCat("general");
    } catch (err) {
      setMsgResult({ tone: "err", text: err instanceof Error ? err.message : M.err });
    } finally {
      setMsgBusy(false);
    }
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const F = P.files;
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setFileMsg({ tone: "err", text: F.tooBig });
      e.target.value = "";
      return;
    }
    setFileBusy(true);
    setFileMsg(null);
    try {
      if (supabase && user) {
        const safe = file.name.replace(/[^\w.-]+/g, "_");
        const path = `${user.id}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage.from("client-files").upload(path, file, { upsert: false });
        if (error) throw error;
        void supabase.functions.invoke("lalum-file-notify", { body: { path, name: file.name, size: file.size } });
        await loadFiles();
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setFileMsg({ tone: "ok", text: F.ok });
    } catch (err) {
      setFileMsg({ tone: "err", text: err instanceof Error ? err.message : F.err });
    } finally {
      setFileBusy(false);
      e.target.value = "";
    }
  }

  async function downloadFile(path: string) {
    if (!supabase) return;
    const { data } = await supabase.storage.from("client-files").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  async function removeFile(path: string) {
    if (!supabase) return;
    if (!window.confirm(P.files.confirmRemove)) return;
    await supabase.storage.from("client-files").remove([path]);
    await loadFiles();
  }

  const prettyName = (name: string) => name.replace(/^\d+-/, "");
  const prettySize = (bytes: number) => (bytes > 0 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : "");
  const fmtMoney = (amount: number, currency: string) => {
    const sym: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };
    return `${sym[currency] ?? ""}${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { day: "numeric", month: "short" });

  // Admin inbox grouped into a folder per client, with search + "needs reply"
  // filtering, most-urgent client first.
  const inboxGroups = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase();
    const map = new Map<string, MsgRow[]>();
    for (const m of inbox) {
      const key = (m.user_email || "").toLowerCase() || "__none__";
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    let groups = [...map.entries()].map(([key, msgs]) => ({ key, email: key === "__none__" ? "" : key, msgs }));
    if (q) {
      groups = groups
        .map((g) => ({ ...g, msgs: g.msgs.filter((m) => `${m.user_email ?? ""} ${m.subject ?? ""} ${m.body}`.toLowerCase().includes(q)) }))
        .filter((g) => g.msgs.length > 0);
    }
    if (inboxUnhandledOnly) {
      groups = groups.map((g) => ({ ...g, msgs: g.msgs.filter((m) => !m.handled) })).filter((g) => g.msgs.length > 0);
    }
    const withCounts = groups.map((g) => ({ ...g, unhandled: g.msgs.filter((m) => !m.handled).length }));
    withCounts.sort((a, b) => (b.unhandled > 0 ? 1 : 0) - (a.unhandled > 0 ? 1 : 0) || (b.msgs[0]?.created_at ?? "").localeCompare(a.msgs[0]?.created_at ?? ""));
    return withCounts;
  }, [inbox, inboxQuery, inboxUnhandledOnly]);

  // Calls grouped into a folder per caller, most-recent-with-open-work first.
  const callGroups = useMemo(() => {
    const map = new Map<string, CallRow[]>();
    for (const c of calls) {
      const key = c.caller_phone || "—";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    const groups = [...map.entries()].map(([phone, rows]) => ({ phone, rows, unprocessed: rows.filter((r) => !r.is_processed).length }));
    groups.sort((a, b) => (b.unprocessed > 0 ? 1 : 0) - (a.unprocessed > 0 ? 1 : 0) || (b.rows[0]?.created_at ?? "").localeCompare(a.rows[0]?.created_at ?? ""));
    return groups;
  }, [calls]);

  // Headline counts for the admin "at a glance" strip.
  const overview = useMemo(() => ({
    needReply: inbox.filter((m) => !m.handled).length,
    callsToProcess: calls.filter((c) => !c.is_processed).length,
    unpaid: allBills.filter((b) => b.status !== "paid").length,
    clientCount: new Set(inbox.map((m) => (m.user_email || "").toLowerCase()).filter(Boolean)).size,
  }), [inbox, calls, allBills]);

  // One call card, reused inside each caller folder.
  function renderCallCard(c: CallRow) {
    const task = c.lalum_crm_tasks?.[0];
    const bill = c.lalum_billing_ledgers?.[0];
    const intent = c.client_intent ? (C.intents[c.client_intent as keyof typeof C.intents] ?? c.client_intent) : null;
    const dueDays = task ? Math.max(0, Math.round((new Date(task.due_date).getTime() - Date.now()) / 86400000)) : null;
    return (
      <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 18, background: "var(--card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          {intent && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--clay)", textTransform: "uppercase", letterSpacing: ".06em" }}>{intent}</span>}
          {!c.is_processed && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{C.processing}</span>}
          {c.is_billable && <span style={{ fontSize: 11, fontWeight: 700, color: "#2c6444" }}>{C.billable}</span>}
          <span className="muted" style={{ fontSize: 12, marginInlineStart: "auto" }}>{fmtDate(c.created_at)}</span>
        </div>
        {c.summary && <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.6 }}>{c.summary}</p>}
        {task && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5, borderTop: "1px dashed var(--line)", paddingTop: 10 }}>
            <span style={{ fontWeight: 700, color: "var(--clay)" }}>{C.task}:</span>
            <span>{task.title}</span>
            <span className="muted">({C.priorities[task.priority as keyof typeof C.priorities] ?? task.priority})</span>
            {dueDays !== null && <span className="muted" style={{ marginInlineStart: "auto" }}>{C.due} {dueDays} {C.days}</span>}
          </div>
        )}
        {paymentsEnabled && c.is_billable && bill && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            {chargedIds.has(c.id) ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: "#2c6444" }}>{C.charged}</span>
            ) : (
              <button type="button" className="btn btn-clay btn-sm" disabled={chargingId === c.id} onClick={() => chargeForCall(c)}>
                <Icon name="scale" size={15} /> {chargingId === c.id ? C.charging : C.charge} · {bill.amount} {bill.currency}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // One client message with its AI-draft reply controls, reused inside each
  // client folder in the admin inbox.
  function renderInboxMessage(m: MsgRow) {
    const catLabel = M.categories[m.category as keyof typeof M.categories] ?? m.category;
    const busy = rowBusy[m.id];
    return (
      <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 18, background: "var(--card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--clay)", textTransform: "uppercase", letterSpacing: ".06em" }}>{catLabel}</span>
          {!m.handled && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{P.inbox.newBadge}</span>}
          {m.handled && <span style={{ fontSize: 11, fontWeight: 700, color: "#2c6444" }}>{P.inbox.replied} ✓</span>}
          <span className="muted" style={{ fontSize: 12, marginInlineStart: "auto" }}>{fmtDate(m.created_at)}</span>
        </div>
        {m.subject && <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.subject}</div>}
        <p style={{ margin: "0 0 14px", whiteSpace: "pre-wrap", fontSize: 14.5 }}>{m.body}</p>
        <textarea
          className="field"
          rows={4}
          value={drafts[m.id] ?? m.ai_draft ?? m.reply ?? ""}
          onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
          placeholder={P.inbox.replyPlaceholder}
          style={{ resize: "vertical", marginBottom: 12 }}
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => draftReply(m.id)} className="btn btn-ghost btn-sm" disabled={!!busy}>
            <Icon name="spark" size={16} /> {busy === "draft" ? P.inbox.drafting : P.inbox.draftAi}
          </button>
          <button type="button" onClick={() => sendReply(m.id, m.ai_draft ?? "")} className="btn btn-clay btn-sm" disabled={!!busy}>
            <Icon name="send" size={15} /> {busy === "send" ? P.inbox.sending : P.inbox.send}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="wrap" style={{ padding: "56px 32px 120px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 40 }}>
        <div>
          <p className="eyebrow">{P.eyebrow}</p>
          <h1 className="serif" style={{ fontSize: 36, margin: 0 }}>{P.welcome}</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 15 }} dir="ltr">{user?.email}</p>
        </div>
        <button onClick={() => signOut()} className="btn btn-ink btn-sm">
          <Icon name="logout" size={16} /> {P.signOut}
        </button>
      </div>

      {demoMode && <div className="notice notice-warn" style={{ marginBottom: 28 }}>{P.demo}</div>}

      {/* ADMIN AT A GLANCE (firm only): headline counts across the whole desk. */}
      {isAdmin && (
        <div className="admin-overview" style={{ marginBottom: 28 }}>
          {[
            { icon: "gavel", label: P.overview.needReply, value: overview.needReply, hot: overview.needReply > 0 },
            { icon: "phone", label: P.overview.calls, value: overview.callsToProcess, hot: overview.callsToProcess > 0 },
            { icon: "scale", label: P.overview.unpaid, value: overview.unpaid, hot: overview.unpaid > 0 },
            { icon: "folder", label: P.overview.clients, value: overview.clientCount, hot: false },
          ].map((s) => (
            <div key={s.label} className={"admin-stat" + (s.hot ? " hot" : "")}>
              <span className="admin-stat-badge"><Icon name={s.icon} size={18} /></span>
              <span className="admin-stat-value">{s.value}</span>
              <span className="admin-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* FIRM SCHEDULING CONSOLE (firm only) */}
      {isAdmin && <SchedulingConsole />}

      {/* CLIENT DOCUMENTS, folder per client (firm only) */}
      {isAdmin && docsState !== "unavailable" && (
        <div className="card" style={{ padding: 34, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span className="icon-badge"><Icon name="folder" size={20} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>{P.clientDocs.title}</h2>
          </div>
          <p className="muted" style={{ fontSize: 14, margin: "0 0 18px" }}>{P.clientDocs.intro}</p>
          {docsState === "loading" && <p className="muted" style={{ fontSize: 14 }}>{P.clientDocs.loading}</p>}
          {docsState === "ready" && adminDocs.length === 0 && <p className="muted" style={{ fontSize: 14 }}>{P.clientDocs.none}</p>}
          {docsState === "ready" && adminDocs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {adminDocs.map((c) => {
                const open = openClient === c.client_id;
                const label = c.name || c.email || P.clientDocs.noName;
                return (
                  <div key={c.client_id} style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => setOpenClient(open ? undefined : c.client_id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", flex: 1, minWidth: 180, textAlign: "start", font: "inherit", color: "inherit" }}>
                        <Icon name="folder" size={18} />
                        <span>
                          <span style={{ fontWeight: 600, display: "block" }}>{label}</span>
                          {c.email && c.name && <span className="muted" style={{ fontSize: 12 }} dir="ltr">{c.email}</span>}
                        </span>
                        <span className="muted" style={{ fontSize: 12.5, marginInlineStart: "auto" }}>{c.file_count} {P.clientDocs.files}</span>
                      </button>
                      <button type="button" className="btn btn-clay btn-sm" disabled={zipBusy === c.client_id} onClick={() => downloadAllZip(c)}>
                        <Icon name="folder" size={14} /> {zipBusy === c.client_id ? P.clientDocs.zipping : P.clientDocs.downloadAll}
                      </button>
                    </div>
                    {open && (
                      <div style={{ borderTop: "1px solid var(--line)", padding: "8px 16px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                        {c.files.map((f) => (
                          <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                            <Icon name="file" size={15} />
                            <span style={{ flex: 1, fontSize: 14, wordBreak: "break-word" }}>{f.name}</span>
                            <span className="muted" style={{ fontSize: 12 }}>{prettySize(f.size)}</span>
                            {f.url
                              ? <a className="btn btn-ghost btn-sm" href={f.url} target="_blank" rel="noopener noreferrer">{P.clientDocs.download}</a>
                              : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* INCOMING AI CALLS (firm only) */}
      {isAdmin && (
        <div className="card" style={{ padding: 34, marginBottom: 28, borderColor: "var(--clay)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span className="icon-badge"><Icon name="phone" size={20} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>{C.title}</h2>
          </div>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>{C.intro}</p>
          {calls.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>{C.none}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {callGroups.map((g) => {
                const open = openCaller === g.phone;
                return (
                  <div key={g.phone} style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                    <button type="button" onClick={() => setOpenCaller(open ? undefined : g.phone)}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 16px", background: open ? "var(--clay-tint)" : "none", border: "none", cursor: "pointer", textAlign: "start", font: "inherit", color: "inherit" }}>
                      <Icon name="phone" size={17} />
                      <span dir="ltr" style={{ fontWeight: 600 }}>{g.phone}</span>
                      {g.unprocessed > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{g.unprocessed} {C.toProcess}</span>}
                      <span className="muted" style={{ fontSize: 12.5, marginInlineStart: "auto" }}>{g.rows.length} {C.callsWord}</span>
                      <span className={"faq-chevron" + (open ? " open" : "")} aria-hidden="true"><Icon name="chevron-d" size={16} /></span>
                    </button>
                    {open && (
                      <div style={{ borderTop: "1px solid var(--line)", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                        {g.rows.map((c) => renderCallCard(c))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ADMIN INBOX (firm only) */}
      {isAdmin && (
        <div className="card" style={{ padding: 34, marginBottom: 28, borderColor: "var(--clay)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span className="icon-badge"><Icon name="gavel" size={20} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>{P.inbox.title}</h2>
          </div>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>{P.inbox.intro}</p>
          {inbox.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>{P.inbox.none}</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line-strong)", borderRadius: 9999, padding: "9px 14px", background: "var(--card)" }}>
                  <Icon name="search" size={16} />
                  <input value={inboxQuery} onChange={(e) => setInboxQuery(e.target.value)} placeholder={P.inbox.searchPh}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, font: "inherit", fontSize: 14, color: "var(--ink)", minWidth: 0 }} />
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={inboxUnhandledOnly} onChange={(e) => setInboxUnhandledOnly(e.target.checked)} />
                  {P.inbox.unhandledOnly}
                </label>
                <span className="muted" style={{ fontSize: 12.5 }}>{inboxGroups.length} {P.inbox.clients}</span>
              </div>
              {inboxGroups.length === 0 ? (
                <p className="muted" style={{ fontSize: 14 }}>{P.inbox.noneFiltered}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {inboxGroups.map((g) => {
                    const open = openInboxClient === g.key;
                    const label = g.email || P.inbox.noEmail;
                    return (
                      <div key={g.key} style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                        <button type="button" onClick={() => setOpenInboxClient(open ? undefined : g.key)}
                          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 16px", background: open ? "var(--clay-tint)" : "none", border: "none", cursor: "pointer", textAlign: "start", font: "inherit", color: "inherit" }}>
                          <Icon name="user" size={17} />
                          <span dir="ltr" style={{ fontWeight: 600, wordBreak: "break-all" }}>{label}</span>
                          {g.unhandled > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{g.unhandled} {P.inbox.newBadge}</span>}
                          <span className="muted" style={{ fontSize: 12.5, marginInlineStart: "auto" }}>{g.msgs.length} {P.inbox.msgsWord}</span>
                          <span className={"faq-chevron" + (open ? " open" : "")} aria-hidden="true"><Icon name="chevron-d" size={16} /></span>
                        </button>
                        {open && (
                          <div style={{ borderTop: "1px solid var(--line)", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                            {g.msgs.map((m) => renderInboxMessage(m))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ADMIN BILLING (firm only) */}
      {isAdmin && (
        <div className="card" style={{ padding: 34, marginBottom: 28, borderColor: "var(--clay)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 10, marginBottom: 8 }}>
            <span className="icon-badge"><Icon name="scale" size={20} /></span>
            <h2 className="h3" style={{ fontSize: 22, margin: 0 }}>{P.billing.adminTitle}</h2>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--clay)", background: "var(--clay-tint)", borderRadius: 9999, padding: "3px 10px" }}>{P.billing.adminOnly}</span>
            {accountingDashboardEnabled && (
              <a
                className="btn btn-ghost btn-sm"
                href={accountingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginInlineStart: "auto" }}
              >
                <Icon name="file" size={15} /> {P.billing.dashboard}
              </a>
            )}
          </div>
          <p className="muted" style={{ fontSize: 14, margin: "0 0 18px" }}>{P.billing.adminIntro}</p>
          <form onSubmit={createMilestone} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <div className="label">{P.billing.clientEmail}</div>
                <input className="field" value={billEmail} onChange={(e) => setBillEmail(e.target.value)} placeholder={P.billing.clientEmailPh} dir="ltr" />
              </div>
              <div>
                <div className="label">{P.billing.itemTitle}</div>
                <input className="field" value={billTitle} onChange={(e) => setBillTitle(e.target.value)} placeholder={P.billing.itemTitlePh} />
              </div>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <div className="label">{P.billing.clientName}</div>
                <input className="field" value={billName} onChange={(e) => setBillName(e.target.value)} placeholder={P.billing.clientNamePh} />
              </div>
              <div>
                <div className="label">{P.billing.clientPhone}</div>
                <input className="field" value={billPhone} onChange={(e) => setBillPhone(e.target.value)} placeholder={P.billing.clientPhonePh} dir="ltr" inputMode="tel" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <div className="label">{P.billing.amount}</div>
                <input className="field" value={billAmount} onChange={(e) => setBillAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder={P.billing.amountPh} dir="ltr" inputMode="decimal" />
              </div>
              <div style={{ width: 100 }}>
                <select className="field" value={billCurrency} onChange={(e) => setBillCurrency(e.target.value)} dir="ltr">
                  <option value="ILS">ILS ₪</option>
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                </select>
              </div>
              <button className="btn btn-clay btn-sm" disabled={billBusy || !billTitle.trim() || !billAmount} style={{ whiteSpace: "nowrap" }}>
                {billBusy ? P.billing.creating : P.billing.create}
              </button>
            </div>
          </form>
          {billMsg && <div className={`notice ${billMsg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginBottom: 16 }}>{billMsg.text}</div>}

          {allBills.length > 0 && (
            <div>
              <div className="label">{P.billing.allTitle}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {allBills.map((bl) => (
                  <div key={bl.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{bl.title}</div>
                      <div className="muted" style={{ fontSize: 12 }} dir="ltr">{bl.client_email}</div>
                    </div>
                    <span dir="ltr" style={{ fontWeight: 700 }}>{fmtMoney(bl.amount, bl.currency)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: bl.status === "paid" ? "#2c6444" : "var(--clay)", textTransform: "uppercase" }}>{P.billing.statusLabels[bl.status as keyof typeof P.billing.statusLabels] ?? bl.status}</span>
                    {bl.status !== "paid" && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={payBusy === bl.id} onClick={() => copyPayLink(bl.id)}>{payBusy === bl.id ? "…" : P.billing.copyLink}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMER SERVICE MESSAGE */}
      <div className="card" style={{ padding: 34, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span className="icon-badge"><Icon name="send" size={20} /></span>
          <h2 className="h3" style={{ fontSize: 22 }}>{M.title}</h2>
        </div>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>{M.intro}</p>
        <form onSubmit={submitMessage} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="grid grid-2" style={{ gap: 14 }}>
            <div>
              <div className="label">{M.category}</div>
              <select className="field" value={msgCat} onChange={(e) => { setMsgCat(e.target.value); setMsgResult(null); }}>
                <option value="general">{M.categories.general}</option>
                <option value="booking">{M.categories.booking}</option>
                <option value="documents">{M.categories.documents}</option>
                <option value="billing">{M.categories.billing}</option>
              </select>
            </div>
            <div>
              <div className="label">{M.subject}</div>
              <input className="field" value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} placeholder={M.subjectPlaceholder} />
            </div>
          </div>
          <div>
            <div className="label">{M.body}</div>
            <textarea className="field" rows={4} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder={M.bodyPlaceholder} style={{ resize: "vertical" }} />
          </div>
          <button className="btn btn-clay" style={{ alignSelf: "flex-start", justifyContent: "center" }} disabled={!msgBody.trim() || msgBusy}>
            {msgBusy ? M.sending : M.submit}
          </button>
        </form>
        {msgResult && <div className={`notice ${msgResult.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginTop: 16 }}>{msgResult.text}</div>}
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "14px 0 0" }}>{M.note}</p>
      </div>

      {/* CLIENT CONVERSATION THREAD */}
      {!isAdmin && thread.length > 0 && (
        <div className="card" style={{ padding: 34, marginBottom: 28 }}>
          <h2 className="h3" style={{ fontSize: 20, marginBottom: 18 }}>{P.thread.title}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {thread.map((m) => {
              const catLabel = M.categories[m.category as keyof typeof M.categories] ?? m.category;
              return (
                <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--clay)", textTransform: "uppercase", letterSpacing: ".06em" }}>{catLabel}</span>
                    <span className="muted" style={{ fontSize: 12, marginInlineStart: "auto" }} dir="ltr">{new Date(m.created_at).toLocaleDateString(lang === "he" ? "he-IL" : "en-US")}</span>
                  </div>
                  {m.subject && <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.subject}</div>}
                  <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap", fontSize: 14.5 }}>{m.body}</p>
                  {m.reply ? (
                    <div style={{ borderInlineStart: "3px solid var(--clay)", paddingInlineStart: 14, marginTop: 12 }}>
                      <div className="label" style={{ color: "var(--clay)" }}>{P.thread.replyLabel}</div>
                      <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", fontSize: 14.5 }}>{m.reply}</p>
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>{P.thread.awaiting}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CLIENT BILLING / PAYMENTS */}
      {!isAdmin && paymentsEnabled && myBills.length > 0 && (
        <div className="card" style={{ padding: 34, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span className="icon-badge"><Icon name="scale" size={20} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>{P.billing.title}</h2>
          </div>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>{P.billing.intro}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {myBills.map((bl) => {
              const paid = bl.status === "paid";
              const failed = bl.status === "failed";
              return (
                <div key={bl.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600 }}>{bl.title}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{P.billing.statusLabels[bl.status as keyof typeof P.billing.statusLabels] ?? bl.status}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16 }} dir="ltr">{fmtMoney(bl.amount, bl.currency)}</div>
                  {paid ? (
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#2c6444" }}>{P.billing.statusLabels.paid} ✓</span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                      <button type="button" className="btn btn-clay btn-sm" disabled={payBusy === bl.id} onClick={() => payMilestone(bl.id)}>
                        {payBusy === bl.id ? P.billing.paying : P.billing.pay}
                      </button>
                      <span className="muted" style={{ fontSize: 11 }} dir="ltr">{P.billing.walletHint}</span>
                    </div>
                  )}
                  {failed && <span style={{ fontSize: 12, color: "var(--clay)" }}>{P.billing.statusLabels.failed}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CLIENT BANK TRANSFER (Bank Leumi) */}
      {!isAdmin && (bankTransfer.enabled ? bankTransfer.account : paymentsComingSoon) && (
        <div className="card" style={{ padding: 34, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <LeumiMark size={26} />
            <h2 className="h3" style={{ fontSize: 22, margin: 0 }}>{P.transfer.title}</h2>
            {!(bankTransfer.enabled && bankTransfer.account) && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--clay)", background: "var(--clay-tint)", borderRadius: 9999, padding: "3px 10px" }}>{t.ui.comingSoon}</span>
            )}
          </div>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 18px" }}>{P.transfer.intro}</p>
          {!(bankTransfer.enabled && bankTransfer.account) ? (
            <p className="muted" style={{ fontSize: 14 }}>{t.ui.comingSoon}.</p>
          ) : !transferOpen ? (
            <button type="button" className="btn btn-clay" onClick={() => setTransferOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <LeumiMark size={18} /> {P.transfer.show}
            </button>
          ) : (
            <>
              <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { k: P.transfer.bank, v: `${bankTransfer.bankName} (${bankTransfer.bankCode})` },
                  { k: P.transfer.branch, v: bankTransfer.branch },
                  { k: P.transfer.account, v: bankTransfer.account },
                  { k: P.transfer.holder, v: bankTransfer.holder },
                  { k: "IBAN", v: bankTransfer.iban },
                  { k: "SWIFT", v: bankTransfer.swift },
                ].filter((r) => r.v).map((r) => (
                  <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 15 }}>
                    <span className="muted">{r.k}</span>
                    <span style={{ fontWeight: 600 }} dir="ltr">{r.v}</span>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 12.5, margin: "0 0 12px" }}>{P.transfer.note}</p>
              <div className="label">{P.transfer.refLabel}</div>
              <input className="field" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} placeholder={P.transfer.refPh} style={{ marginBottom: 14 }} />
              <button type="button" className="btn btn-clay" disabled={transferBusy} onClick={declareBankTransfer} style={{ justifyContent: "center" }}>
                <Icon name="check" size={17} /> {transferBusy ? P.transfer.confirming : P.transfer.confirm}
              </button>
              {transferMsg && <div className={`notice ${transferMsg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginTop: 14 }}>{transferMsg.text}</div>}
            </>
          )}
        </div>
      )}

      {/* FILE TRANSFER */}
      <div className="card" style={{ padding: 34, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span className="icon-badge"><Icon name="folder" size={20} /></span>
          <h2 className="h3" style={{ fontSize: 22 }}>{P.files.title}</h2>
        </div>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>{P.files.intro}</p>

        <label className="btn btn-clay btn-sm" style={{ cursor: fileBusy ? "default" : "pointer", opacity: fileBusy ? 0.7 : 1 }}>
          <Icon name="plus" size={16} /> {fileBusy ? P.files.uploading : P.files.choose}
          <input type="file" onChange={onUpload} disabled={fileBusy} style={{ display: "none" }} />
        </label>
        <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>{P.files.hint}</p>
        {fileMsg && <div className={`notice ${fileMsg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginTop: 16 }}>{fileMsg.text}</div>}

        <div style={{ marginTop: 22 }}>
          <div className="label">{P.files.yourFiles}</div>
          {files.length === 0 ? (
            <p className="muted" style={{ fontSize: 14, margin: "8px 0 0" }}>{P.files.none}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map((f) => (
                <li key={f.path} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--card)" }}>
                  <Icon name="file" size={18} />
                  <span style={{ flex: 1, minWidth: 120, wordBreak: "break-word", fontSize: 14 }} dir="auto">{prettyName(f.name)}</span>
                  {prettySize(f.size) && <span className="muted" style={{ fontSize: 12 }} dir="ltr">{prettySize(f.size)}</span>}
                  <button type="button" onClick={() => downloadFile(f.path)} className="btn btn-ghost btn-sm">{P.files.download}</button>
                  <button type="button" onClick={() => removeFile(f.path)} className="btn btn-ghost btn-sm" style={{ color: "var(--clay)" }}>{P.files.remove}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        {/* BOOKING */}
        <div className="card" style={{ padding: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span className="icon-badge"><Icon name="calendar" size={22} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>{P.book.title}</h2>
          </div>
          {CALENDLY_URL ? (
            <div style={{ background: "var(--ink)", borderRadius: 16, padding: 14 }}>
              <SchedulingEmbed
                url={CALENDLY_URL}
                prefill={{ email: user?.email ?? undefined }}
                onScheduled={() => setBookMsg({ tone: "ok", text: P.book.okSuffix })}
              />
              {bookMsg && (
                <div className={`notice ${bookMsg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginTop: 16 }}>{bookMsg.text}</div>
              )}
            </div>
          ) : (
          <form onSubmit={submitBooking}>
            <div className="label">{P.book.step1}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              {days.map((d) => {
                const on = day === d.key;
                return (
                  <button type="button" key={d.key} onClick={() => { setDay(d.key); setBookMsg(null); }}
                    style={{ flex: 1, minWidth: 84, padding: "12px 8px", borderRadius: 12, border: `1px solid ${on ? "var(--clay)" : "var(--line-strong)"}`, background: on ? "var(--clay-tint)" : "var(--card)", cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "var(--slate)" }}>{d.wd}</div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 17, marginTop: 4 }} dir="ltr">{d.dm}</div>
                  </button>
                );
              })}
            </div>

            <div className="label">{P.book.step2}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              {SLOTS.map((s) => {
                const on = slot === s;
                return (
                  <button type="button" key={s} onClick={() => { setSlot(s); setBookMsg(null); }}
                    style={{ padding: "11px 20px", borderRadius: 9999, border: `1px solid ${on ? "var(--clay)" : "var(--line-strong)"}`, background: on ? "var(--clay)" : "var(--card)", color: on ? "var(--paper)" : "var(--ink)", cursor: "pointer", fontSize: 15, fontWeight: 600 }} dir="ltr">
                    {s}
                  </button>
                );
              })}
            </div>

            <div className="label">{P.book.step3}</div>
            <textarea className="field" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={P.book.topicPlaceholder} style={{ resize: "vertical", marginBottom: 18 }} />

            <button className="btn btn-clay" style={{ width: "100%", justifyContent: "center" }} disabled={!day || !slot || bookBusy}>
              {bookBusy ? P.book.sending : P.book.submit}
            </button>
            {bookMsg && <div className={`notice ${bookMsg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginTop: 16 }}>{bookMsg.text}</div>}
          </form>
          )}
        </div>
      </div>
    </section>
  );
}

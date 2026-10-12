import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { PageMeta } from "../components/PageMeta";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { Icon } from "../components/Icon";
import { SchedulingEmbed } from "../components/SchedulingEmbed";
import { paymentsEnabled, bankTransfer, paymentsComingSoon } from "../lib/content";
import { LeumiMark, PaymentStrip } from "../components/BrandMarks";
import { GroupChat } from "../components/GroupChat";
import { PortalSigning } from "../components/PortalSigning";
import { bcp47For, type Lang } from "../lib/hreflang";

// When set, an embedded scheduling widget (Zoho Bookings) replaces the manual
// day/time picker.
const SCHEDULING_URL = import.meta.env.VITE_SCHEDULING_URL as string | undefined;

const SLOTS = ["09:00", "10:30", "12:00", "14:00", "15:30"];

type DayOption = { key: string; wd: string; dm: string };

// Short weekday labels, one terse glyph/abbreviation per day, matching the
// original design's compact date-button width.
const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  he: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  fr: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
  ar: ["أحد", "اثن", "ثلا", "أرب", "خمی", "جمع", "سبت"],
};

function nextBusinessDays(count: number, lang: Lang): DayOption[] {
  const out: DayOption[] = [];
  const d = new Date();
  const wd = WEEKDAYS[lang];
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
      wd: wd[day],
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

export function Portal() {
  const { user, signOut, demoMode } = useAuth();
  const { t, lang } = useLang();
  const P = t.ui.portal;
  const M = P.messages;
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
  const [isFirmMember, setIsFirmMember] = useState(false);
  const [thread, setThread] = useState<MsgRow[]>([]);

  const [myBills, setMyBills] = useState<Milestone[]>([]);
  const [payBusy, setPayBusy] = useState<string | undefined>();

  // Bank-transfer (Bank Leumi) declaration by the client.
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferRef, setTransferRef] = useState("");
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferMsg, setTransferMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);


  const loadMessages = useCallback(async () => {
    if (!supabase || !user) return;
    const emailAdmin = (user.email ?? "").toLowerCase() === "avraham@lalum.co";
    let admin = emailAdmin;
    if (!emailAdmin) {
      const { data } = await supabase.from("lalum_profiles").select("is_admin").eq("id", user.id).maybeSingle();
      admin = Boolean(data?.is_admin);
    }
    setIsAdmin(admin);
    // Any firm member (attorney, partner, admin) gets the entry to the management
    // cockpit; a plain client does not. The cockpit itself scopes what each role sees.
    const fm = await supabase.from("lalum_firm_members").select("user_id").eq("user_id", user.id).maybeSingle();
    setIsFirmMember(admin || Boolean(fm.data));
    const own = await supabase.from("lalum_messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (own.data) setThread(own.data as MsgRow[]);
    const mine = await supabase.from("billing_milestones").select("*").order("created_at", { ascending: false });
    if (mine.data) setMyBills(mine.data as Milestone[]);
  }, [user]);

  async function payMilestone(id: string) {
    if (!supabase) return;
    setPayBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("lalum-pay-create", { body: { milestone_id: id } });
      if (error) {
        // Read the function's error code so we can explain *why* it did not open
        // instead of a single generic message. A 403 means the charge is on a
        // different email than the one this account signed in with.
        let code = "";
        try { code = (((await (error as { context?: Response }).context?.json()) as { code?: string } | undefined)?.code) ?? ""; } catch { /* body unreadable or not JSON */ }
        window.alert(code === "forbidden" ? t.ui.portal.billing.payErrForbidden : t.ui.portal.billing.payErr);
        setPayBusy(undefined);
        return;
      }
      if (data?.url) window.location.href = data.url as string;
      else throw new Error("no_url");
    } catch {
      window.alert(t.ui.portal.billing.payErr);
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
      // If the client attached a payment confirmation (screenshot or PDF),
      // upload it to their file folder first so it reaches the admin both as a
      // file and referenced inside the inbox message.
      let receiptName = "";
      if (transferFile) {
        if (transferFile.size > 25 * 1024 * 1024) {
          setTransferMsg({ tone: "err", text: P.files.tooBig });
          setTransferBusy(false);
          return;
        }
        const safe = transferFile.name.replace(/[^\w.-]+/g, "_");
        const path = `${user.id}/${Date.now()}-payment-${safe}`;
        const { error: upErr } = await supabase.storage.from("client-files").upload(path, transferFile, { upsert: false });
        if (upErr) throw upErr;
        void supabase.functions.invoke("lalum-file-notify", { body: { path, name: transferFile.name, size: transferFile.size } });
        receiptName = transferFile.name;
      }
      const body =
        `הלקוח מאשר שביצע העברה בנקאית ל${bankTransfer.bankName} (חשבון ${bankTransfer.account}).` +
        (ref ? `\nעבור: ${ref}` : "") +
        (receiptName ? `\nצורף אישור תשלום: ${receiptName}` : "");
      const { error } = await supabase
        .from("lalum_messages")
        .insert({ user_id: user.id, user_email: user.email, category: "bank_transfer", subject: "אישור העברה בנקאית", body });
      if (error) throw error;
      void supabase.functions.invoke("lalum-message", { body: { category: "bank_transfer", subject: "אישור העברה בנקאית", body } });
      setTransferMsg({ tone: "ok", text: T.ok });
      setTransferRef("");
      setTransferFile(null);
      await loadFiles();
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
    // Open the tab now, inside the click: a window opened after the await below is the one browsers block.
    const w = window.open("", "_blank");
    const { data } = await supabase.storage.from("client-files").createSignedUrl(path, 60);
    if (!data?.signedUrl) { w?.close(); return; }
    if (w) { w.opener = null; w.location.href = data.signedUrl; }
    else window.open(data.signedUrl, "_blank", "noopener");
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

  return (
    <section className="wrap" style={{ padding: "56px 32px 120px" }}>
      <PageMeta title="LALUM" path="/portal" noindex />
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

      {/* Firm members reach their work in the management cockpit, not the client
          area. A clear entry here keeps the two apart: the portal for clients,
          the cockpit for the firm (where matters, documents and client signing
          requests are created, each scoped by the member's role). */}
      {isFirmMember && (
        <a href="/workspace/" className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 28, textDecoration: "none", color: "inherit" }}>
          <div>
            <div className="label" style={{ margin: 0 }}>מערכת ניהול התיקים</div>
            <p className="muted" style={{ margin: "4px 0 0" }}>כספת התיקים, מסמכים, החתמת לקוחות, בדיקת ניגוד עניינים ועוד. לכניסה לפי ההרשאות שלכם.</p>
          </div>
          <span className="btn btn-clay btn-sm" style={{ flex: "none" }}>כניסה לניהול</span>
        </a>
      )}

      {/* SHARED GROUP CHAT: one open room for everyone signed in, client and
          firm alike, meant to replace the firm's WhatsApp group so the
          conversation is saved and can later be searched or analysed. */}
      <GroupChat />

      {/* The firm's at-a-glance counts and the scheduling console now live in
          the cockpit (dashboard and /workspace/scheduling), not the client
          portal. Firm members reach them through the "management" card above.
          The remaining admin surfaces below move to the cockpit next, one at a
          time. */}

      {/* Firm-wide client documents now live in the cockpit
          (/workspace/client-docs), reached from the "management" card. */}

      {/* Incoming AI calls now live in the cockpit (/workspace/calls),
          reached from the "management" card. */}

      {/* The client-message inbox now lives in the cockpit
          (/workspace/inbox), reached from the "management" card. */}

      {/* The public-discussions review queue now lives in the cockpit
          (/workspace/discussions), reached from the "management" card. */}

      {/* Client billing (payment requests) now lives in the cockpit
          (/workspace/payments), reached from the "management" card. */}

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

      {/* DOCUMENTS TO SIGN. Shown to anyone who has requests addressed to their
          login email (the panel self-hides when there are none), so a firm member
          who is also a signer sees their own documents, not only plain clients. */}
      <PortalSigning />

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
                    <span className="muted" style={{ fontSize: 12, marginInlineStart: "auto" }} dir="ltr">{new Date(m.created_at).toLocaleDateString(bcp47For(lang))}</span>
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

      {/* CLIENT BILLING / PAYMENTS
          Always rendered (when payments are enabled) so a client who was sent a
          request but whose account does not match never faces a blank space.
          When there is nothing to pay we say so, and explain the most likely
          cause: the request went to a different email than the one they signed
          in with. */}
      {!isAdmin && paymentsEnabled && (
        <div className="card" style={{ padding: 34, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span className="icon-badge"><Icon name="scale" size={20} /></span>
            <h2 className="h3" style={{ fontSize: 22 }}>{P.billing.title}</h2>
          </div>
          {myBills.length === 0 ? (
            <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "18px 16px", background: "var(--card)" }}>
              <p className="muted" style={{ fontSize: 15, margin: 0 }}>{P.billing.none}</p>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: "8px 0 0" }}>
                {P.billing.noneHint} <span dir="ltr" style={{ fontWeight: 600 }}>{user?.email}</span>
              </p>
            </div>
          ) : (
          <>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 14px" }}>{P.billing.intro}</p>
          <div style={{ marginBottom: 20 }}><PaymentStrip label={P.billing.secure} size={26} /></div>
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
                        {payBusy === bl.id ? P.billing.paying : failed ? P.billing.retry : P.billing.pay}
                      </button>
                      <span className="muted" style={{ fontSize: 11 }} dir="ltr">{P.billing.walletHint}</span>
                    </div>
                  )}
                  {failed && (
                    <div style={{ flexBasis: "100%", fontSize: 12.5, color: "var(--clay)", lineHeight: 1.5, marginTop: 2 }}>
                      {P.billing.failedHint}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
          )}
        </div>
      )}

      {/* CLIENT BANK TRANSFER (Bank Leumi) */}
      {(bankTransfer.enabled ? bankTransfer.account : paymentsComingSoon) && (
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
            <button type="button" className="leumi-btn" onClick={() => setTransferOpen(true)} aria-label={`${bankTransfer.bankName} ${P.transfer.show}`}>
              <span className="leumi-emblem"><span className="leumi-emblem-bar" /></span>
              <span className="leumi-btn-name">בנק לאומי</span>
              <span className="leumi-btn-sep">·</span>
              <span>{P.transfer.show}</span>
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
              <div className="label">{P.transfer.receipt}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                  <Icon name="plus" size={15} /> {P.transfer.receipt}
                  <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={(e) => setTransferFile(e.target.files?.[0] ?? null)} />
                </label>
                {transferFile && <span style={{ fontSize: 13, fontWeight: 600 }} dir="ltr">{transferFile.name}</span>}
              </div>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 14px" }}>{P.transfer.receiptHint}</p>
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
          {SCHEDULING_URL ? (
            <div style={{ background: "var(--ink)", borderRadius: 16, padding: 14 }}>
              <SchedulingEmbed
                url={SCHEDULING_URL}
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

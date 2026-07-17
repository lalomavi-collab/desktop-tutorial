import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { Icon } from "../components/Icon";
import { SchedulingEmbed } from "../components/SchedulingEmbed";
import { SchedulingConsole } from "../components/SchedulingConsole";

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
  const [thread, setThread] = useState<MsgRow[]>([]);
  const [inbox, setInbox] = useState<MsgRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<Record<string, "draft" | "send" | undefined>>({});

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
    if (admin) {
      const all = await supabase.from("lalum_messages").select("*").order("created_at", { ascending: false });
      if (all.data) setInbox(all.data as MsgRow[]);
    }
  }, [user]);

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
      setBookMsg({ tone: "err", text: err instanceof Error ? err.message : P.verify.results.error.detail });
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

      {/* FIRM SCHEDULING CONSOLE (firm only) */}
      {isAdmin && <SchedulingConsole />}

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
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {inbox.map((m) => {
                const catLabel = M.categories[m.category as keyof typeof M.categories] ?? m.category;
                const busy = rowBusy[m.id];
                return (
                  <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 18, background: "var(--card)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--clay)", textTransform: "uppercase", letterSpacing: ".06em" }}>{catLabel}</span>
                      {!m.handled && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{P.inbox.newBadge}</span>}
                      {m.handled && <span style={{ fontSize: 11, fontWeight: 700, color: "#2c6444" }}>{P.inbox.replied} ✓</span>}
                      <span className="muted" style={{ fontSize: 12, marginInlineStart: "auto" }} dir="ltr">{m.user_email}</span>
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
              })}
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

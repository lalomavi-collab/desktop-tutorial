import { useCallback, useEffect, useMemo, useState } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../components/Icon";
import { useLang } from "../../context/LangContext";
import { bcp47For } from "../../lib/hreflang";

// Client-message inbox, moved out of the client portal into the cockpit. Client
// messages are grouped into a folder per client, with a search box, a "needs
// reply" filter, and per-message AI-draft reply controls (draft, then send).
// This is firm desk work, not a client surface. The query, grouping and the
// draft/send handlers are unchanged from their former home in the portal; the
// screen now loads its own messages and refreshes itself after a send.

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

function MessageInboxInner({ canView }: { canView: boolean }) {
  const { t, lang } = useLang();
  const P = t.ui.portal;
  const M = P.messages;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(bcp47For(lang), { day: "numeric", month: "short" });

  const [inbox, setInbox] = useState<MsgRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<Record<string, "draft" | "send" | undefined>>({});
  const [inboxQuery, setInboxQuery] = useState("");
  const [inboxUnhandledOnly, setInboxUnhandledOnly] = useState(false);
  const [openInboxClient, setOpenInboxClient] = useState<string | undefined>();

  const loadInbox = useCallback(async () => {
    if (!supabase) return;
    const all = await supabase.from("lalum_messages").select("*").order("created_at", { ascending: false });
    setInbox((all.data as MsgRow[] | null) ?? []);
  }, []);
  useEffect(() => { if (canView) void loadInbox(); }, [canView, loadInbox]);

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
      setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
      await loadInbox();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Send failed");
    } finally {
      setRowBusy((b) => ({ ...b, [id]: undefined }));
    }
  }

  const inboxGroups = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase();
    const map = new Map<string, MsgRow[]>();
    for (const m of inbox ?? []) {
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

  function renderInboxMessage(m: MsgRow) {
    const catLabel = M.categories[m.category as keyof typeof M.categories] ?? m.category;
    const busy = rowBusy[m.id];
    return (
      <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 18, background: "var(--card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--clay)", textTransform: "uppercase", letterSpacing: ".06em" }}>{catLabel}</span>
          {!m.handled && <span style={{ fontSize: 13, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{P.inbox.newBadge}</span>}
          {m.handled && <span style={{ fontSize: 13, fontWeight: 700, color: "#2c6444" }}>{P.inbox.replied} ✓</span>}
          <span className="muted" style={{ fontSize: 13, marginInlineStart: "auto" }}>{fmtDate(m.created_at)}</span>
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
          <button type="button" onClick={() => void draftReply(m.id)} className="btn btn-ghost btn-sm" disabled={!!busy}>
            <Icon name="spark" size={16} /> {busy === "draft" ? P.inbox.drafting : P.inbox.draftAi}
          </button>
          <button type="button" onClick={() => void sendReply(m.id, m.ai_draft ?? "")} className="btn btn-clay btn-sm" disabled={!!busy}>
            <Icon name="send" size={15} /> {busy === "send" ? P.inbox.sending : P.inbox.send}
          </button>
        </div>
      </div>
    );
  }

  if (!canView) return <div className="ck-card"><div className="ck-title">אין הרשאה</div><div className="ck-meta">תיבת הודעות הלקוחות פתוחה למנהל הפירמה.</div></div>;
  if (inbox === null) return <div className="ck-meta">טוען...</div>;

  return (
    <div className="card" style={{ padding: 34, marginBottom: 28, borderColor: "var(--clay)" }}>
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
            <span className="muted" style={{ fontSize: 13 }}>{inboxGroups.length} {P.inbox.clients}</span>
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
                      {g.unhandled > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{g.unhandled} {P.inbox.newBadge}</span>}
                      <span className="muted" style={{ fontSize: 13, marginInlineStart: "auto" }}>{g.msgs.length} {P.inbox.msgsWord}</span>
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
  );
}

/** Client-message inbox, framed for the cockpit. */
export function MessageInbox() {
  return (
    <CockpitFrame title="תיבת הודעות" description="הודעות הלקוחות, מקובצות לפי לקוח, עם ניסוח טיוטת מענה ושליחה." path="/workspace/inbox">
      {({ member, platformAdmin }) => <MessageInboxInner canView={platformAdmin || member?.role === "ADMIN"} />}
    </CockpitFrame>
  );
}

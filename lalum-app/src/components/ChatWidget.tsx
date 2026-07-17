import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { extractText } from "../lib/extractText";

type Msg = { role: "user" | "assistant"; content: string; file?: string };

export function ChatWidget() {
  const { t } = useLang();
  const C = t.ui.chat;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: C.greeting }]);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const text = await extractText(file);
      if (!text.trim()) throw new Error("empty");
      setAttachment({ name: file.name, text });
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: C.fileErr }]);
    } finally {
      setExtracting(false);
    }
  }

  // Reset the seeded greeting when the language changes (only if untouched).
  useEffect(() => {
    setMsgs((m) => (m.length === 1 && m[0].role === "assistant" ? [{ role: "assistant", content: C.greeting }] : m));
  }, [C.greeting]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, loading, open]);

  async function send() {
    const text = input.trim();
    if ((!text && !attachment) || loading) return;
    // What the user sees in their bubble vs what the model receives (the model
    // gets the full contract text; the bubble stays clean).
    const displayText = text || (attachment ? `📎 ${attachment.name}` : "");
    const modelText = attachment
      ? `${C.reviewPrefix} (${attachment.name}):\n\n${attachment.text}\n\n${text || C.reviewAsk}`
      : text;
    const priorForModel = msgs.filter((_, i) => i !== 0).map((m) => ({ role: m.role, content: m.content }));
    const convo = [...priorForModel, { role: "user" as const, content: modelText }];
    setMsgs((m) => [...m, { role: "user", content: displayText, file: attachment?.name }]);
    setInput("");
    setAttachment(null);
    setLoading(true);
    try {
      let reply = C.demoReply;
      if (supabase) {
        const { data, error } = await supabase.functions.invoke("lalum-assistant", { body: { messages: convo } });
        if (error) throw error;
        reply = ((data?.reply as string) || "").trim() || C.errorReply;
      }
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: C.errorReply }]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="chat-dock" style={{ position: "fixed", bottom: 24, insetInlineEnd: 24, zIndex: 80, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
      {open && (
        <div style={{ width: 370, maxWidth: "calc(100vw - 32px)", height: 520, maxHeight: "calc(100vh - 120px)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, boxShadow: "0 30px 70px -30px rgba(60,45,30,.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)", background: "var(--ink)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--paper)", fontFamily: "var(--serif)", fontSize: 16 }}>L</span>
              <div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--paper)", lineHeight: 1.1 }}>{C.title}</div>
                <div style={{ fontSize: 11, color: "#B7B1A6" }}>{C.subtitle}</div>
              </div>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.map((m, i) => {
              const you = m.role === "user";
              return (
                <div key={i} style={{ alignSelf: you ? "flex-end" : "flex-start", maxWidth: "84%", background: you ? "var(--clay)" : "var(--paper)", color: you ? "var(--paper)" : "var(--ink)", border: `1px solid ${you ? "var(--clay)" : "var(--line)"}`, borderRadius: 14, padding: "11px 14px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {m.content}
                </div>
              );
            })}
            {loading && (
              <div style={{ alignSelf: "flex-start", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 14px", fontSize: 14, color: "var(--slate)" }}>{C.thinking}</div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", padding: 14 }}>
            {(attachment || extracting) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12.5, color: "var(--slate)", background: "var(--ivory)", border: "1px solid var(--line)", borderRadius: 10, padding: "7px 11px" }}>
                <span aria-hidden="true">📎</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="auto">{extracting ? C.attaching : attachment?.name}</span>
                {attachment && !extracting && (
                  <button type="button" onClick={() => setAttachment(null)} aria-label={C.remove} style={{ border: 0, background: "none", cursor: "pointer", color: "var(--clay)", fontSize: 14 }}>×</button>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={onFile} style={{ display: "none" }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={C.attach}
                title={C.attach}
                disabled={extracting || loading}
                style={{ flex: "none", width: 44, height: 44, border: "1px solid var(--line-strong)", borderRadius: 11, background: "var(--paper)", color: "var(--slate)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder={C.placeholder}
                rows={1}
                style={{ flex: 1, padding: "11px 13px", border: "1px solid var(--line-strong)", borderRadius: 11, fontFamily: "var(--sans)", fontSize: 14, background: "var(--paper)", color: "var(--ink)", resize: "none", lineHeight: 1.5, maxHeight: 90 }}
              />
              <button onClick={() => void send()} aria-label={C.send} disabled={loading || extracting || (!input.trim() && !attachment)} className="btn-clay" style={{ flex: "none", width: 44, height: 44, border: 0, borderRadius: 11, color: "var(--paper)", cursor: "pointer", fontSize: 18, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                ↑
              </button>
            </div>
            <p style={{ margin: "10px 2px 0", fontSize: 10.5, lineHeight: 1.5, color: "var(--slate)" }}>{C.disclaimer}</p>
          </div>
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} aria-label={C.open} className="btn-clay" style={{ width: 60, height: 60, border: 0, borderRadius: "50%", color: "var(--paper)", boxShadow: "0 12px 30px -8px rgba(193,95,60,.6)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {open ? (
          <span style={{ fontSize: 24, lineHeight: 1 }}>×</span>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ display: "block" }} aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 0 1 4 11.5 8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
        )}
      </button>
    </div>
  );
}

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { extractText } from "../lib/extractText";

type Msg = { role: "user" | "assistant"; content: string; file?: string };

// Other components (e.g. the quick-start guide) can open the chat by dispatching
// this event on window.
export const OPEN_CHAT_EVENT = "lalum:open-chat";

// Web Speech API is not in the TS DOM lib; probe it loosely.
const SpeechRec = typeof window !== "undefined" ? ((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition) : undefined;
const ttsOK = typeof window !== "undefined" && "speechSynthesis" in window;

export function ChatWidget() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const C = t.ui.chat;
  const speechLang = lang === "he" ? "he-IL" : "en-US";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: C.greeting }]);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [listening, setListening] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  // Speak text aloud in the current language (voice output).
  function speak(text: string) {
    if (!ttsOK || !text) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }

  // Toggle voice input (speech to text) into the message box.
  function toggleListen() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (!SpeechRec) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (SpeechRec as any)();
    rec.lang = speechLang;
    rec.interimResults = true;
    rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput(txt);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

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

  // Let other components open the chat.
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, openChat);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, openChat);
  }, []);

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
      if (readAloud) speak(reply);
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
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--paper)", fontFamily: "var(--serif)", fontSize: 16 }}>L</span>
              <div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--paper)", lineHeight: 1.1 }}>{C.title}</div>
                <div style={{ fontSize: 11, color: "#B7B1A6" }}>{C.subtitle}</div>
              </div>
            </div>
            {ttsOK && (
              <button
                type="button"
                onClick={() => { if (readAloud) window.speechSynthesis.cancel(); setReadAloud((v) => !v); }}
                aria-label={C.speak}
                aria-pressed={readAloud}
                title={C.speak}
                style={{ flex: "none", width: 34, height: 34, borderRadius: 9999, border: "1px solid rgba(255,255,255,.22)", background: readAloud ? "var(--clay)" : "transparent", color: readAloud ? "var(--paper)" : "#B7B1A6", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H2v6h4l5 4V5z" />
                  {readAloud ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m17 9 4 6M21 9l-4 6" />}
                </svg>
              </button>
            )}
          </div>

          {!user ? (
            /* The assistant runs a paid model, so it is reserved for signed-in
               clients. Signed-out visitors see a friendly sign-in prompt. */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, gap: 14 }}>
              <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--clay-tint)", color: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <div style={{ fontFamily: "var(--serif)", fontSize: 19 }}>{C.lockedTitle}</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--slate)", margin: 0, maxWidth: "30ch" }}>{C.lockedBody}</p>
              <Link to="/login" onClick={() => setOpen(false)} className="btn btn-clay btn-sm" style={{ justifyContent: "center" }}>{C.lockedCta}</Link>
            </div>
          ) : (
          <>
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
              {!!SpeechRec && (
                <button
                  type="button"
                  onClick={toggleListen}
                  aria-label={listening ? C.micStop : C.mic}
                  aria-pressed={listening}
                  title={listening ? C.micStop : C.mic}
                  disabled={loading || extracting}
                  className={listening ? "mic-live" : undefined}
                  style={{ flex: "none", width: 44, height: 44, border: `1px solid ${listening ? "var(--clay)" : "var(--line-strong)"}`, borderRadius: 11, background: listening ? "var(--clay)" : "var(--paper)", color: listening ? "var(--paper)" : "var(--slate)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
                  </svg>
                </button>
              )}
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
          </>
          )}
        </div>
      )}

      <button onClick={() => setOpen((o) => { const nx = !o; if (!nx) { recRef.current?.stop(); if (ttsOK) window.speechSynthesis.cancel(); } return nx; })} aria-label={C.open} className="btn-clay" style={{ width: 60, height: 60, border: 0, borderRadius: "50%", color: "var(--paper)", boxShadow: "0 12px 30px -8px rgba(193,95,60,.6)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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

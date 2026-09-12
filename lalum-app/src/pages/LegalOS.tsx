import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "../components/AppLink";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { Wordmark } from "../components/Wordmark";
import { LANGS, bcp47For } from "../lib/hreflang";
import type { Lang } from "../lib/hreflang";

// LALUM OS: a full-screen, app-style chat surface (the "Legal Algorist"),
// wired to the same lalum-assistant edge function the site chat widget uses, so
// the app and the site share one brain. Rendered standalone (no marketing
// header or footer) at /os, noindex, so it reads as an application rather than
// a marketing page. Its UI copy carries its own five-language dictionary here
// so the shared strings file (edited by every session) stays untouched.

type Msg = { role: "user" | "assistant"; content: string };

type OsCopy = {
  newChat: string;
  enginesLabel: string;
  siteLabel: string;
  backToSite: string;
  placeholder: string;
  send: string;
  thinking: string;
  disclaimer: string;
  zeroSub: string;
  zeroPrompt: string;
  langLabel: string;
  engines: { key: string; cmd: string; label: string; desc: string }[];
  siteLinks: { to: string; label: string }[];
  demo: string;
  error: string;
};

const OS: Record<Lang, OsCopy> = {
  he: {
    newChat: "שיחה חדשה",
    enginesLabel: "מנועים",
    siteLabel: "האתר",
    backToSite: "חזרה לאתר",
    placeholder: "כתבו פקודה, הדביקו סעיף או תיק, או נסחו הנחיה מבצעית…",
    send: "שליחה",
    thinking: "מנתח…",
    disclaimer: "מידע בלבד, אינו ייעוץ משפטי ואינו יוצר יחסי עורך דין לקוח.",
    zeroSub: "הנדסת משפט וארכיטקטורת סיכונים אוטונומית",
    zeroPrompt: "הקלד פקודה, הדבק סעיף או תיק, או נסח הנחיה מבצעית:",
    langLabel: "שפה",
    engines: [
      { key: "contracts", cmd: "/contracts", label: "חוזים", desc: "ניתוח סעיפים, ניקוד חשיפה וניסוח" },
      { key: "dom", cmd: "/dom", label: "יישוב סכסוכים", desc: "ניתוח מכוון הכרעה והצעת פשרה" },
      { key: "recir", cmd: "/recir", label: "נדל״ן והתחדשות", desc: "היתכנות, פינוי בינוי ותמ״א 38, מודל כלכלי" },
      { key: "srme", cmd: "/srme", label: "ממשל AI", desc: "רגולציה, ממשל אלגוריתמי ו-EU AI Act" },
    ],
    siteLinks: [
      { to: "/rulings", label: "מאגר פסיקה" },
      { to: "/real-estate-legal-advisory", label: "נדל״ן והתחדשות עירונית" },
      { to: "/ai-legal-advisory", label: "AI ומשפט" },
      { to: "/risk", label: "חדר ההחלטה" },
      { to: "/book", label: "קביעת ייעוץ" },
    ],
    demo: "המנוע אינו מחובר בסביבה זו. הגדירו את משתני Supabase כדי להפעיל את העוזר.",
    error: "אירעה תקלה זמנית. נסו שוב, או קבעו שיחת אבחון עם ד״ר עו״ד אברהם ללום.",
  },
  en: {
    newChat: "New chat",
    enginesLabel: "Engines",
    siteLabel: "Site",
    backToSite: "Back to site",
    placeholder: "Type a command, paste a clause or a docket, or state a directive…",
    send: "Send",
    thinking: "Analyzing…",
    disclaimer: "Informational only, not legal advice, and no attorney client relationship.",
    zeroSub: "Autonomous Legal Engineering and Risk Architecture",
    zeroPrompt: "Type a command, paste a clause or a docket, or state an operational directive:",
    langLabel: "Language",
    engines: [
      { key: "contracts", cmd: "/contracts", label: "Contracts", desc: "Clause analysis, exposure scoring, drafting" },
      { key: "dom", cmd: "/dom", label: "Disputes", desc: "Decision oriented settlement analysis" },
      { key: "recir", cmd: "/recir", label: "Real estate", desc: "Feasibility, urban renewal, economic modeling" },
      { key: "srme", cmd: "/srme", label: "AI governance", desc: "Regulation, algorithmic governance, EU AI Act" },
    ],
    siteLinks: [
      { to: "/rulings", label: "Case law" },
      { to: "/real-estate-legal-advisory", label: "Real estate and urban renewal" },
      { to: "/ai-legal-advisory", label: "AI and Law" },
      { to: "/risk", label: "Decision Room" },
      { to: "/book", label: "Book a consult" },
    ],
    demo: "The engine is not connected in this environment. Configure Supabase to enable the assistant.",
    error: "A temporary error occurred. Try again, or book a diagnosis with Dr. Avraham Lalum, Adv.",
  },
  es: {
    newChat: "Nuevo chat",
    enginesLabel: "Motores",
    siteLabel: "Sitio",
    backToSite: "Volver al sitio",
    placeholder: "Escribe un comando, pega una cláusula o un expediente, o indica una directiva…",
    send: "Enviar",
    thinking: "Analizando…",
    disclaimer: "Solo informativo, no es asesoramiento legal ni crea relación abogado cliente.",
    zeroSub: "Ingeniería Legal Autónoma y Arquitectura de Riesgo",
    zeroPrompt: "Escribe un comando, pega una cláusula o un expediente, o indica una directiva operativa:",
    langLabel: "Idioma",
    engines: [
      { key: "contracts", cmd: "/contracts", label: "Contratos", desc: "Análisis de cláusulas, exposición, redacción" },
      { key: "dom", cmd: "/dom", label: "Disputas", desc: "Análisis de acuerdo orientado a la decisión" },
      { key: "recir", cmd: "/recir", label: "Inmobiliario", desc: "Viabilidad, renovación urbana, modelo económico" },
      { key: "srme", cmd: "/srme", label: "Gobernanza de IA", desc: "Regulación, gobernanza algorítmica, EU AI Act" },
    ],
    siteLinks: [
      { to: "/rulings", label: "Jurisprudencia" },
      { to: "/real-estate-legal-advisory", label: "Inmobiliario y renovación urbana" },
      { to: "/ai-legal-advisory", label: "IA y Derecho" },
      { to: "/risk", label: "Sala de Decisión" },
      { to: "/book", label: "Reservar consulta" },
    ],
    demo: "El motor no está conectado en este entorno. Configura Supabase para habilitar el asistente.",
    error: "Ocurrió un error temporal. Inténtalo de nuevo o reserva un diagnóstico con Dr. Avraham Lalum, Adv.",
  },
  fr: {
    newChat: "Nouveau chat",
    enginesLabel: "Moteurs",
    siteLabel: "Site",
    backToSite: "Retour au site",
    placeholder: "Tapez une commande, collez une clause ou un dossier, ou donnez une directive…",
    send: "Envoyer",
    thinking: "Analyse…",
    disclaimer: "Informatif seulement, pas un conseil juridique, aucune relation avocat client.",
    zeroSub: "Ingénierie Juridique Autonome et Architecture du Risque",
    zeroPrompt: "Tapez une commande, collez une clause ou un dossier, ou donnez une directive opérationnelle:",
    langLabel: "Langue",
    engines: [
      { key: "contracts", cmd: "/contracts", label: "Contrats", desc: "Analyse de clauses, exposition, rédaction" },
      { key: "dom", cmd: "/dom", label: "Litiges", desc: "Analyse de règlement orientée décision" },
      { key: "recir", cmd: "/recir", label: "Immobilier", desc: "Faisabilité, renouvellement urbain, modèle économique" },
      { key: "srme", cmd: "/srme", label: "Gouvernance IA", desc: "Régulation, gouvernance algorithmique, EU AI Act" },
    ],
    siteLinks: [
      { to: "/rulings", label: "Jurisprudence" },
      { to: "/real-estate-legal-advisory", label: "Immobilier et renouvellement urbain" },
      { to: "/ai-legal-advisory", label: "IA et Droit" },
      { to: "/risk", label: "Salle de Décision" },
      { to: "/book", label: "Prendre rendez vous" },
    ],
    demo: "Le moteur n'est pas connecté dans cet environnement. Configurez Supabase pour activer l'assistant.",
    error: "Une erreur temporaire s'est produite. Réessayez, ou réservez un diagnostic avec Dr. Avraham Lalum, Adv.",
  },
  ar: {
    newChat: "محادثة جديدة",
    enginesLabel: "المحركات",
    siteLabel: "الموقع",
    backToSite: "العودة إلى الموقع",
    placeholder: "اكتب أمرًا، الصق بندًا أو ملفًا، أو حدد توجيهًا…",
    send: "إرسال",
    thinking: "جارٍ التحليل…",
    disclaimer: "للمعلومات فقط، وليس استشارة قانونية ولا ينشئ علاقة محامٍ وموكل.",
    zeroSub: "هندسة قانونية مستقلة وبنية إدارة المخاطر",
    zeroPrompt: "اكتب أمرًا، الصق بندًا أو ملفًا، أو حدد توجيهًا تشغيليًا:",
    langLabel: "اللغة",
    engines: [
      { key: "contracts", cmd: "/contracts", label: "العقود", desc: "تحليل البنود، تقييم المخاطر، الصياغة" },
      { key: "dom", cmd: "/dom", label: "النزاعات", desc: "تحليل تسوية موجه نحو القرار" },
      { key: "recir", cmd: "/recir", label: "العقارات", desc: "الجدوى، التجديد الحضري، النمذجة الاقتصادية" },
      { key: "srme", cmd: "/srme", label: "حوكمة الذكاء الاصطناعي", desc: "التنظيم، الحوكمة الخوارزمية، EU AI Act" },
    ],
    siteLinks: [
      { to: "/rulings", label: "السوابق القضائية" },
      { to: "/real-estate-legal-advisory", label: "العقارات والتجديد الحضري" },
      { to: "/ai-legal-advisory", label: "الذكاء الاصطناعي والقانون" },
      { to: "/risk", label: "غرفة القرار" },
      { to: "/book", label: "حجز استشارة" },
    ],
    demo: "المحرك غير متصل في هذه البيئة. اضبط إعدادات Supabase لتفعيل المساعد.",
    error: "حدث خطأ مؤقت. حاول مرة أخرى، أو احجز تشخيصًا مع Dr. Avraham Lalum, Adv.",
  },
};

export function LegalOS() {
  const { lang, setLang } = useLang();
  const copy = OS[lang] ?? OS.he;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  function reset() {
    setMsgs([]);
    setInput("");
    setNavOpen(false);
    inputRef.current?.focus();
  }

  function useCommand(cmd: string) {
    setInput((v) => (v.trim().startsWith(cmd) ? v : `${cmd} ${v}`.trimStart()));
    setNavOpen(false);
    inputRef.current?.focus();
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const convo = [...msgs, { role: "user" as const, content: text }];
    setMsgs(convo);
    setInput("");
    setLoading(true);
    try {
      let reply = copy.demo;
      if (supabase) {
        const { data, error } = await supabase.functions.invoke("lalum-assistant", { body: { messages: convo } });
        if (error) throw error;
        reply = ((data?.reply as string) || "").trim() || copy.error;
      }
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: copy.error }]);
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

  const empty = msgs.length === 0;

  return (
    <div className="los-shell" lang={lang} dir={LANGS.find((l) => l.code === lang)?.dir ?? "rtl"}>
      <style>{LOS_CSS}</style>

      {navOpen && <div className="los-scrim" onClick={() => setNavOpen(false)} />}
      <aside className={"los-side" + (navOpen ? " open" : "")}>
        <Link to="/" className="los-brand" aria-label="LALUM">
          <Wordmark height={20} />
        </Link>
        <button type="button" className="los-new" onClick={reset}>+ {copy.newChat}</button>

        <div className="los-group-label">{copy.enginesLabel}</div>
        {copy.engines.map((e) => (
          <button key={e.key} type="button" className="los-eng" onClick={() => useCommand(e.cmd)}>
            <span className="los-eng-cmd">{e.cmd}</span>
            <span className="los-eng-label">{e.label}</span>
            <span className="los-eng-desc">{e.desc}</span>
          </button>
        ))}

        <div className="los-group-label">{copy.siteLabel}</div>
        {copy.siteLinks.map((l) => (
          <Link key={l.to} to={l.to} className="los-link">{l.label}</Link>
        ))}

        <div className="los-side-foot">
          <div className="los-langs" role="group" aria-label={copy.langLabel}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={"los-lang" + (l.code === lang ? " active" : "")}
                lang={l.code}
                dir={l.dir}
              >
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
          <Link to="/" className="los-back">{copy.backToSite}</Link>
        </div>
      </aside>

      <main className="los-main">
        <header className="los-topbar">
          <button type="button" className="los-burger" onClick={() => setNavOpen((v) => !v)} aria-label={copy.enginesLabel}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="los-topbar-title">LALUM LEGAL OS</span>
          <span className="los-status">● {lang === "he" ? "מוכן" : "Ready"}</span>
        </header>

        <div className="los-body" ref={scrollRef}>
          {empty ? (
            <div className="los-zero">
              <div className="los-zero-mark">✳</div>
              <h1 className="los-zero-title">LALUM LEGAL OS</h1>
              <div className="los-zero-kicker">THE LEGAL ALGORIST</div>
              <p className="los-zero-sub">{copy.zeroSub}</p>
              <p className="los-zero-prompt">{copy.zeroPrompt}</p>
              <div className="los-chips">
                {copy.engines.map((e) => (
                  <button key={e.key} type="button" className="los-chip" onClick={() => useCommand(e.cmd)}>
                    <b>{e.cmd}</b> {e.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="los-thread">
              {msgs.map((m, i) => (
                <div key={i} className={"los-msg " + m.role}>
                  <div className="los-bubble">{m.content}</div>
                </div>
              ))}
              {loading && <div className="los-msg assistant"><div className="los-bubble los-typing">{copy.thinking}</div></div>}
            </div>
          )}
        </div>

        <div className="los-composer">
          <div className="los-input-row">
            <textarea
              ref={inputRef}
              className="los-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={copy.placeholder}
              lang={lang}
              dir="auto"
              aria-label={copy.placeholder}
            />
            <button type="button" className="los-send" onClick={() => void send()} disabled={loading || !input.trim()} aria-label={copy.send}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
          <p className="los-disclaimer" dir="auto" lang={bcp47For(lang)}>{copy.disclaimer}</p>
        </div>
      </main>
    </div>
  );
}

const LOS_CSS = `
.los-shell{position:fixed;inset:0;display:flex;background:#141210;color:#f3ece0;font-family:var(--sans);z-index:1;overflow:hidden}
.los-side{width:270px;flex:none;display:flex;flex-direction:column;gap:6px;padding:16px 14px;background:#0f0d0b;border-inline-end:1px solid rgba(255,255,255,.07);overflow-y:auto}
.los-brand{display:inline-flex;color:#f3ece0;padding:6px 6px 12px}
.los-new{display:block;width:100%;text-align:start;padding:11px 14px;margin-bottom:8px;border-radius:12px;border:1px solid rgba(212,175,55,.4);background:transparent;color:#f3ece0;font:inherit;font-weight:700;cursor:pointer}
.los-new:hover{background:rgba(212,175,55,.12)}
.los-group-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8072;margin:14px 6px 4px}
.los-eng{display:block;width:100%;text-align:start;padding:9px 12px;border-radius:11px;border:1px solid transparent;background:transparent;color:#f3ece0;font:inherit;cursor:pointer}
.los-eng:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08)}
.los-eng-cmd{display:inline-block;font-weight:700;color:#d9a441;font-size:13px;margin-inline-end:8px}
.los-eng-label{font-weight:600;font-size:13.5px}
.los-eng-desc{display:block;color:#9a9081;font-size:11.5px;margin-top:2px;line-height:1.4}
.los-link{display:block;padding:8px 12px;border-radius:10px;color:#cfc6b8;text-decoration:none;font-size:13.5px}
.los-link:hover{background:rgba(255,255,255,.05);color:#f3ece0}
.los-side-foot{margin-top:auto;padding-top:12px}
.los-langs{display:flex;flex-wrap:wrap;gap:6px;padding:6px}
.los-lang{padding:5px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#cfc6b8;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.los-lang.active{background:rgba(212,175,55,.16);border-color:rgba(212,175,55,.5);color:#f3ece0}
.los-back{display:block;padding:9px 12px;margin-top:6px;color:#9a9081;text-decoration:none;font-size:13px}
.los-back:hover{color:#f3ece0}
.los-main{flex:1;min-width:0;display:flex;flex-direction:column}
.los-topbar{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.los-burger{display:none;width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#f3ece0;cursor:pointer;align-items:center;justify-content:center}
.los-topbar-title{font-weight:700;letter-spacing:.04em;font-size:14px}
.los-status{margin-inline-start:auto;color:#7fd598;font-size:12px}
.los-body{flex:1;overflow-y:auto;padding:24px 18px}
.los-zero{max-width:640px;margin:6vh auto 0;text-align:center;padding:0 12px}
.los-zero-mark{color:#c15f3c;font-size:34px;line-height:1}
.los-zero-title{font-family:var(--serif);font-size:clamp(30px,6vw,46px);margin:14px 0 2px;letter-spacing:.02em}
.los-zero-kicker{font-size:12px;letter-spacing:.28em;color:#d9a441}
.los-zero-sub{color:#b7ad9d;margin:14px 0 22px;font-size:15px}
.los-zero-prompt{color:#9a9081;font-size:13.5px;margin-bottom:14px}
.los-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.los-chip{padding:10px 16px;border-radius:9999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);color:#f3ece0;font:inherit;font-size:13.5px;cursor:pointer}
.los-chip b{color:#d9a441;margin-inline-end:4px}
.los-chip:hover{border-color:rgba(212,175,55,.5);background:rgba(212,175,55,.1)}
.los-thread{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.los-msg{display:flex}
.los-msg.user{justify-content:flex-end}
.los-bubble{max-width:82%;padding:13px 16px;border-radius:16px;font-size:14.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.los-msg.user .los-bubble{background:#7a1f1f;color:#fdf6ef;border-end-end-radius:5px}
.los-msg.assistant .los-bubble{background:#211d19;border:1px solid rgba(255,255,255,.08);color:#eee6d8;border-end-start-radius:5px}
.los-typing{color:#9a9081}
.los-composer{padding:12px 18px 16px;border-top:1px solid rgba(255,255,255,.07)}
.los-input-row{max-width:760px;margin:0 auto;display:flex;align-items:flex-end;gap:8px;background:#1d1a16;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:8px 8px 8px 14px}
.los-input{flex:1;resize:none;max-height:160px;background:transparent;border:none;outline:none;color:#f3ece0;font:inherit;font-size:14.5px;line-height:1.5;padding:6px 0}
.los-input::placeholder{color:#7d7466}
.los-send{flex:none;width:40px;height:40px;border-radius:12px;border:none;background:#c15f3c;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.los-send:disabled{opacity:.4;cursor:default}
.los-send:not(:disabled):hover{background:#a8482a}
.los-disclaimer{max-width:760px;margin:8px auto 0;text-align:center;color:#7d7466;font-size:11.5px}
.los-scrim{display:none}
@media (max-width:820px){
  .los-side{position:fixed;inset-block:0;inset-inline-start:0;width:min(300px,86vw);transform:translateX(-100%);transition:transform .22s ease;z-index:20;box-shadow:0 0 40px rgba(0,0,0,.5)}
  .los-shell[dir="rtl"] .los-side{transform:translateX(100%)}
  .los-side.open,.los-shell[dir="rtl"] .los-side.open{transform:translateX(0)}
  .los-scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:15}
  .los-burger{display:inline-flex}
}
`;

import { useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { Link } from "../components/AppLink";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { extractText } from "../lib/extractText";
import { Wordmark } from "../components/Wordmark";
import { LANGS, bcp47For } from "../lib/hreflang";
import type { Lang } from "../lib/hreflang";

// LALUM LEX: a full-screen, app-style chat surface (the "Legal Algorist"),
// wired to the same lalum-assistant edge function the site chat widget uses, so
// the app and the site share one brain. Rendered standalone (no marketing
// header or footer) at /os, noindex, so it reads as an application rather than
// a marketing page. Its UI copy carries its own five-language dictionary here
// so the shared strings file (edited by every session) stays untouched.
//
// Saved chats, contract upload and voice reuse the same patterns the site chat
// widget already ships (localStorage, extractText, the Web Speech API), so the
// two stay behaviourally consistent. Every browser API is touched only inside
// an effect or an event handler, never during render, so the prerender that
// writes /os to a static file never runs into window or localStorage.

// A single finding from the analyze-contract engine. Mirrors the shape that
// function returns (supabase/functions/analyze-contract/index.ts): every
// field the model can supply, plus quote_verified, which that function adds
// itself after checking exact_quote against the submitted contract text, so
// this UI never has to (and never should) re-implement that check.
type Finding = {
  finding_id: string;
  clause_number: string | null;
  clause_title: string;
  severity: "red" | "yellow" | "green";
  issue_summary: string;
  exact_quote: string | null;
  page_hint: string | null;
  legal_risk_rationale: string;
  proposed_revision: string | null;
  is_missing_clause: boolean;
  quote_verified: boolean | null;
};

// One cell of the Vault comparison matrix (Module 1.1): one topic, one
// document. Mirrors compare-contracts/index.ts's sanitized shape.
type ComparisonCell = {
  document_index: number;
  present: boolean;
  summary: string;
  exact_quote: string | null;
  quote_verified: boolean | null;
};
type ComparisonTopic = {
  topic: string;
  materially_differs: boolean;
  comparison_note: string;
  cells: ComparisonCell[];
};

// A message is a plain chat turn (content), a findings turn (one contract
// against analyze-contract), or a comparison turn (two to five contracts
// against compare-contracts). Exactly one of findings or comparison is set on
// a given assistant message, mirroring the three engines behind them
// (lalum-assistant, analyze-contract, compare-contracts).
type Msg = {
  role: "user" | "assistant";
  content: string;
  file?: string;
  findings?: Finding[];
  findingsDisclaimer?: string;
  // The submitted contract text, carried alongside its findings so the
  // review can render as a split screen (Module 2): source document on one
  // side, findings on the other, instead of findings alone. Absent on chats
  // saved before this field existed, in which case the split simply
  // collapses to the findings-only view it always was.
  docText?: string;
  comparison?: ComparisonTopic[];
  comparisonDocs?: string[];
  comparisonDisclaimer?: string;
};
type Chat = { id: string; title: string; msgs: Msg[]; ts: number };

const STORE_KEY = "lalum_os_chats";

// Web Speech API is not in the TS DOM lib; probe it loosely, once, at module
// load, guarded so the prerender (no window) never touches it.
const SpeechRec =
  typeof window !== "undefined"
    ? ((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
       (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)
    : undefined;
const ttsOK = typeof window !== "undefined" && "speechSynthesis" in window;

type OsCopy = {
  newChat: string;
  chatsLabel: string;
  historyEmpty: string;
  untitled: string;
  deleteChat: string;
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
  attach: string;
  reading: string;
  attached: string;
  fileErr: string;
  reviewPrefix: string;
  reviewAsk: string;
  mic: string;
  readAloud: string;
  engines: { key: string; cmd: string; label: string; desc: string }[];
  siteLinks: { to: string; label: string }[];
  demo: string;
  error: string;
  sevRed: string;
  sevYellow: string;
  sevGreen: string;
  missingClause: string;
  quoteVerified: string;
  quoteUnverified: string;
  proposedRevision: string;
  copyRevision: string;
  copied: string;
  noFindings: string;
  playbookLabel: string;
  playbookNone: string;
  playbooks: { slug: string; label: string }[];
  sourceDocument: string;
  vault: string;
  vaultHint: string;
  vaultTooFew: string;
  vaultRemove: string;
  comparisonTitle: string;
  comparisonTopic: string;
  comparisonPresent: string;
  comparisonMissing: string;
  comparisonDiffers: string;
};

const OS: Record<Lang, OsCopy> = {
  he: {
    newChat: "שיחה חדשה",
    chatsLabel: "שיחות",
    historyEmpty: "אין עדיין שיחות שמורות.",
    untitled: "שיחה",
    deleteChat: "מחיקת שיחה",
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
    attach: "העלאת חוזה לבדיקה",
    reading: "קורא את הקובץ…",
    attached: "צורף",
    fileErr: "לא הצלחתי לקרוא את הקובץ. נסו PDF או DOCX.",
    reviewPrefix: "חוזה מצורף לבדיקה",
    reviewAsk: "אנא בדוק את החוזה ומסור הערות.",
    mic: "הקלדה קולית",
    readAloud: "הקראת תשובות",
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
    sevRed: "סיכון גבוה",
    sevYellow: "לתשומת לב",
    sevGreen: "תקין",
    missingClause: "סעיף חסר",
    quoteVerified: "אומת מול הטקסט שהוגש",
    quoteUnverified: "לא אומת אוטומטית, יש לבדוק ידנית",
    proposedRevision: "נוסח מוצע",
    copyRevision: "העתק נוסח מתוקן למו״מ",
    copied: "הועתק",
    noFindings: "לא נמצאו ממצאים בחוזה זה.",
    playbookLabel: "תבנית בדיקה משרדית",
    playbookNone: "ללא תבנית, בדיקה כללית",
    playbooks: [
      { slug: "tama38", label: "התחדשות עירונית / תמ״א 38" },
      { slug: "commercial-lease", label: "שכירות מסחרית" },
      { slug: "founders-ai", label: "מייסדים / AI Tech" },
    ],
    sourceDocument: "מסמך מקור",
    vault: "השוואת מספר חוזים (Vault)",
    vaultHint: "בחרו 2 עד 5 קבצים להשוואה",
    vaultTooFew: "יש לבחור לפחות שני קבצים להשוואה.",
    vaultRemove: "הסרה מההשוואה",
    comparisonTitle: "טבלת השוואה",
    comparisonTopic: "נושא",
    comparisonPresent: "קיים",
    comparisonMissing: "חסר",
    comparisonDiffers: "הבדל מהותי",
  },
  en: {
    newChat: "New chat",
    chatsLabel: "Chats",
    historyEmpty: "No saved chats yet.",
    untitled: "Chat",
    deleteChat: "Delete chat",
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
    attach: "Upload a contract for review",
    reading: "Reading the file…",
    attached: "Attached",
    fileErr: "Could not read the file. Please try a PDF or DOCX.",
    reviewPrefix: "Attached contract for review",
    reviewAsk: "Please review this contract and share your remarks.",
    mic: "Voice input",
    readAloud: "Read answers aloud",
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
    sevRed: "High risk",
    sevYellow: "Worth flagging",
    sevGreen: "Standard",
    missingClause: "Missing clause",
    quoteVerified: "Verified against the submitted text",
    quoteUnverified: "Not auto-verified, check manually",
    proposedRevision: "Proposed wording",
    copyRevision: "Copy revised wording for negotiation",
    copied: "Copied",
    noFindings: "No findings for this contract.",
    playbookLabel: "Firm playbook",
    playbookNone: "No playbook, general review",
    playbooks: [
      { slug: "tama38", label: "Urban renewal / TAMA 38" },
      { slug: "commercial-lease", label: "Commercial lease" },
      { slug: "founders-ai", label: "Founders / AI Tech" },
    ],
    sourceDocument: "Source document",
    vault: "Compare multiple contracts (Vault)",
    vaultHint: "Choose 2 to 5 files to compare",
    vaultTooFew: "Choose at least two files to compare.",
    vaultRemove: "Remove from comparison",
    comparisonTitle: "Comparison matrix",
    comparisonTopic: "Topic",
    comparisonPresent: "Present",
    comparisonMissing: "Missing",
    comparisonDiffers: "Material difference",
  },
  es: {
    newChat: "Nuevo chat",
    chatsLabel: "Chats",
    historyEmpty: "Aún no hay chats guardados.",
    untitled: "Chat",
    deleteChat: "Eliminar chat",
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
    attach: "Subir un contrato para revisión",
    reading: "Leyendo el archivo…",
    attached: "Adjuntado",
    fileErr: "No se pudo leer el archivo. Prueba un PDF o DOCX.",
    reviewPrefix: "Contrato adjunto para revisión",
    reviewAsk: "Por favor revisa este contrato y comparte tus observaciones.",
    mic: "Entrada de voz",
    readAloud: "Leer respuestas en voz alta",
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
    sevRed: "Riesgo alto",
    sevYellow: "Para señalar",
    sevGreen: "Estándar",
    missingClause: "Cláusula faltante",
    quoteVerified: "Verificado contra el texto enviado",
    quoteUnverified: "No verificado automáticamente, revisar manualmente",
    proposedRevision: "Redacción propuesta",
    copyRevision: "Copiar redacción corregida para negociar",
    copied: "Copiado",
    noFindings: "No se encontraron hallazgos en este contrato.",
    playbookLabel: "Plantilla de revisión del despacho",
    playbookNone: "Sin plantilla, revisión general",
    playbooks: [
      { slug: "tama38", label: "Renovación urbana / TAMA 38" },
      { slug: "commercial-lease", label: "Arrendamiento comercial" },
      { slug: "founders-ai", label: "Fundadores / AI Tech" },
    ],
    sourceDocument: "Documento fuente",
    vault: "Comparar varios contratos (Vault)",
    vaultHint: "Elige de 2 a 5 archivos para comparar",
    vaultTooFew: "Elige al menos dos archivos para comparar.",
    vaultRemove: "Quitar de la comparación",
    comparisonTitle: "Matriz de comparación",
    comparisonTopic: "Tema",
    comparisonPresent: "Presente",
    comparisonMissing: "Ausente",
    comparisonDiffers: "Diferencia material",
  },
  fr: {
    newChat: "Nouveau chat",
    chatsLabel: "Chats",
    historyEmpty: "Aucun chat enregistré pour l'instant.",
    untitled: "Chat",
    deleteChat: "Supprimer le chat",
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
    attach: "Téléverser un contrat pour révision",
    reading: "Lecture du fichier…",
    attached: "Joint",
    fileErr: "Impossible de lire le fichier. Essayez un PDF ou DOCX.",
    reviewPrefix: "Contrat joint pour révision",
    reviewAsk: "Veuillez examiner ce contrat et partager vos remarques.",
    mic: "Saisie vocale",
    readAloud: "Lire les réponses à voix haute",
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
      { to: "/book", label: "Prendre rendez-vous" },
    ],
    demo: "Le moteur n'est pas connecté dans cet environnement. Configurez Supabase pour activer l'assistant.",
    error: "Une erreur temporaire s'est produite. Réessayez, ou réservez un diagnostic avec Dr. Avraham Lalum, Adv.",
    sevRed: "Risque élevé",
    sevYellow: "À signaler",
    sevGreen: "Standard",
    missingClause: "Clause manquante",
    quoteVerified: "Vérifié par rapport au texte soumis",
    quoteUnverified: "Non vérifié automatiquement, à contrôler manuellement",
    proposedRevision: "Rédaction proposée",
    copyRevision: "Copier la rédaction révisée pour la négociation",
    copied: "Copié",
    noFindings: "Aucun constat pour ce contrat.",
    playbookLabel: "Modèle de revue du cabinet",
    playbookNone: "Aucun modèle, revue générale",
    playbooks: [
      { slug: "tama38", label: "Renouvellement urbain / TAMA 38" },
      { slug: "commercial-lease", label: "Bail commercial" },
      { slug: "founders-ai", label: "Fondateurs / AI Tech" },
    ],
    sourceDocument: "Document source",
    vault: "Comparer plusieurs contrats (Vault)",
    vaultHint: "Choisissez de 2 à 5 fichiers à comparer",
    vaultTooFew: "Choisissez au moins deux fichiers à comparer.",
    vaultRemove: "Retirer de la comparaison",
    comparisonTitle: "Matrice de comparaison",
    comparisonTopic: "Sujet",
    comparisonPresent: "Présent",
    comparisonMissing: "Absent",
    comparisonDiffers: "Différence matérielle",
  },
  ar: {
    newChat: "محادثة جديدة",
    chatsLabel: "المحادثات",
    historyEmpty: "لا توجد محادثات محفوظة بعد.",
    untitled: "محادثة",
    deleteChat: "حذف المحادثة",
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
    attach: "رفع عقد للمراجعة",
    reading: "جارٍ قراءة الملف…",
    attached: "مرفق",
    fileErr: "تعذّرت قراءة الملف. جرّب PDF أو DOCX.",
    reviewPrefix: "عقد مرفق للمراجعة",
    reviewAsk: "يرجى مراجعة هذا العقد ومشاركة ملاحظاتك.",
    mic: "إدخال صوتي",
    readAloud: "قراءة الإجابات بصوت عالٍ",
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
    sevRed: "مخاطرة عالية",
    sevYellow: "يستحق الانتباه",
    sevGreen: "قياسي",
    missingClause: "بند مفقود",
    quoteVerified: "تم التحقق منه مقابل النص المُقدَّم",
    quoteUnverified: "لم يتم التحقق تلقائيًا، يرجى المراجعة يدويًا",
    proposedRevision: "صياغة مقترحة",
    copyRevision: "نسخ الصياغة المعدّلة للتفاوض",
    copied: "تم النسخ",
    noFindings: "لم يتم العثور على ملاحظات في هذا العقد.",
    playbookLabel: "نموذج مراجعة المكتب",
    playbookNone: "بلا نموذج، مراجعة عامة",
    playbooks: [
      { slug: "tama38", label: "التجديد الحضري / تاما 38" },
      { slug: "commercial-lease", label: "إيجار تجاري" },
      { slug: "founders-ai", label: "المؤسسون / AI Tech" },
    ],
    sourceDocument: "المستند المصدر",
    vault: "مقارنة عدة عقود (Vault)",
    vaultHint: "اختر من 2 إلى 5 ملفات للمقارنة",
    vaultTooFew: "اختر ملفين على الأقل للمقارنة.",
    vaultRemove: "إزالة من المقارنة",
    comparisonTitle: "جدول المقارنة",
    comparisonTopic: "الموضوع",
    comparisonPresent: "موجود",
    comparisonMissing: "غير موجود",
    comparisonDiffers: "فرق جوهري",
  },
};

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Chat[]) : [];
  } catch {
    return [];
  }
}
function saveChats(chats: Chat[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(chats.slice(0, 60)));
  } catch {
    /* private mode or quota, ignore */
  }
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function LegalOS() {
  const { lang, setLang } = useLang();
  const copy = OS[lang] ?? OS.he;
  const dir = LANGS.find((l) => l.code === lang)?.dir ?? "rtl";

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [listening, setListening] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  // Which finding's "copy revised wording" button most recently fired, so its
  // label can flip to a confirmation for a moment. One id at a time is enough:
  // nothing else on the page copies text to the clipboard.
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Selected firm playbook (lalum_playbooks.slug), empty string meaning
  // "no playbook, general review". The criteria text itself is fetched once
  // by slug so send() never needs a second round trip when the user picks one.
  const [playbookSlug, setPlaybookSlug] = useState("");
  const [playbookCriteria, setPlaybookCriteria] = useState<Record<string, string>>({});
  // Module 1.1, Vault: two to five documents queued for compare-contracts
  // instead of one attachment for analyze-contract. Mutually exclusive with
  // `attachment`: picking one clears the other, so send() never has to guess
  // which engine a message meant.
  const [vaultFiles, setVaultFiles] = useState<{ name: string; text: string }[]>([]);
  const [vaultExtracting, setVaultExtracting] = useState(false);
  const [vaultError, setVaultError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const vaultFileRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  // Load saved chats once, client-side only.
  useEffect(() => {
    setChats(loadChats());
  }, []);

  // Load the firm's playbooks once. lalum_playbooks is public read (RLS,
  // 0006_lalum_playbooks.sql): the criteria text itself lives in Hebrew in
  // the database, the selector's labels stay in this file's own OS
  // dictionary so they follow the page's five languages like everything else
  // here, joined only by the shared slug.
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("lalum_playbooks")
      .select("slug, criteria_text")
      .then(({ data }) => {
        if (!Array.isArray(data)) return;
        const map: Record<string, string> = {};
        for (const row of data as { slug?: unknown; criteria_text?: unknown }[]) {
          if (typeof row.slug === "string" && typeof row.criteria_text === "string") map[row.slug] = row.criteria_text;
        }
        setPlaybookCriteria(map);
      });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  // Persist the running conversation into its saved chat as it grows.
  useEffect(() => {
    if (!activeId || msgs.length === 0) return;
    setChats((list) => {
      const title = (msgs.find((m) => m.role === "user")?.content || copy.untitled).slice(0, 48);
      const found = list.find((c) => c.id === activeId);
      const next = found
        ? list.map((c) => (c.id === activeId ? { ...c, title, msgs, ts: Date.now() } : c))
        : [{ id: activeId, title, msgs, ts: Date.now() }, ...list];
      next.sort((a, b) => b.ts - a.ts);
      saveChats(next);
      return next;
    });
  }, [msgs, activeId, copy.untitled]);

  function reset() {
    setMsgs([]);
    setActiveId(null);
    setInput("");
    setAttachment(null);
    setPlaybookSlug("");
    setVaultFiles([]);
    setVaultError("");
    setNavOpen(false);
    inputRef.current?.focus();
  }
  function openChat(c: Chat) {
    setActiveId(c.id);
    setMsgs(c.msgs);
    setNavOpen(false);
  }
  function deleteChat(id: string) {
    setChats((list) => {
      const next = list.filter((c) => c.id !== id);
      saveChats(next);
      return next;
    });
    if (id === activeId) reset();
  }
  function useCommand(cmd: string) {
    setInput((v) => (v.trim().startsWith(cmd) ? v : `${cmd} ${v}`.trimStart()));
    setNavOpen(false);
    inputRef.current?.focus();
  }

  // Module 1.4, one-click redline: puts the engine's proposed clause straight
  // on the clipboard, ready to paste into a negotiation rider or a track-changes
  // draft, so a red or yellow finding does not require retyping its own fix.
  async function copyRevision(findingId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(findingId);
      setTimeout(() => setCopiedId((id) => (id === findingId ? null : id)), 1800);
    } catch {
      /* clipboard permission denied or unavailable; the button just does nothing */
    }
  }

  function speak(text: string) {
    if (!ttsOK || !text) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = bcp47For(lang);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }
  function toggleListen() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (!SpeechRec) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (SpeechRec as any)();
    rec.lang = bcp47For(lang);
    rec.interimResults = true;
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setVaultFiles([]);
    setVaultError("");
    setExtracting(true);
    try {
      const text = await extractText(file);
      setAttachment({ name: file.name, text });
    } catch {
      setAttachment({ name: file.name, text: "" });
    } finally {
      setExtracting(false);
      inputRef.current?.focus();
    }
  }

  // Module 1.1, Vault: same client-side extraction as a single attachment,
  // run over every selected file. A selection under two files does not clear
  // whatever was already queued: the toolbar hint stays visible instead of
  // silently discarding a first file while the person adds a second one.
  async function onVaultFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 5);
    if (vaultFileRef.current) vaultFileRef.current.value = "";
    if (files.length === 0) return;
    setAttachment(null);
    setVaultError("");
    setVaultExtracting(true);
    try {
      const extracted = await Promise.all(
        files.map(async (file) => {
          try {
            return { name: file.name, text: await extractText(file) };
          } catch {
            return { name: file.name, text: "" };
          }
        })
      );
      setVaultFiles((prev) => [...prev, ...extracted].slice(0, 5));
    } finally {
      setVaultExtracting(false);
      inputRef.current?.focus();
    }
  }
  function removeVaultFile(name: string) {
    setVaultFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function send() {
    const text = input.trim();
    if (vaultFiles.length === 1) {
      setVaultError(copy.vaultTooFew);
      return;
    }
    const hasVault = vaultFiles.length >= 2;
    if ((!text && !attachment && !hasVault) || loading) return;
    const displayText = hasVault
      ? `📎 ${vaultFiles.map((f) => f.name).join(", ")}`
      : text || (attachment ? `📎 ${attachment.name}` : "");
    const hasContractText = !!attachment?.text;
    const id = activeId ?? newId();
    if (!activeId) setActiveId(id);
    setMsgs((m) => [...m, { role: "user", content: displayText, file: hasVault ? undefined : attachment?.name }]);
    const attachedFile = attachment;
    const queuedVaultFiles = vaultFiles;
    const chosenPlaybook = playbookSlug ? copy.playbooks.find((p) => p.slug === playbookSlug) : undefined;
    const chosenCriteria = playbookSlug ? playbookCriteria[playbookSlug] : undefined;
    setInput("");
    setAttachment(null);
    setVaultFiles([]);
    setVaultError("");
    setPlaybookSlug("");
    setLoading(true);
    try {
      // Vault (Module 1.1): two to five queued documents route to
      // compare-contracts, a topic by topic matrix, never to analyze-contract
      // or the free chat model. Mutually exclusive with a single attachment
      // by construction (see onFile/onVaultFiles), so this check alone
      // decides the engine.
      if (hasVault && supabase) {
        const { data, error } = await supabase.functions.invoke("compare-contracts", {
          body: {
            documents: queuedVaultFiles.map((f) => ({ name: f.name, text: f.text })),
            ...(chosenCriteria ? { playbook_criteria: chosenCriteria, playbook_label: chosenPlaybook?.label } : {}),
          },
        });
        if (error) throw error;
        const topics: ComparisonTopic[] = Array.isArray(data?.topics) ? data.topics : [];
        const docNames: string[] = Array.isArray(data?.document_names)
          ? data.document_names
          : queuedVaultFiles.map((f) => f.name);
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: "", comparison: topics, comparisonDocs: docNames, comparisonDisclaimer: data?.disclaimer },
        ]);
      } else if (hasVault) {
        setMsgs((m) => [...m, { role: "assistant", content: copy.demo }]);
      } else if (hasContractText && supabase) {
        // A real, extracted attachment routes to analyze-contract, the strict
        // citation engine (supabase/functions/analyze-contract), instead of the
        // freeform chat model: a document gets structured, verified findings,
        // never prose. Any text typed alongside the file is shown in the thread
        // like always, but is not sent on, that engine takes a document and
        // nothing else. Plain text (no attachment, or one extractText could not
        // read) keeps going to lalum-assistant exactly as before.
        const { data, error } = await supabase.functions.invoke("analyze-contract", {
          body: {
            contract_text: attachedFile!.text,
            document_name: attachedFile!.name,
            ...(chosenCriteria ? { playbook_criteria: chosenCriteria, playbook_label: chosenPlaybook?.label } : {}),
          },
        });
        if (error) throw error;
        const findings: Finding[] = Array.isArray(data?.findings) ? data.findings : [];
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: "", findings, findingsDisclaimer: data?.disclaimer, docText: attachedFile!.text },
        ]);
      } else {
        const modelText = attachedFile
          ? `${copy.reviewPrefix} (${attachedFile.name}):\n\n${text || copy.reviewAsk}`
          : text;
        const convoForModel = [...msgs.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: modelText }];
        let reply = copy.demo;
        if (supabase) {
          const { data, error } = await supabase.functions.invoke("lalum-assistant", { body: { messages: convoForModel } });
          if (error) throw error;
          reply = ((data?.reply as string) || "").trim() || copy.error;
        }
        setMsgs((m) => [...m, { role: "assistant", content: reply }]);
        if (readAloud) speak(reply);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: copy.error }]);
    } finally {
      setLoading(false);
    }
  }

  // Shared by the split screen's findings pane and the pre-split-screen
  // fallback (a chat saved before docText existed) so the card markup lives
  // in exactly one place.
  function findingsList(findings: Finding[]) {
    if (findings.length === 0) return <p className="los-finding-empty">{copy.noFindings}</p>;
    return findings.map((f) => (
      <article key={f.finding_id} className={"los-finding sev-" + f.severity}>
        <header className="los-finding-head">
          <span className={"los-sev sev-" + f.severity}>
            {f.severity === "red" ? copy.sevRed : f.severity === "yellow" ? copy.sevYellow : copy.sevGreen}
          </span>
          {f.is_missing_clause && <span className="los-badge">{copy.missingClause}</span>}
          {f.clause_number && <span className="los-clause-no">§{f.clause_number}</span>}
        </header>
        <h3 className="los-finding-title">{f.clause_title}</h3>
        <p className="los-finding-text">{f.issue_summary}</p>
        {f.exact_quote && (
          <blockquote className="los-finding-quote">
            “{f.exact_quote}”
            <span className={"los-verify" + (f.quote_verified ? " ok" : "")}>
              {f.quote_verified ? copy.quoteVerified : copy.quoteUnverified}
            </span>
          </blockquote>
        )}
        <p className="los-finding-text los-finding-rationale">{f.legal_risk_rationale}</p>
        {f.proposed_revision && (
          <div className="los-revision">
            <div className="los-revision-label">{copy.proposedRevision}</div>
            <p className="los-finding-text">{f.proposed_revision}</p>
            <button type="button" className="los-copy-btn" onClick={() => void copyRevision(f.finding_id, f.proposed_revision!)}>
              {copiedId === f.finding_id ? copy.copied : copy.copyRevision}
            </button>
          </div>
        )}
      </article>
    ));
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const empty = msgs.length === 0;

  return (
    <div className="los-shell" lang={lang} dir={dir}>
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

        <div className="los-group-label">{copy.chatsLabel}</div>
        {chats.length === 0 ? (
          <p className="los-empty">{copy.historyEmpty}</p>
        ) : (
          chats.map((c) => (
            <div key={c.id} className={"los-chatrow" + (c.id === activeId ? " active" : "")}>
              <button type="button" className="los-chatopen" onClick={() => openChat(c)} title={c.title}>
                {c.title || copy.untitled}
              </button>
              <button type="button" className="los-chatdel" onClick={() => deleteChat(c.id)} aria-label={copy.deleteChat} title={copy.deleteChat}>×</button>
            </div>
          ))
        )}

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
          <span className="los-topbar-title">LALUM LEX</span>
          {ttsOK && (
            <button
              type="button"
              className={"los-tts" + (readAloud ? " on" : "")}
              onClick={() => { const n = !readAloud; setReadAloud(n); if (!n && ttsOK) window.speechSynthesis.cancel(); }}
              aria-pressed={readAloud}
              title={copy.readAloud}
              aria-label={copy.readAloud}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>
            </button>
          )}
          <span className="los-status">● {{ he: "מוכן", ar: "جاهز", es: "Listo", fr: "Prêt", en: "Ready" }[lang]}</span>
        </header>

        <div className="los-body" ref={scrollRef}>
          {empty ? (
            <div className="los-zero">
              <div className="los-zero-mark">✳</div>
              <h1 className="los-zero-title">LALUM LEX</h1>
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
              {msgs.map((m, i) =>
                m.comparison ? (
                  <div key={i} className="los-msg assistant">
                    <div className="los-matrix-wrap">
                      <table className="los-matrix">
                        <thead>
                          <tr>
                            <th>{copy.comparisonTopic}</th>
                            {(m.comparisonDocs ?? []).map((name, di) => (
                              <th key={di}>📎 {name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {m.comparison.map((t, ti) => (
                            <tr key={ti} className={t.materially_differs ? "differs" : ""}>
                              <td className="los-matrix-topic">
                                {t.topic}
                                {t.materially_differs && <span className="los-matrix-flag">{copy.comparisonDiffers}</span>}
                                <p className="los-matrix-note">{t.comparison_note}</p>
                              </td>
                              {(m.comparisonDocs ?? []).map((_, di) => {
                                const cell = t.cells.find((c) => c.document_index === di);
                                if (!cell) return <td key={di} className="los-matrix-cell empty" />;
                                return (
                                  <td key={di} className={"los-matrix-cell " + (cell.present ? "present" : "missing")}>
                                    <span className="los-matrix-cell-status">
                                      {cell.present ? copy.comparisonPresent : copy.comparisonMissing}
                                    </span>
                                    <p className="los-matrix-cell-text">{cell.summary}</p>
                                    {cell.exact_quote && (
                                      <blockquote className="los-finding-quote">
                                        “{cell.exact_quote}”
                                        <span className={"los-verify" + (cell.quote_verified ? " ok" : "")}>
                                          {cell.quote_verified ? copy.quoteVerified : copy.quoteUnverified}
                                        </span>
                                      </blockquote>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {m.comparisonDisclaimer && <p className="los-findings-disclaimer">{m.comparisonDisclaimer}</p>}
                  </div>
                ) : m.findings ? (
                  <div key={i} className="los-msg assistant">
                    {m.docText ? (
                      // Module 2, split screen: the submitted document on one
                      // side, its findings on the other, so a reviewer checks
                      // a citation against its own source without leaving the
                      // page. Chats saved before docText existed (m.docText
                      // absent) fall back to the findings-only view below.
                      <div className="los-split">
                        <div className="los-split-doc">
                          <div className="los-split-doc-head">{m.file ? `📎 ${m.file}` : copy.sourceDocument}</div>
                          <pre className="los-split-doc-text">{m.docText}</pre>
                        </div>
                        <div className="los-findings">{findingsList(m.findings)}</div>
                      </div>
                    ) : (
                      <div className="los-findings">{findingsList(m.findings)}</div>
                    )}
                    {m.findingsDisclaimer && <p className="los-findings-disclaimer">{m.findingsDisclaimer}</p>}
                  </div>
                ) : (
                  <div key={i} className={"los-msg " + m.role}>
                    <div className="los-bubble">
                      {m.file && <span className="los-bubble-file">📎 {m.file}</span>}
                      {m.content}
                    </div>
                  </div>
                )
              )}
              {loading && <div className="los-msg assistant"><div className="los-bubble los-typing">{copy.thinking}</div></div>}
            </div>
          )}
        </div>

        <div className="los-composer">
          {attachment && (
            <div className="los-attach">
              <span>📎 {attachment.name}</span>
              <select
                className="los-playbook-select"
                value={playbookSlug}
                onChange={(e) => setPlaybookSlug(e.target.value)}
                aria-label={copy.playbookLabel}
                title={copy.playbookLabel}
              >
                <option value="">{copy.playbookNone}</option>
                {copy.playbooks.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.label}</option>
                ))}
              </select>
              <button type="button" onClick={() => { setAttachment(null); setPlaybookSlug(""); }} aria-label="×">×</button>
            </div>
          )}
          {vaultFiles.length > 0 && (
            <div className="los-attach los-vault-chips">
              {vaultFiles.map((f) => (
                <span key={f.name} className="los-vault-chip">
                  📎 {f.name}
                  <button type="button" onClick={() => removeVaultFile(f.name)} aria-label={copy.vaultRemove} title={copy.vaultRemove}>×</button>
                </span>
              ))}
              <select
                className="los-playbook-select"
                value={playbookSlug}
                onChange={(e) => setPlaybookSlug(e.target.value)}
                aria-label={copy.playbookLabel}
                title={copy.playbookLabel}
              >
                <option value="">{copy.playbookNone}</option>
                {copy.playbooks.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.label}</option>
                ))}
              </select>
            </div>
          )}
          {vaultError && <p className="los-vault-error">{vaultError}</p>}
          {vaultFiles.length === 0 && <p className="los-vault-hint">{copy.vaultHint}</p>}
          <div className="los-input-row">
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={onFile} hidden />
            <input ref={vaultFileRef} type="file" accept=".pdf,.docx,.doc,.txt" multiple onChange={onVaultFiles} hidden />
            <button type="button" className="los-tool" onClick={() => fileRef.current?.click()} disabled={extracting} title={copy.attach} aria-label={copy.attach}>
              {extracting
                ? <span className="los-spin" />
                : <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.5 12.5 21a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3l7.5-7.5" /></svg>}
            </button>
            <button type="button" className="los-tool" onClick={() => vaultFileRef.current?.click()} disabled={vaultExtracting} title={copy.vault} aria-label={copy.vault}>
              {vaultExtracting
                ? <span className="los-spin" />
                : <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="8" height="16" rx="1.5" /><rect x="13" y="4" width="8" height="16" rx="1.5" /></svg>}
            </button>
            {!!SpeechRec && (
              <button type="button" className={"los-tool" + (listening ? " rec" : "")} onClick={toggleListen} title={copy.mic} aria-label={copy.mic} aria-pressed={listening}>
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>
              </button>
            )}
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
            <button
              type="button"
              className="los-send"
              onClick={() => void send()}
              disabled={loading || (!input.trim() && !attachment && vaultFiles.length === 0)}
              aria-label={copy.send}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
          <p className="los-disclaimer" dir="auto" lang={bcp47For(lang)}>{copy.disclaimer}</p>
        </div>
      </main>
    </div>
  );
}

// This page's own dark, full-screen chat shell is unchanged: only its accent
// colour is. It used to run a gold accent (#d9a441) unrelated to both the
// site's clay and /portal's green, plus 3 spots (.los-zero-mark, .los-send)
// that leaked the marketing clay in on top of that. Both are now the one
// sage green /portal uses for its own primary button (#5a7a5d / #4c6850
// hover), so the two signed-in app surfaces read as one product colour.
// #8fc090 is that same green lightened for foreground text/borders sitting
// directly on this near-black shell (~9:1 contrast, matching what the gold
// it replaces had) rather than /portal's on-white --clay-bright.
const LOS_CSS = `
.los-shell{position:fixed;inset:0;display:flex;background:#141210;color:#f3ece0;font-family:var(--sans);z-index:1;overflow:hidden}
.los-side{width:270px;flex:none;display:flex;flex-direction:column;gap:6px;padding:16px 14px;background:#0f0d0b;border-inline-end:1px solid rgba(255,255,255,.07);overflow-y:auto}
.los-brand{display:inline-flex;color:#f3ece0;padding:6px 6px 12px}
.los-new{display:block;width:100%;text-align:start;padding:11px 14px;margin-bottom:8px;border-radius:12px;border:1px solid rgba(143,192,144,.4);background:transparent;color:#f3ece0;font:inherit;font-weight:700;cursor:pointer}
.los-new:hover{background:rgba(143,192,144,.12)}
.los-group-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8072;margin:14px 6px 4px}
.los-eng{display:block;width:100%;text-align:start;padding:9px 12px;border-radius:11px;border:1px solid transparent;background:transparent;color:#f3ece0;font:inherit;cursor:pointer}
.los-eng:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08)}
.los-eng-cmd{display:inline-block;font-weight:700;color:#8fc090;font-size:13px;margin-inline-end:8px}
.los-eng-label{font-weight:600;font-size:13.5px}
.los-eng-desc{display:block;color:#9a9081;font-size:11.5px;margin-top:2px;line-height:1.4}
.los-empty{color:#8a8072;font-size:12.5px;padding:2px 8px 4px;margin:0}
.los-chatrow{display:flex;align-items:center;border-radius:10px}
.los-chatrow:hover{background:rgba(255,255,255,.05)}
.los-chatrow.active{background:rgba(143,192,144,.12)}
.los-chatopen{flex:1;min-width:0;text-align:start;padding:8px 12px;border:none;background:transparent;color:#cfc6b8;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.los-chatrow.active .los-chatopen{color:#f3ece0}
.los-chatdel{flex:none;width:28px;height:28px;margin-inline-end:4px;border:none;background:transparent;color:#8a8072;font-size:18px;line-height:1;cursor:pointer;border-radius:7px}
.los-chatdel:hover{color:#f3ece0;background:rgba(255,255,255,.08)}
.los-link{display:block;padding:8px 12px;border-radius:10px;color:#cfc6b8;text-decoration:none;font-size:13.5px}
.los-link:hover{background:rgba(255,255,255,.05);color:#f3ece0}
.los-side-foot{margin-top:auto;padding-top:12px}
.los-langs{display:flex;flex-wrap:wrap;gap:6px;padding:6px}
.los-lang{padding:5px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#cfc6b8;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.los-lang.active{background:rgba(143,192,144,.16);border-color:rgba(143,192,144,.5);color:#f3ece0}
.los-back{display:block;padding:9px 12px;margin-top:6px;color:#9a9081;text-decoration:none;font-size:13px}
.los-back:hover{color:#f3ece0}
.los-main{flex:1;min-width:0;display:flex;flex-direction:column}
.los-topbar{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.los-burger{display:none;width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#f3ece0;cursor:pointer;align-items:center;justify-content:center}
.los-topbar-title{font-weight:700;letter-spacing:.04em;font-size:14px}
.los-tts{width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#9a9081;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.los-tts.on{color:#8fc090;border-color:rgba(143,192,144,.5);background:rgba(143,192,144,.12)}
.los-status{margin-inline-start:auto;color:#7fd598;font-size:12px}
.los-body{flex:1;overflow-y:auto;padding:24px 18px}
.los-zero{max-width:640px;margin:6vh auto 0;text-align:center;padding:0 12px}
.los-zero-mark{color:#8fc090;font-size:34px;line-height:1}
.los-zero-title{font-family:var(--serif);font-size:clamp(30px,6vw,46px);margin:14px 0 2px;letter-spacing:.02em}
.los-zero-kicker{font-size:12px;letter-spacing:.28em;color:#8fc090}
.los-zero-sub{color:#b7ad9d;margin:14px 0 22px;font-size:15px}
.los-zero-prompt{color:#9a9081;font-size:13.5px;margin-bottom:14px}
.los-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.los-chip{padding:10px 16px;border-radius:9999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);color:#f3ece0;font:inherit;font-size:13.5px;cursor:pointer}
.los-chip b{color:#8fc090;margin-inline-end:4px}
.los-chip:hover{border-color:rgba(143,192,144,.5);background:rgba(143,192,144,.1)}
.los-thread{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.los-msg{display:flex}
.los-msg.user{justify-content:flex-end}
.los-bubble{max-width:82%;padding:13px 16px;border-radius:16px;font-size:14.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.los-bubble-file{display:block;font-size:12px;opacity:.85;margin-bottom:5px}
.los-msg.user .los-bubble{background:#7a1f1f;color:#fdf6ef;border-end-end-radius:5px}
.los-msg.assistant .los-bubble{background:#211d19;border:1px solid rgba(255,255,255,.08);color:#eee6d8;border-end-start-radius:5px}
.los-typing{color:#9a9081}
/* Findings cards (analyze-contract). Severity is a status colour, not a
   brand colour, so red and yellow are new here; green deliberately reuses
   the page's own #8fc090/rgba(143,192,144,*) tokens rather than a fourth
   shade, so "no issue" and "this app" read as the same colour on purpose. */
.los-findings{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.los-finding{background:#211d19;border:1px solid rgba(255,255,255,.08);border-inline-start-width:3px;border-radius:14px;padding:14px 16px}
.los-finding.sev-red{border-inline-start-color:#e0574a}
.los-finding.sev-yellow{border-inline-start-color:#d9a441}
.los-finding.sev-green{border-inline-start-color:#8fc090}
.los-finding-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.los-sev{font-size:11px;font-weight:700;letter-spacing:.04em;padding:3px 9px;border-radius:9999px}
.los-sev.sev-red{color:#e0574a;background:rgba(224,87,74,.12);border:1px solid rgba(224,87,74,.35)}
.los-sev.sev-yellow{color:#d9a441;background:rgba(217,164,65,.12);border:1px solid rgba(217,164,65,.35)}
.los-sev.sev-green{color:#8fc090;background:rgba(143,192,144,.12);border:1px solid rgba(143,192,144,.35)}
.los-badge{font-size:11px;color:#b7ad9d;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:9999px;padding:3px 9px}
.los-clause-no{font-size:11.5px;color:#8a8072}
.los-finding-title{font-size:15px;margin:2px 0 6px;color:#f3ece0}
.los-finding-text{font-size:13.5px;line-height:1.6;color:#eee6d8;margin:0 0 8px}
.los-finding-rationale{color:#cfc6b8}
.los-finding-quote{margin:0 0 8px;padding-inline-start:10px;border-inline-start:2px solid rgba(255,255,255,.15);font-size:13px;font-style:italic;color:#b7ad9d}
.los-verify{display:block;margin-top:4px;font-style:normal;font-size:11px;color:#8a8072}
.los-verify.ok{color:#8fc090}
.los-revision{background:rgba(143,192,144,.08);border:1px solid rgba(143,192,144,.25);border-radius:10px;padding:10px 12px;margin-top:4px}
.los-revision-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8fc090;margin-bottom:4px}
.los-copy-btn{border:1px solid rgba(143,192,144,.4);background:transparent;color:#bcd6bd;font:inherit;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:9999px;cursor:pointer}
.los-copy-btn:hover{background:rgba(143,192,144,.12)}
.los-finding-empty{color:#9a9081;font-size:13.5px}
.los-findings-disclaimer{max-width:760px;margin:8px auto 0;color:#8c8272;font-size:11.5px}
/* Module 2, split screen: document pane beside the findings pane instead of
   findings alone. The thread column widens only for a message that actually
   contains a split, so a plain chat reply still reads at the usual 760px. */
.los-thread:has(.los-split),.los-thread:has(.los-matrix-wrap){max-width:1100px}
.los-split{display:flex;gap:16px;align-items:flex-start;width:100%}
.los-split-doc{flex:0 0 40%;min-width:0;max-height:65vh;overflow:auto;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px}
.los-split-doc-head{font-size:12px;font-weight:700;color:#bcd6bd;margin-bottom:8px}
.los-split-doc-text{white-space:pre-wrap;word-break:break-word;font:inherit;font-size:12.5px;line-height:1.6;color:#d8d0c2;margin:0}
.los-split>.los-findings{flex:1 1 60%;min-width:0;max-width:none;margin:0}
/* Module 1.1, Vault: a topic by topic comparison matrix across two to five
   submitted documents, replacing the single-document findings view for a
   compare-contracts message. */
.los-matrix-wrap{width:100%;overflow-x:auto}
.los-matrix{width:100%;border-collapse:separate;border-spacing:0 10px}
.los-matrix th{text-align:start;font-size:12px;font-weight:700;color:#bcd6bd;padding:0 10px 4px;white-space:nowrap}
.los-matrix td{background:#211d19;border:1px solid rgba(255,255,255,.08);vertical-align:top;padding:12px 14px;font-size:13.5px}
.los-matrix tr.differs td{border-color:rgba(217,164,65,.45)}
.los-matrix td:first-child{border-start-start-radius:12px;border-end-start-radius:12px}
.los-matrix td:last-child{border-start-end-radius:12px;border-end-end-radius:12px}
.los-matrix-topic{min-width:180px;font-weight:700;color:#f3ece0}
.los-matrix-flag{display:inline-block;margin-inline-start:8px;font-size:10.5px;font-weight:700;color:#d9a441;background:rgba(217,164,65,.12);border:1px solid rgba(217,164,65,.4);border-radius:999px;padding:2px 8px;vertical-align:middle}
.los-matrix-note{margin:6px 0 0;font-weight:400;color:#9a9081;font-size:12px}
.los-matrix-cell{min-width:220px}
.los-matrix-cell.missing{color:#c9beb0}
.los-matrix-cell-status{display:inline-block;font-size:10.5px;font-weight:700;border-radius:999px;padding:2px 8px}
.los-matrix-cell.present .los-matrix-cell-status{color:#bcd6bd;background:rgba(143,192,144,.14);border:1px solid rgba(143,192,144,.4)}
.los-matrix-cell.missing .los-matrix-cell-status{color:#c9beb0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14)}
.los-matrix-cell-text{margin:6px 0 0}
.los-composer{padding:12px 18px 16px;border-top:1px solid rgba(255,255,255,.07)}
.los-attach{max-width:760px;margin:0 auto 8px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:12.5px;color:#bcd6bd;background:rgba(143,192,144,.1);border:1px solid rgba(143,192,144,.3);border-radius:10px;padding:6px 12px;width:fit-content}
.los-attach button{border:none;background:transparent;color:#bcd6bd;font-size:16px;line-height:1;cursor:pointer}
.los-vault-chip{display:inline-flex;align-items:center;gap:4px}
.los-vault-hint,.los-vault-error{max-width:760px;margin:0 auto 6px;font-size:11.5px;color:#8c8272;text-align:center}
.los-vault-error{color:#e0574a}
.los-playbook-select{border:1px solid rgba(143,192,144,.35);background:#1c1a16;color:#bcd6bd;font:inherit;font-size:12px;border-radius:7px;padding:4px 8px;cursor:pointer;max-width:180px}
.los-playbook-select:focus-visible{outline:2px solid #8fc090;outline-offset:1px}
.los-input-row{max-width:760px;margin:0 auto;display:flex;align-items:flex-end;gap:6px;background:#1d1a16;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:8px 10px}
.los-input{flex:1;resize:none;max-height:160px;background:transparent;border:none;outline:none;color:#f3ece0;font:inherit;font-size:14.5px;line-height:1.5;padding:8px 4px}
.los-input::placeholder{color:#8c8272}
.los-tool{flex:none;width:38px;height:38px;border-radius:11px;border:none;background:transparent;color:#b7ad9d;cursor:pointer;display:flex;align-items:center;justify-content:center}
.los-tool:hover{background:rgba(255,255,255,.06);color:#f3ece0}
.los-tool:disabled{opacity:.5;cursor:default}
.los-tool.rec{color:#e06a4a;background:rgba(224,106,74,.14)}
.los-send{flex:none;width:40px;height:40px;border-radius:12px;border:none;background:#5a7a5d;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.los-send:disabled{opacity:.4;cursor:default}
.los-send:not(:disabled):hover{background:#4c6850}
.los-spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:#8fc090;animation:los-spin .7s linear infinite}
@keyframes los-spin{to{transform:rotate(360deg)}}
.los-disclaimer{max-width:760px;margin:8px auto 0;text-align:center;color:#8c8272;font-size:11.5px}
.los-scrim{display:none}
@media (max-width:820px){
  .los-side{position:fixed;inset-block:0;inset-inline-start:0;width:min(300px,86vw);transform:translateX(-100%);transition:transform .22s ease;z-index:20;box-shadow:0 0 40px rgba(0,0,0,.5)}
  .los-shell[dir="rtl"] .los-side{transform:translateX(100%)}
  .los-side.open,.los-shell[dir="rtl"] .los-side.open{transform:translateX(0)}
  .los-scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:15}
  .los-burger{display:inline-flex}
  .los-thread:has(.los-split),.los-thread:has(.los-matrix-wrap){max-width:760px}
  .los-split{flex-direction:column}
  .los-split-doc{flex:none;width:100%;max-height:38vh}
  .los-matrix-topic,.los-matrix-cell{min-width:150px}
}
`;

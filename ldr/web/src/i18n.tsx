import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Lightweight i18n: language context + translation dictionary + RTL/LTR switching.
// Add languages by extending LANGS and the per-key dictionary below.

export type Lang = "he" | "en" | "ru";

export const LANGS: { code: Lang; label: string; flag: string; dir: "rtl" | "ltr" }[] = [
  { code: "he", label: "עברית", flag: "🇮🇱", dir: "rtl" },
  { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ru", label: "Русский", flag: "🇷🇺", dir: "ltr" },
];

// key → { he, en, ru }
const DICT: Record<string, Record<Lang, string>> = {
  "nav.signin": { he: "כניסה", en: "Sign in", ru: "Вход" },
  "nav.signup": { he: "הרשמה חינם", en: "Join free", ru: "Регистрация" },

  "hero.badge": { he: "🇮🇱 פיילוט · ישראל · מתרחב לעוד מדינות", en: "🇮🇱 PILOT · Israel · expanding to more countries", ru: "🇮🇱 ПИЛОТ · Израиль · скоро в других странах" },
  "hero.live": { he: "הרשת פעילה עכשיו", en: "The network is live now", ru: "Сеть уже активна" },
  "hero.title1": { he: "כל מה שעו״ד צריך", en: "Everything an attorney needs", ru: "Всё, что нужно юристу" },
  "hero.title2": { he: "במקום אחד.", en: "in one place.", ru: "в одном месте." },
  "hero.title3": { he: "הבית המקצועי שלכם.", en: "Your professional home.", ru: "Ваш профессиональный дом." },
  "hero.lead": {
    he: "הצטרפו לקהילה הסגורה של עורכי הדין בישראל. גלו עמיתים בקרבתכם על המפה, קבלו הפניות תיקים והרחיבו את הפרקטיקה — בלי עמלות, בלי רעש.",
    en: "Join the closed community of attorneys. Discover peers near you on the map, receive case referrals and grow your practice — no fees, no noise.",
    ru: "Присоединяйтесь к закрытому сообществу юристов. Находите коллег рядом на карте, получайте передачи дел и развивайте практику — без комиссий и шума.",
  },
  "hero.trust1": { he: "✓ הרשמה תוך דקה", en: "✓ Sign up in a minute", ru: "✓ Регистрация за минуту" },
  "hero.trust2": { he: "✓ חינם לחלוטין", en: "✓ Completely free", ru: "✓ Полностью бесплатно" },
  "hero.trust3": { he: "✓ אימות לפי מספר רישיון ושם", en: "✓ Verified by license number & name", ru: "✓ Проверка по номеру лицензии и имени" },
  "hero.cta": { he: "הצטרפו עכשיו — חינם →", en: "Join now — free →", ru: "Присоединиться — бесплатно →" },

  "feat.knowledge": { he: "מקור ידע אחד", en: "One source of knowledge", ru: "Единый источник знаний" },
  "feat.network": { he: "חיבורים ושיתופי פעולה", en: "Connections & collaboration", ru: "Связи и сотрудничество" },
  "feat.leads": { he: "לידים והפניות — ללא עמלות", en: "Leads & referrals — no fees", ru: "Лиды и передачи — без комиссий" },

  "map.title": { he: "🗺️ כל עורכי הדין ברשת — על המפה", en: "🗺️ Every attorney in the network — on the map", ru: "🗺️ Все юристы сети — на карте" },
  "map.subtitle": { he: "בסגנון Waze · פנים + טבעת לפי דרגת ותק", en: "Waze-style · faces + seniority-level ring", ru: "В стиле Waze · лица + кольцо по уровню" },
  "map.search": { he: "חיפוש עו״ד, משרד או תחום...", en: "Search attorneys, firms or fields...", ru: "Поиск юристов, фирм или областей..." },
  "map.count": { he: "עורכי דין על המפה", en: "attorneys on the map", ru: "юристов на карте" },
  "map.viewProfile": { he: "פרופיל", en: "Profile", ru: "Профиль" },
  "map.country": { he: "מדינה", en: "Country", ru: "Страна" },
  "map.chat": { he: "צ׳אט", en: "Chat", ru: "Чат" },
  "map.schedule": { he: "קביעת פגישה", en: "Book a meeting", ru: "Записаться" },
  "chat.with": { he: "צ׳אט עם", en: "Chat with", ru: "Чат с" },
  "chat.hello": { he: "שלום, אשמח לשמוע איך אפשר לעזור.", en: "Hi, happy to hear how I can help.", ru: "Здравствуйте, чем могу помочь?" },
  "chat.placeholder": { he: "כתבו הודעה...", en: "Type a message...", ru: "Сообщение..." },
  "chat.send": { he: "שלח", en: "Send", ru: "Отправить" },
  "sched.with": { he: "קביעת פגישה עם", en: "Book a meeting with", ru: "Запись к" },
  "sched.pick": { he: "בחרו יום ושעה פנויים", en: "Pick an available day & time", ru: "Выберите день и время" },
  "sched.confirm": { he: "אישור פגישה", en: "Confirm meeting", ru: "Confirm meeting" },
  "sched.booked": { he: "הפגישה נקבעה! נשלח אישור.", en: "Meeting booked! A confirmation is on its way.", ru: "Встреча назначена!" },
  "c.IL": { he: "🇮🇱 ישראל", en: "🇮🇱 Israel", ru: "🇮🇱 Израиль" },
  "c.US": { he: "🇺🇸 ארה״ב", en: "🇺🇸 USA", ru: "🇺🇸 США" },
  "c.UK": { he: "🇬🇧 בריטניה", en: "🇬🇧 UK", ru: "🇬🇧 Великобритания" },
  "c.DE": { he: "🇩🇪 גרמניה", en: "🇩🇪 Germany", ru: "🇩🇪 Германия" },
  "c.FR": { he: "🇫🇷 צרפת", en: "🇫🇷 France", ru: "🇫🇷 Франция" },
  "c.CA": { he: "🇨🇦 קנדה", en: "🇨🇦 Canada", ru: "🇨🇦 Канада" },
  "map.tenure": { he: "דרגת ותק", en: "Seniority", ru: "Стаж" },
  "level.senior": { he: "בכיר", en: "Senior", ru: "Старший" },
  "level.mid": { he: "מנוסה", en: "Experienced", ru: "Опытный" },
  "level.junior": { he: "מתחיל", en: "Junior", ru: "Младший" },

  "auth.signinTitle": { he: "שמחים לראותכם חזרה 👋", en: "Welcome back 👋", ru: "С возвращением 👋" },
  "auth.signupTitle": { he: "הצטרפו לרשת העו״ד המאומתים", en: "Join the verified attorney network", ru: "Присоединяйтесь к сети проверенных юристов" },
  "auth.signupSub": { he: "הרשמה חינמית ומהירה — תוך דקה אתם בפנים. אימות מאובטח לפי מספר רישיון ושם. 🔒", en: "Free, fast signup — you're in within a minute. Secure verification by license number & name. 🔒", ru: "Бесплатная быстрая регистрация — за минуту. Безопасная проверка по номеру лицензии и имени. 🔒" },
  "auth.licenseNote": { he: "הרישיון מאומת לפי מספר חבר ושם.", en: "License verified by membership number & name.", ru: "Лицензия проверяется по номеру и имени." },
  "auth.google": { he: "המשך עם Google", en: "Continue with Google", ru: "Продолжить с Google" },
  "auth.or": { he: "או", en: "or", ru: "или" },

  "about": { he: "אודות", en: "About", ru: "О нас" },
};

type Ctx = { lang: Lang; dir: "rtl" | "ltr"; setLang: (l: Lang) => void; t: (k: string) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("lawdin_lang")) as Lang | null;
    return saved && LANGS.some((l) => l.code === saved) ? saved : "he";
  });
  const dir = LANGS.find((l) => l.code === lang)!.dir;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem("lawdin_lang", l); } catch { /* ignore */ } };
  const t = (k: string) => DICT[k]?.[lang] ?? DICT[k]?.he ?? k;

  return <I18nContext.Provider value={{ lang, dir, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}

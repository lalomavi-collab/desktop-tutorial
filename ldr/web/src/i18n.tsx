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
  "map.perHour": { he: "/ שעה", en: "/ hr", ru: "/ час" },
  "map.rate": { he: "תעריף ייעוץ", en: "Consultation rate", ru: "Ставка" },
  "map.byAgreement": { he: "מחיר בתיאום", en: "By agreement", ru: "По договорённости" },
  "prof.about": { he: "אודות", en: "About", ru: "О юристе" },
  "prof.areas": { he: "תחומי התמחות", en: "Practice areas", ru: "Области права" },
  "prof.reviews": { he: "ביקורות", en: "Reviews", ru: "Отзывы" },
  "prof.experience": { he: "ותק", en: "Experience", ru: "Опыт" },
  "prof.bio": { he: "עו״ד מנוסה המעניק/ה ליווי משפטי מקצועי, אישי וצמוד. ייעוץ, ייצוג וניהול תיקים מורכבים בגישה אסטרטגית וברורה.", en: "An experienced attorney providing professional, personal and hands-on legal support: consulting, representation and complex case management with a clear strategic approach.", ru: "Опытный юрист, оказывающий профессиональное персональное сопровождение: консультации, представительство и ведение сложных дел." },
  "prof.review1": { he: "מקצועי, זמין ומסביר כל שלב. ממליץ בחום.", en: "Professional, available and explains every step. Highly recommend.", ru: "Профессионально и доступно. Рекомендую." },
  "prof.review2": { he: "ליווי צמוד והשיג עבורי תוצאה מצוינת.", en: "Close guidance and achieved an excellent result for me.", ru: "Внимательное сопровождение и отличный результат." },
  "profile.byHour": { he: "אני גובה לפי שעה (המחיר יוצג ללקוחות)", en: "I charge by the hour (shown to clients)", ru: "Почасовая оплата (видно клиентам)" },
  "profile.byAgreementNote": { he: "ללא סימון — המחיר ייסגר ישירות מול הלקוח.", en: "Unchecked — price is agreed directly with the client.", ru: "Без галочки — цена согласуется с клиентом." },
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
  "auth.signupTitle": { he: "הצטרפו לרשת עורכי הדין", en: "Join the attorney network", ru: "Присоединяйтесь к сети юристов" },
  "auth.signupSub": { he: "הרשמה חינמית — תוך דקה אתם בפנים. 🔒", en: "Free signup — you're in within a minute. 🔒", ru: "Бесплатно — за минуту. 🔒" },
  "auth.licenseNote": { he: "הרישיון מאומת לפי מספר חבר ושם.", en: "License verified by membership number & name.", ru: "Лицензия проверяется по номеру и имени." },
  "auth.google": { he: "המשך עם Google", en: "Continue with Google", ru: "Продолжить с Google" },
  "auth.or": { he: "או", en: "or", ru: "или" },
  "auth.email": { he: "אימייל", en: "Email", ru: "Эл. почта" },
  "auth.password": { he: "סיסמה", en: "Password", ru: "Пароль" },
  "auth.passwordHint": { he: "(8+ תווים)", en: "(8+ chars)", ru: "(8+ симв.)" },
  "auth.confirmPassword": { he: "אימות סיסמה", en: "Confirm password", ru: "Повтор пароля" },
  "auth.accountType": { he: "אני נרשם/ת בתור", en: "I'm signing up as", ru: "Я регистрируюсь как" },
  "auth.attorney": { he: "⚖️ עורך/ת דין", en: "⚖️ Attorney", ru: "⚖️ Адвокат" },
  "auth.client": { he: "👤 לקוח פרטי", en: "👤 Client", ru: "👤 Клиент" },
  "auth.fullName": { he: "שם מלא", en: "Full name", ru: "Полное имя" },
  "auth.namePlaceholder": { he: "עו״ד ישראל ישראלי", en: "Adv. Jane Doe", ru: "Адв. Иван Иванов" },
  "auth.licenseNo": { he: "מספר רישיון עו״ד", en: "Bar license number", ru: "Номер лицензии адвоката" },
  "auth.enterNetwork": { he: "כניסה לרשת", en: "Enter the network", ru: "Войти в сеть" },
  "auth.forgot": { he: "שכחתי סיסמה", en: "Forgot password", ru: "Забыли пароль" },
  "auth.signupBtn": { he: "הרשמה — בחינם", en: "Sign up — free", ru: "Регистрация — бесплатно" },
  "auth.resetTitle": { he: "שחזור סיסמה", en: "Reset password", ru: "Сброс пароля" },
  "auth.resetDesc": { he: "הזינו את כתובת האימייל שלכם ונשלח קישור לאיפוס.", en: "Enter your email and we'll send a reset link.", ru: "Введите email — мы отправим ссылку для сброса." },
  "auth.resetSend": { he: "שלחו קישור שחזור", en: "Send reset link", ru: "Отправить ссылку" },
  "auth.back": { he: "חזרה", en: "Back", ru: "Назад" },
  "auth.backToSignin": { he: "חזרה לכניסה", en: "Back to sign in", ru: "Назад ко входу" },
  "auth.resetSentTitle": { he: "קישור שחזור נשלח", en: "Reset link sent", ru: "Ссылка отправлена" },
  "auth.checkInbox": { he: "בדקו את תיבת הדואר של", en: "Check the inbox of", ru: "Проверьте почту" },
  "auth.resetSentTail": { he: "ולחצו על הקישור לאיפוס הסיסמה.", en: "and click the link to reset your password.", ru: "и перейдите по ссылке для сброса пароля." },
  "auth.emailSent": { he: "נשלח אליך אימייל אימות — לחץ על הקישור ותחזור לכאן להתחברות.", en: "A verification email was sent — click the link and return here to sign in.", ru: "Письмо подтверждения отправлено — перейдите по ссылке и вернитесь для входа." },
  "err.licenseRequired": { he: "יש להזין מספר רישיון עו״ד", en: "Please enter your Bar license number", ru: "Введите номер лицензии" },
  "err.passwordLen": { he: "הסיסמה חייבת להכיל לפחות 8 תווים", en: "Password must be at least 8 characters", ru: "Пароль не менее 8 символов" },
  "err.passwordMatch": { he: "הסיסמאות אינן תואמות", en: "Passwords don't match", ru: "Пароли не совпадают" },

  "invite.banner": { he: "🎟️ הוזמנת לחדר ההחלטות — הירשם/י כדי להצטרף מיד.", en: "🎟️ You've been invited to the decision room — sign up to join now.", ru: "🎟️ Вас пригласили — зарегистрируйтесь, чтобы присоединиться." },
  "stats.areas": { he: "תחומי עיסוק", en: "practice areas", ru: "области права" },
  "stats.countries": { he: "מדינות", en: "countries", ru: "страны" },
  "stats.fee": { he: "עמלת הפניית תיקים", en: "case-referral fee", ru: "комиссия за передачу" },
  "stats.members": { he: "עו״ד כבר ברשת", en: "attorneys already in the network", ru: "юристов уже в сети" },
  "roadmap": { he: "🚀 פיילוט ישראל — בקרוב גם EU וארה״ב.", en: "🚀 Israel pilot — EU & US coming soon.", ru: "🚀 Пилот в Израиле — скоро ЕС и США." },
  "members.title": { he: "מי כבר ברשת", en: "Who's already in the network", ru: "Кто уже в сети" },
  "members.verified": { he: "· עורכי דין", en: "· attorneys", ru: "· юристы" },

  "notif.title": { he: "התראות מערכת", en: "System notifications", ru: "Уведомления" },
  "notif.1": { he: "ברוכים הבאים ל-LAWdin 👋", en: "Welcome to LAWdin 👋", ru: "Добро пожаловать в LAWdin 👋" },
  "notif.2": { he: "עורכי דין חדשים הצטרפו לרשת השבוע", en: "New attorneys joined the network this week", ru: "На этой неделе присоединились новые юристы" },
  "notif.3": { he: "בקרוב: השכרת חדרים במשרד בין עמיתים", en: "Soon: peer-to-peer office room rental", ru: "Скоро: аренда кабинетов между коллегами" },
  "notif.empty": { he: "אין התראות חדשות", en: "No new notifications", ru: "Нет новых уведомлений" },

  "about": { he: "אודות", en: "About", ru: "О нас" },
  "about.body": { he: "LAWDin היא מערכת ההפעלה המקצועית לעורכי דין — ידע, חיבורים והפניות ברשת סגורה ומאומתת.", en: "LAWDin is the professional operating system for attorneys — knowledge, connections and referrals in a closed, verified network.", ru: "LAWDin — профессиональная операционная система для юристов: знания, связи и передачи дел в закрытой проверенной сети." },
  "about.founder": { he: "נוסד ומובל על ידי ד״ר אברהם ללום.", en: "Founded and led by Dr. Avraham Lalum.", ru: "Основатель и руководитель — д-р Авраам Лалум." },
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

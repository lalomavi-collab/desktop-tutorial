// The working appendices of the security booklet: three things a reader can
// take and use. They are kept apart from the claims in securityPage.ts because
// they are a different kind of statement. A claim says what runs here. A
// template says how to do something, and each one states plainly whether it
// is what LALUM runs or a pattern to follow.
//
// Corrections are part of the content. Each template was checked against the
// system before it went in, and the places where a common version of the
// advice fails (a column that does not exist, a check that passes everything)
// are listed with it, so a reader does not paste the broken version.

export type TemplateStatus = "runs-here" | "pattern";

export interface SecurityTemplate {
  id: string;
  title: string;
  status: TemplateStatus;
  statusLabel: string;
  intro: string;
  /** Code, shown LTR. Absent where the template is the downloadable file. */
  code?: { lang: "sql" | "ts"; text: string };
  /** The downloadable file, where there is one. */
  download?: { href: string; label: string };
  points: string[];
  corrections?: string[];
  source?: { label: string; url: string };
}

const PRIVATE_BUCKET_SQL = `-- A private bucket with an owner folder. Replace the bucket id and the types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-documents', 'client-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The first folder of every object path is the owner's user id.
create policy "documents: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-documents'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-documents'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'client-documents'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'client-documents'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-documents'
         and (storage.foldername(name))[1] = (select auth.uid())::text);`;

const SCAN_GATE_TS = `// Sketch of the gate. Not deployed in LALUM. SCANNER_URL is a ClamAV REST
// service that you operate, so the file never leaves your infrastructure.
const MAX_BYTES = 10 * 1024 * 1024;
const MAGIC: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

class HttpError extends Error { constructor(public status: number) { super(String(status)); } }

async function cleanOrThrow(file: File): Promise<Uint8Array> {
  if (file.size > MAX_BYTES) throw new HttpError(413);
  const buf = new Uint8Array(await file.arrayBuffer());
  const sig = MAGIC[file.type];
  if (!sig || !sig.every((b, i) => buf[i] === b)) throw new HttpError(415); // the declared type must match the bytes
  const r = await fetch(SCANNER_URL, { method: "POST", body: buf, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new HttpError(503);                // scanner down: fail closed, store nothing
  const verdict = await r.json();                     // { infected: boolean }
  if (verdict.infected !== false) throw new HttpError(422);
  return buf;
}`;

export const SECURITY_TEMPLATES: SecurityTemplate[] = [
  {
    id: "TPL-01",
    title: `סקריפט ביקורת למסד Supabase`,
    status: "runs-here",
    statusLabel: `רץ אצלנו`,
    intro: `שאילתת קריאה בלבד אחת שמריצים ב-SQL Editor של Supabase. היא לא משנה דבר, ומחזירה רשימת מוקדים לבדיקה לפי חומרה. הרצנו אותה על מסד הנתונים של LALUM ב-19.10.2026.`,
    download: { href: `/downloads/lalum-supabase-security-audit.sql`, label: `הורדת הסקריפט (SQL)` },
    points: [
      `בודק: טבלאות ללא RLS, מדיניות פתוחה (true) ל-anon ול-PUBLIC, פונקציות SECURITY DEFINER הזמינות לאורחים או ללא search_path קבוע, Views שעוקפים RLS, מאגרי קבצים ציבוריים, ומדיניות פתוחה לכל משתמש מחובר.`,
      `התוצאה אצלנו: אפס טבלאות ללא RLS, אפס פונקציות או Views חשופים לאורחים, אפס מאגרי קבצים ציבוריים. נשארו מוקד אחד בחומרה גבוהה ומוקד אחד בינונית, ושניהם נתוני ייחוס שמיועדים להיות פתוחים: שלושה קריטריוני ניתוח חוזים לדוגמה ורשימת מחירים. וכן חמש פונקציות עזר לבדיקה ידנית, שמחזירות ערך פשוט בלבד (כן או לא, או סטטוס).`,
      `כל שורה היא מוקד ולא פסק דין. מוקדי REVIEW ו-MEDIUM דורשים החלטה אנושית אם הגישה הפתוחה מכוונת.`,
    ],
    corrections: [
      `גרסה נפוצה של בדיקה כזו מתמקדת רק במדיניות שפתוחה ל-anon. היא מפספסת מדיניות true ל-authenticated, ובהרשמה פתוחה זה כל אדם זר.`,
      `גרסה נפוצה ממיינת את החומרות לפי אלפבית, ואז WARNING מופיע לפני CRITICAL. כאן מיון לפי דירוג מספרי.`,
      `מדיניות בלי סעיף TO חלה על PUBLIC, אבל אם התנאי שלה דורש זהות מחוברת היא נכשלת לאורח. כאן היא מסווגת כהערה ולא כפרצה.`,
    ],
  },
  {
    id: "TPL-02",
    title: `מאגר קבצים פרטי עם מדיניות בעלות`,
    status: "pattern",
    statusLabel: `תבנית לביצוע`,
    intro: `תבנית למאגר שבו כל משתמש רואה רק את התיקייה שלו, עם מגבלת גודל וסוגים. ארבעת מאגרי הקבצים של LALUM פרטיים, ומדיניות הגישה אליהם נבנתה על אותו עיקרון: ב-client-files לפי בעלות, וב-matter-originals לפי משרד, תפקיד ואימות דו-שלבי.`,
    code: { lang: "sql", text: PRIVATE_BUCKET_SQL },
    points: [
      `הגישה לקובץ נעשית בקישור חתום קצר מועד (createSignedUrl), לא בכתובת ציבורית. אצלנו הקישורים בפורטל תקפים שישים שניות.`,
      `בגישה לפי משרד ולא לפי משתמש בודד, משווים את התיקייה הראשונה לפונקציית השיוך שלכם, בטקסט: (storage.foldername(name))[1] = (select public.my_firm_id())::text. כך עובד matter-originals אצלנו.`,
      `אצלנו ב-client-files יש מגבלת גודל של 25MB, ורשימת סוגים מותרים מוגדרת ב-matter-originals בלבד.`,
    ],
    corrections: [
      `שם העמודה הוא file_size_limit. הנוסח max_file_size שמופיע בהדרכות רבות אינו קיים, והפקודה נכשלת.`,
      `אין להמיר את שם התיקייה ל-uuid בתוך המדיניות. נתיב שאינו uuid זורק שגיאה ועלול להכשיל שאילתה שלמה. משווים בטקסט.`,
      `כותבים (select auth.uid()) ולא auth.uid() ישירות, כדי שהערך יחושב פעם אחת בשאילתה.`,
      `מדיניות UPDATE צריכה גם WITH CHECK, אחרת אפשר להעביר קובץ לתיקייה של אחר דרך שינוי שם.`,
      `אל תתירו html או svg במאגר שנפתח בדפדפן בלי כותרת הורדה. קובץ כזה עלול להריץ סקריפט.`,
    ],
  },
  {
    id: "TPL-03",
    title: `סריקת נוזקות לפני שמירה`,
    status: "pattern",
    statusLabel: `תבנית לביצוע, לא פרוסה אצלנו`,
    intro: `הרעיון: הקובץ לא נכתב למאגר ישירות מהדפדפן. הוא עובר בפונקציית שרת, נבדק, ורק קובץ תקין נשמר. כרגע LALUM אינה סורקת נוזקות בקבצים שלקוח מעלה לפורטל, והם מגיעים ישירות למאגר פרטי עם מגבלת גודל ובלי סריקה.`,
    code: { lang: "ts", text: SCAN_GATE_TS },
    points: [
      `הזרימה: הלקוח שולח לפונקציה עם הטוקן שלו, הפונקציה מאמתת זהות, גודל וסוג, שולחת למנוע סריקה, ורק אחרי תשובה נקייה כותבת למאגר עם מפתח השירות, תחת תיקיית הבעלים. כדי שההעלאה הישירה לא תעקוף את הבדיקה, מסירים את מדיניות ה-INSERT של משתמשים מחוברים באותו מאגר.`,
      `לקבצים גדולים אין להמתין סינכרונית. מעלים למאגר הסגר נעול, מנוע רקע סורק, וקובץ נקי מועבר למאגר היעד וקובץ נגוע נמחק עם התראה ורשומה ביומן. מאגר הסגר נעול (matter-quarantine) קיים במסד, ואין כרגע בקוד שימוש בו.`,
    ],
    corrections: [
      `אין לשלוח מסמכים משפטיים לשירות סריקה ציבורי. לפי התיעוד של VirusTotal, קבצים שנשלחים אליו בשימוש הרגיל עשויים להיות משותפים מעבר לארגון שלכם, ורק מסלול Private Scanning בתשלום מחזיק אותם בתוך הארגון. לכן מנוע שאתם מפעילים בעצמכם (ClamAV) או בדיקה לפי גיבוב בלבד, בלי העלאה.`,
      `סריקה שמחזירה סטטוס "בתור" מחזירה אפס זיהויים. קוד שקורא את התוצאה מיד ולא ממתין לסטטוס "הושלם" מעביר כל קובץ. נדרש polling עם תקרת זמן, וכשל סגור בתום התקרה.`,
      `סוג הקובץ שהלקוח מצהיר עליו אינו ראיה. בודקים את הבתים הראשונים של הקובץ מול הסוג המוצהר.`,
      `שם הקובץ מגיע מהלקוח. מנקים אותו או מייצרים שם בצד השרת, ואין להשתמש בו בנתיב כפי שהוא.`,
      `תקלה במנוע הסריקה חייבת להיכשל סגור: הקובץ לא נשמר. פתיחה שקטה בכשל היא הדרך הנפוצה להפוך בקרה לקישוט.`,
      `מגבלות גודל וזמן ריצה בפונקציית קצה חלות. מה שלא נכנס בהן הולך למסלול ההסגר.`,
    ],
    source: { label: `תיעוד VirusTotal: Private Scanning`, url: `https://docs.virustotal.com/docs/private-scanning` },
  },
];

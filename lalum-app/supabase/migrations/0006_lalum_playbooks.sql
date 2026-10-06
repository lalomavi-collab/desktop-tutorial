-- 0006_lalum_playbooks.sql
-- Firm playbooks (תבניות בדיקה משרדיות) for LALUM LEX's contract review engine
-- (/os, /contracts, analyze-contract). A playbook is a fixed set of review
-- criteria for one contract type, written once by the firm and reused on
-- every matching contract instead of relying on the model's own judgment of
-- what to check. This is reference content the firm maintains, not
-- user-generated data: no submit path, no anonymous insert, matching the
-- read-only Edge Function pattern already used for static site content.
--
-- Both seeded playbooks sit inside the two permanent focus areas (see
-- CLAUDE.md): urban renewal and commercial lease under real estate, founders
-- and AI-tech agreements under AI. There is no third category here, same as
-- everywhere else on the site.
--
-- criteria_text is Hebrew, plain prose (no forbidden dashes, matching the
-- site-wide writing rule), sent as-is into analyze-contract's system prompt
-- as additional, non-optional review criteria. It intentionally avoids citing
-- specific statute section numbers: this table feeds an internal review
-- prompt, not a published legal assertion, and any section number the site
-- does publish still goes through the CLAUDE.md double-verification rule
-- separately (see rulings.json and the legal-article pipeline).

create table if not exists public.lalum_playbooks (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  criteria_text text not null check (char_length(btrim(criteria_text)) between 1 and 4000),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.lalum_playbooks enable row level security;

-- Public read: LALUM LEX is a public-facing engine (/os, /contracts), not a
-- /portal-gated one, same reasoning as analyze-contract itself being deployed
-- with --no-verify-jwt. No insert or update policy: the firm maintains this
-- table directly (SQL migration or service role), the same posture the
-- discussions table gives its admin-only fields.
drop policy if exists lalum_playbooks_public_read on public.lalum_playbooks;
create policy lalum_playbooks_public_read on public.lalum_playbooks
  for select using (true);

insert into public.lalum_playbooks (slug, criteria_text, sort_order) values
(
  'tama38',
  'התמקד בבדיקת הסעיפים הבאים, האופייניים לעסקת התחדשות עירונית (פינוי בינוי או תמ"א 38): קיום ערבויות להבטחת כספי הדיירים וזכויותיהם עד למסירה, לוח זמנים למסירה ומנגנון פיצוי בגין איחור, אופן קבלת הסכמת רוב הדיירים והתייחסות למתנגדים, ביטוח הקבלן ואחריותו לבדק במהלך הבנייה ולאחריה, זכויות הדיירים בדירה החלופית או בדמי השכירות בתקופת הפינוי, וליווי בנקאי של הפרויקט. סמן כל היעדר של אחד מאלה כממצא בחומרה מתאימה, ואל תמציא מספרי סעיף בחוק או שיעורי מס קונקרטיים שאינם מופיעים בטקסט החוזה עצמו.',
  1
),
(
  'commercial-lease',
  'התמקד בבדיקת הסעיפים הבאים, האופייניים להסכם שכירות מסחרית: גובה דמי השכירות ומנגנון ההצמדה שלהם, תקופת השכירות ואופציות ההארכה ותנאיהן, גובה הביטחונות והערבויות הנדרשות מהשוכר, הגדרת השימוש המותר במושכר והתאמתו לרישיון העסק הנדרש, אחריות לתחזוקה ותיקונים בין המשכיר לשוכר, זכות סירוב ראשונה או זכות הצטרפות של המשכיר, ותנאי הפינוי והשבת המושכר בתום התקופה. סמן כל חד צדדיות בולטת לטובת צד אחד כממצא בחומרה מתאימה.',
  2
),
(
  'founders-ai',
  'התמקד בבדיקת הסעיפים הבאים, האופייניים להסכם מייסדים בחברת AI או הייטק: חלוקת המניות בין המייסדים ומנגנון ההבשלה (vesting) שלהן, הבעלות על הקניין הרוחני שפותח, לרבות מודלים, קוד ומאגרי נתונים שאומנו על ידי החברה או עבורה, תנאי הרישוי והאחריות ביחס לכלי בינה מלאכותית של צד שלישי המשולבים במוצר, סעיפי סודיות ואי תחרות בין המייסדים, מנגנון יציאה של מייסד ורכישת מניותיו (buy sell), וחלוקת אחריות רגולטורית ביחס לשימוש במערכות בינה מלאכותית. סמן היעדר מנגנון הבשלה או אי בהירות בבעלות הקניין הרוחני כממצא בחומרה גבוהה.',
  3
)
on conflict (slug) do nothing;

# מפת המיגרציות: הריפו מול הפרודקשן

נבדק ב־23.10.2026 מול הפרויקט `meoymkcotomoluwlwues` (lalum-app), בקריאה בלבד. שום דבר לא שונה במסד כדי לכתוב את המסמך הזה.

## השורה התחתונה

- **98 קבצים מול 178 שורות.** 7 קבצים ב־`supabase/migrations` ו־91 ב־`lalum-app/supabase/migrations`, מול 178 שורות ב־`supabase_migrations.schema_migrations`.
- **הסכמה החיה תואמת את הקבצים, אבל הרישום לא.** מ־83 קבצים חולצו 525 אובייקטים (טבלאות, פונקציות, מדיניות, אינדקסים, טריגרים, עמודות), וכולם קיימים בפרודקשן חוץ משלושה קבצים שלא הוחלו ושתי פונקציות שקובץ מאוחר מוחק במכוון.
- **32 קבצים בלי שום שורה:** 21 מהם חיים בפרודקשן (הוחלו בלי רישום, כנראה דרך `execute_sql` ולא דרך `apply_migration`), 8 משנים אובייקטים קיימים בלבד ולכן אי אפשר לבדוק אותם לפי קיום, ו־3 לא הוחלו כלל.
- **61 שורות בלי קובץ** (60 אחרי ה־PR הזה): בסיס הפורטל מיולי, נתב התיקים, לידים וניוזלטר, PII, בסיס הקוקפיט, סל המחזור ועוד, וכן שלוש שורות מהיום.
- **רק 3 קבצים זהים בתוכן לשורה שלהם.** בכל השאר השורה והקובץ נכתבו בנפרד: קובץ אחד הוחל בכמה חלקים, או נכתב בדיעבד, או להפך.
- **13 מספרים כפולים** (0011 עד 0016, 0018, 0032, 0033, 0036, 0077, 0079, 0081) ו**שלושה מספרים חסרים** (0028, 0029, 0057).
- **התנגשות פתוחה:** PR 1228 מחזיק את 0082 (מנוע מס) ו־0083 (קטגוריית רכוש קבוע). שתיהן חיות בפרודקשן מ־23.10 והקבצים לא ממוזגים. PR 1234 משתמש גם הוא ב־0082.

## שיטת הבדיקה

1. **שורות:** `version`, `name`, `created_by`, ואורך ו־md5 של `statements[1]` אחרי צמצום רווחים, לכל 178 השורות.
2. **התאמת תוכן:** אותו md5 חושב לכל קובץ. התאמה מלאה נמצאה רק ל־`0007_whatsapp_intake` (root), `0016_lalum_finance_series` ו־`0017_lalum_finance_series_seed`.
3. **התאמת שם:** שורה ששמה זהה לשם הקובץ בלי המספר, או מתחיל בו ואחריו סיומת חלק (`_a_`, `_fn`, `_revoke` וכדומה). התאמות שהשם לא תופס סומנו ידנית לפי רצף הזמנים והתוכן (למשל 0043 מול שש שורות `lalum_re_playbook_*`).
4. **קיום:** מכל קובץ חולצו האובייקטים שהוא יוצר, ונבדק בקטלוג של Postgres שהם קיימים. קבצים שרק משנים אובייקט קיים (`alter policy`, `update`, בלוק `do`) סומנו "לא ניתן לבדוק לפי קיום".
5. **מי יצר:** לכל קובץ בלי שורה נבדק אם שורה כלשהי יוצרת את האובייקטים שלו (`create ... <שם>` או `add column <שם>`). ל־21 הקבצים החיים בלי שורה אין שורה כזו.

`created_by = lalomavi@gmail.com` פירושו שהמיגרציה הוחלה דרך מחבר Supabase תחת החשבון של אבי. זה לא מזהה איזה סשן הריץ אותה. שמונה שורות בלי `created_by` נרשמו ידנית (0072 עד 0075, 0077 פעמיים, 0078, 0079); לשורה של 0078 אין `statements` בכלל.

## מה זה אומר בפועל

- **שחזור מאפס מהריפו לא יעבוד.** זה כבר כתוב בראש `0018_lalum_firm_core_baseline.sql`, והמפה מראה את ההיקף: 61 שורות שאין להן קובץ.
- **אל תריצו `supabase db push` או `supabase migration repair` על הפרויקט הזה.** ה־CLI משווה לפי המספר שבתחילת שם הקובץ. אצלנו הקבצים ממוספרים 0001 עד 0081 והשורות ממוספרות בחותמת זמן, כך שאף קובץ לא יזוהה כמוחל. `repair` הוא כתיבה לטבלת הרישום בפרודקשן ודורש "מאשר".
- **שינוי סכמה הבא ייכנס לאותו בלבול** אם לא תוחלט מוסכמה (צעד 9). זה מה שקרה היום: שלוש מיגרציות הוחלו ב־23.10, ושתיים מהן יושבות ב־PR לא ממוזג והשלישית בלי PR בכלל.

## מה זה משנה לצעדים 9 ו־10

התוכנית המקורית לצעד 10 הייתה להוסיף שורות רישום ל־0020, 0040 ו־0049. הבדיקה הזו מראה 21 קבצים חיים בלי שורה, לא שלושה, ועוד 61 שורות בלי קובץ. הוספת שורות לחלק מהם לא תסגור את הפער ולא תאפשר שימוש ב־CLI.

**המוסכמה (אושרה על ידי אבי):** 0001 עד 0083 נשארים היסטוריה, עם המפה הזו כהתאמה הרשמית. מכאן והלאה כל קובץ חדש נקרא `YYYYMMDDHHMMSS_name.sql` לפי הגרסה שבאמת נרשמה בפרודקשן, כמו `20261023101711_fin_pnl_bank_reconciliation_v1.sql` שנוסף ב־PR הזה. `apply_migration` רושם את שעת ההחלה ולא את המספר שבשם הקובץ, ולכן אחרי ההחלה משנים את שם הקובץ לגרסה שנרשמה, באותו PR (`select version from supabase_migrations.schema_migrations where name = '<name>'`). הבדיקה `lalum-app/scripts/migrations-check.mjs` רצה בכל build ונכשלת על קובץ חדש בלי חותמת זמן אמיתית, ועל שני קבצים עם אותה גרסה. היא לא קוראת את הפרודקשן, ולכן ההתאמה לגרסה שנרשמה היא שלב בנוהל ולא בבדיקה. ה־0082 של PR 1234 (מסמכי הוצאות) מקבל שם לפי הגרסה שלו לפני המיזוג; שני הקבצים של PR 1228 חיים כבר ונשארים בשמם. כך צעד 10 נעשה מיותר, ושום שורה לא נכתבת בפרודקשן.

## קבצים מול שורות (98 ב־main, ועוד הקובץ שנוסף כאן)

"אובייקטים חיים" הוא מספר האובייקטים שנמצאו מתוך אלה שהקובץ יוצר.

| תיקייה | קובץ | שורות בפרודקשן | אובייקטים חיים | הערה |
|---|---|---|---|---|
| root | `0001_bar_registry.sql` | אין | 0/7 | סכמה ישנה (ldr_profiles). לא הוחל על הפרויקט הזה, וזה צפוי: lalum_bar_registry מ־lalum-app 0001 חי |
| root | `0002_harden_verification.sql` | אין | 0/1 | אותה סכמה ישנה; private.guard_profile_escalation לא קיים |
| root | `0003_voice_call_sync.sql` | `20260719130811` | 6/6 |  |
| root | `0004_calls_admin_read.sql` | `20260720163543` | 4/4 |  |
| root | `0005_billing_contact_fields.sql` | `20260721080501` | 2/2 |  |
| root | `0006_billing_last_error.sql` | אין | 1/1 | **חי בלי שורה** |
| root | `0007_whatsapp_intake.sql` | `20260906222655` | 10/10 | תוכן זהה לשורה |
| app | `0001_lalum_portal.sql` | `20260716090659` | 14/14 |  |
| app | `0002_lalum_public_booking.sql` | `20260716155200` | 3/3 |  |
| app | `0003_lalum_admin_guard.sql` | `20260728042207` | 2/2 |  |
| app | `0004_lalum_group_chat.sql` | `20260908085330` | 4/4 |  |
| app | `0005_lalum_discussions.sql` | `20260908133401` | 4/4 |  |
| app | `0006_lalum_playbooks.sql` | `20260915140406` | 2/2 |  |
| app | `0007_lalum_document_versions.sql` | אין | 7/7 | **חי בלי שורה** |
| app | `0008_template_language_seeds.sql` | אין | לא ניתן לבדוק לפי קיום (עדכון תבניות קיימות) | אין שורה |
| app | `0009_lalum_kyc_records.sql` | `20261008132940` | 7/7 |  |
| app | `0010_lalum_doc_annexes.sql` | `20261008213437` | 8/8 |  |
| app | `0011_lalum_document_governance.sql` | אין | 4/5 | **חי בלי שורה**; lalum_delete_document חסר כי 0013 מוחק אותו במכוון; מספר כפול |
| app | `0011_lalum_signature_requests.sql` | `20261009123802` | 12/12 | מספר כפול |
| app | `0012_drop_tmp_probes.sql` | אין | לא ניתן לבדוק לפי קיום (מחיקת פונקציות בדיקה; אין אף lalum_tmp_probe חי) | מספר כפול; אין שורה |
| app | `0012_lalum_conflict_review.sql` | `20261009125503` | 2/2 | מספר כפול |
| app | `0013_lalum_deletion_admin_only.sql` | אין | 2/2 | **חי בלי שורה**; מחליף פונקציות של סל המחזור, שנבנה בשורות 20261008212501 עד 212839 בלי קובץ; מספר כפול |
| app | `0013_lalum_signature_provider_fields.sql` | `20261009142407` | 2/2 | מספר כפול |
| app | `0014_lalum_finance_ledger.sql` | `20261009095738` עד `20261009100346` (3) | 22/22 | מספר כפול |
| app | `0014_lalum_matter_access_by_role.sql` | אין | 10/10 | **חי בלי שורה**; מספר כפול |
| app | `0015_lalum_finance_archive.sql` | `20261009123133` | 9/9 | מספר כפול |
| app | `0015_lalum_matter_child_access.sql` | אין | לא ניתן לבדוק לפי קיום (alter policy בלבד) | מספר כפול; אין שורה |
| app | `0016_lalum_finance_series.sql` | `20261011181531` | 12/12 | תוכן זהה לשורה; מספר כפול |
| app | `0016_lalum_member_admin.sql` | `20261011183428` | 3/3 | מספר כפול |
| app | `0017_lalum_finance_series_seed.sql` | `20261011181544` | 1/1 | תוכן זהה לשורה |
| app | `0018_lalum_finance_casual_customers.sql` | `20261010202935`, `20261010203117` | 2/2 | מספר כפול |
| app | `0018_lalum_firm_core_baseline.sql` | `20261009183617` | 11/11 | קובץ בסיס שנכתב בדיעבד; השורה שלו מכילה 9 תווים בלבד. הטבלאות נוצרו בשורות lalum_cockpit_* מ־7.10; מספר כפול |
| app | `0019_lalum_billing_model.sql` | `20261009183803`, `20261009184311` | 53/53 |  |
| app | `0020_lalum_trust_deadlines_intake.sql` | אין | 47/47 | **חי בלי שורה** |
| app | `0021_lalum_billing_wip.sql` | `20261015201112` | 5/5 |  |
| app | `0022_lalum_finance_internal_fields.sql` | `20261011073339` עד `20261011073652` (3) | 8/8 |  |
| app | `0023_lalum_finance_retainer_drafts.sql` | `20261011181723`, `20261011181946` | 3/3 |  |
| app | `0024_lalum_finance_permissions.sql` | `20261011183128` עד `20261011184703` (6) | 10/10 |  |
| app | `0025_lalum_finance_proforma_link.sql` | `20261011191609`, `20261011191627` | 3/3 |  |
| app | `0026_lalum_finance_issue_void_levels.sql` | אין | 3/3 | **חי בלי שורה** |
| app | `0027_lalum_events_outlook_sync.sql` | אין | 3/3 | **חי בלי שורה** |
| app | `0030_lalum_token_floor.sql` | אין | 1/1 | **חי בלי שורה** |
| app | `0031_lalum_finance_collections_cashflow.sql` | `20261011200748` | 17/17 |  |
| app | `0032_lalum_finance_collections_enforcement.sql` | `20261012064945` | 8/8 | מספר כפול |
| app | `0032_lalum_trust_statement_correction.sql` | `20261012055752` | 8/8 | מספר כפול |
| app | `0033_lalum_intake_prefills_kyc.sql` | `20261012060608` | 1/1 | מספר כפול |
| app | `0033_lalum_trust_value_date.sql` | `20261012061137` עד `20261012061717` (9) | 6/6 | מספר כפול |
| app | `0034_lalum_mfa_recovery.sql` | `20261012062829` | 3/3 |  |
| app | `0035_lalum_finance_dunning_send.sql` | `20261012133804` | 5/5 |  |
| app | `0036_lalum_finance_whatsapp_consent.sql` | `20261012140958` | 4/4 | מספר כפול |
| app | `0036_lalum_trust_account_lock.sql` | `20261013113836` | 2/2 | מספר כפול |
| app | `0037_lalum_member_password_reset.sql` | `20261013090616` | 1/1 |  |
| app | `0038_lalum_finance_business_profile.sql` | `20261013161051` | 12/12 |  |
| app | `0039_lalum_trust_statement_value_date.sql` | `20261013162004`, `20261013162025` | 2/2 |  |
| app | `0040_lalum_matter_code_folders.sql` | `20261013185138` | 10/10 | רק חלק a רשום; lalum_matter_folders, lalum_next_matter_code ו־lalum_set_matter_sync חיים בלי שורה |
| app | `0041_lalum_mail_intake.sql` | אין | 0/9 | **לא הוחל.** 0 מתוך 9 אובייקטים. תואם לפונקציה lalum-mail-intake שלא נפרסה (T50) |
| app | `0042_lalum_matter_risk_rollup.sql` | `20261014091443` עד `20261014091520` (6) | 3/3 |  |
| app | `0043_lalum_real_estate_playbook.sql` | `20261014093545` עד `20261014093612` (6) | לא ניתן לבדוק לפי קיום (עדכון פלייבוק קיים) |  |
| app | `0044_lalum_client_name_reveal.sql` | `20261014095334` עד `20261014095849` (7) | 3/3 |  |
| app | `0045_lalum_mgr_ok_never_null.sql` | `20261014112458` | 1/1 |  |
| app | `0046_lalum_reanalyze_matter.sql` | `20261014140838` עד `20261014141459` (6) | 2/2 |  |
| app | `0047_lalum_open_original.sql` | `20261014145713` עד `20261014145856` (3) | 1/1 |  |
| app | `0048_lalum_risk_scope.sql` | אין | 5/5 | **חי בלי שורה** |
| app | `0049_lalum_billing_proforma.sql` | אין | 7/7 | **חי בלי שורה** |
| app | `0050_lalum_site_leads.sql` | אין | 6/6 | **חי בלי שורה** |
| app | `0051_lalum_site_leads_signup_source.sql` | `20261019084458` | לא ניתן לבדוק לפי קיום (החלפת constraint) |  |
| app | `0052_lalum_whatsapp_retention.sql` | אין | 2/2 | **חי בלי שורה** |
| app | `0053_lalum_practice_playbooks_firm_read.sql` | אין | לא ניתן לבדוק לפי קיום (alter policy בלבד) | אין שורה |
| app | `0054_lalum_group_chat_members_only.sql` | אין | לא ניתן לבדוק לפי קיום (alter policy בלבד) | אין שורה |
| app | `0055_lalum_trust_post_reversal_scope.sql` | אין | 1/1 | **חי בלי שורה** |
| app | `0056_lalum_login_report_registration_split.sql` | אין | לא ניתן לבדוק לפי קיום (שינוי פונקציה קיימת) | אין שורה |
| app | `0058_lalum_attendance_hours_index.sql` | `20261020083800` עד `20261020084106` (4) | 14/14 |  |
| app | `0059_lalum_audit_log_capture.sql` | אין | לא ניתן לבדוק לפי קיום (בלוק DO; שלוש פונקציות הביקורת חיות) | אין שורה |
| app | `0060_lalum_audit_log_hardening.sql` | `20261020091049`, `20261020091127` | לא ניתן לבדוק לפי קיום (בלוק DO; טריגר lalum_audit_no_truncate חי) |  |
| app | `0061_lalum_audit_log_matter_restrict_and_no_names.sql` | `20261020111633` עד `20261020111713` (3) | לא ניתן לבדוק לפי קיום (בלוק DO ו־constraint) |  |
| app | `0062_lalum_firm_closure_checklist.sql` | `20261020142403` | 1/1 |  |
| app | `0063_lalum_firm_begin_closing.sql` | `20261020160237` | 5/5 |  |
| app | `0064_lalum_conflict_notes_off_the_chain.sql` | אין | 4/4 | **חי בלי שורה** |
| app | `0065_lalum_firm_finish_closing.sql` | אין | 4/4 | **חי בלי שורה** |
| app | `0066_lalum_firm_export_package.sql` | אין | 4/5 | **חי בלי שורה**; lalum_firm_export_originals חסר כי 0069 מוחק אותו במכוון |
| app | `0067_lalum_firm_revoke_access.sql` | אין | 9/9 | **חי בלי שורה** |
| app | `0068_lalum_firm_export_originals_page.sql` | אין | 1/1 | **חי בלי שורה** |
| app | `0069_lalum_firm_export_originals_remove_unpaged.sql` | אין | לא ניתן לבדוק לפי קיום (מוחק את lalum_firm_export_originals; אכן לא חי) | אין שורה |
| app | `0070_lalum_tax_retention_guard.sql` | אין | 7/7 | **חי בלי שורה** |
| app | `0071_lalum_fin_record_audit.sql` | אין | 3/3 | **חי בלי שורה** |
| app | `0072_lalum_client_name_reveal_reason.sql` | `20261021163000` (נרשמה בלי created_by) | 2/2 |  |
| app | `0073_lalum_bookkeeper_role.sql` | `20261021163001` (נרשמה בלי created_by) | 7/7 |  |
| app | `0074_lalum_members_read_bookkeeper.sql` | `20261021163002` (נרשמה בלי created_by) | לא ניתן לבדוק לפי קיום (alter policy בלבד) |  |
| app | `0075_lalum_invoices_read_bookkeeper.sql` | `20261021163003` (נרשמה בלי created_by) | לא ניתן לבדוק לפי קיום (alter policy בלבד) |  |
| app | `0076_lalum_firm_export_manifest_audit_first.sql` | `20261021220728` | 1/1 |  |
| app | `0077_lalum_finance_doc_sends.sql` | `20261021223500` (נרשמה בלי created_by) | 6/6 | מספר כפול |
| app | `0077_lalum_name_reveal_admin_only.sql` | `20261021233000` (נרשמה בלי created_by) | 7/7 | מספר כפול |
| app | `0078_lalum_finance_doc_send_events.sql` | `20261022090000` (נרשמה בלי created_by) | 11/11 | לשורה אין statements בכלל (נרשמה ידנית) |
| app | `0079_lalum_bookkeeper_password_only.sql` | `20261022084500` (נרשמה בלי created_by) | 1/1 | מספר כפול |
| app | `0079_lalum_export_classify_doc_sends_and_name_grants.sql` | `20261022083512` | 1/1 | מספר כפול |
| app | `0080_lalum_export_fresh_second_factor.sql` | `20261022102146` | 4/4 |  |
| app | `0081_lalum_finance_archive_backup_bucket.sql` | `20261022134510` | לא ניתן לבדוק לפי קיום (יוצר bucket; finance-archive-backup קיים) | מספר כפול |
| app | `0081_lalum_finance_doc_auto_send.sql` | `20261022134516` | 2/2 | מספר כפול |
| app | `20261023101711_fin_pnl_bank_reconciliation_v1.sql` | `20261023101711` | 4 טבלאות, 5 views, פונקציה | **נוסף ב־PR הזה.** גוף זהה לשורה (md5 תואם), עם כותרת הסבר |

## שורות בלי קובץ (61)

| קבוצה | שורות | טווח | מה ידוע |
|---|---|---|---|
| בסיס הפורטל מיולי | 13 | `20260717122215` עד `20260729074056` | הודעות, קבצי לקוח, אירועים ומשימות, אבני דרך לחיוב, cron, דוח כניסות. אין להם קובץ באף תיקייה בריפו |
| נתב תיקים | 6 | `20260831111154` עד `20260831113057` | `matter_router_*` |
| לידים, ניוזלטר ואנשי קשר | 6 | `20260901091211` עד `20260921160952` | כנראה מהריפו LALUMap. לא נבדק בסבב הזה |
| PII | 3 | `20261006123957` עד `20261006132450` | כנראה מהריפו LALUMap. לא נבדק בסבב הזה |
| בסיס הקוקפיט | 11 | `20261007080516` עד `20261007104710` | יצרו את `lalum_firms`, `lalum_firm_members` ו־`lalum_cockpit_matters`. קובץ 0018 תיעד אותם בדיעבד, חלקית |
| פיצ'רים מ־7 עד 9.10 בלי קובץ | 19 | `20261007121949` עד `20261009095446` | dispatch worker, מועדים סטטוטוריים, ניתוב פניות, תבניות מסמכים, תיקיית מקורות, סל המחזור (6 שורות), תחומי עבודה, כינוי מייל לפניות |
| מהיום, 23.10 | 3 | `20261023073721`, `20261023101711`, `20261023105143` | מנוע מס ורכוש קבוע הם 0082 ו־0083 ב־PR 1228 (לא ממוזג). שכבת הבנק לא נמצאה בשום סשן ובשום PR; הקובץ שלה נוסף ב־PR הזה |

## מה נשאר פתוח

1. מקור שכבת הבנק (`20261023101711`) ומקור הקובץ `Bankin.dat` שממנו נטענו שורות הבנק: שאלה לאבי.
2. מוסכמת שמות לקבצים חדשים (צעד 9): החלטה של אבי.
3. 0041 (`lalum_mail_intake`) לא הוחל, ופונקציית ה־edge שלו לא נפרסה (T50). להחליט אם להחיל, או לסמן אותו כמושהה.
4. בדיקה בריפו LALUMap של 9 השורות שמסומנות "כנראה מהריפו LALUMap".
5. מספור 0082: PR 1228 ו־PR 1234 מתנגשים. מי שממזג שני צריך למספר מחדש.

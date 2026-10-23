# פונקציות Edge: מה חי ומאיפה הוא בא

נבדק ב־23.10.2026 מול הפרויקט `meoymkcotomoluwlwues` (lalum-app), בקריאה בלבד. שום פונקציה לא נפרסה, לא שונתה ולא נמחקה בשביל המסמך הזה.

## השורה התחתונה

- **44 פונקציות חיות, ו־15 מהן בלי קוד בריפו.** אם הפרויקט יאבד, או אם מישהו ירצה לתקן אחת מהן, אין ממה לבנות אותן מחדש.
- **שש מה־15 משרתות את האפליקציה עצמה:** `lalum-message`, `lalum-file-notify`, `lalum-draft-reply`, `lalum-send-reply`, `lalum-parse-event`, `lalum-travel-time`. הן נקראות מהפורטל, מתיבת ההודעות, משורת הפקודות וממודול התזמון. ייבוא הקוד שלהן לריפו הוא צעד 12.
- **שלוש כנראה שייכות לריפו LALUMap:** `pii-gateway`, `lalum-dispatch-worker`, `lalum-inquiry-email`. לא נבדק בסבב הזה.
- **השש האחרות:** שלוש פונקציות ניוזלטר, `lalum-fin-probe` (נראית ככלי בדיקה זמני), `lalum-diag` (לפי בדיקת האבטחה מ־19.10 הושבתה ומחזירה "disabled"), ו־`lalum-fin-tax-advisor`, שהקוד שלה יושב ב־PR 1228 ונפרסה לפני המיזוג.
- **שלוש בריפו ולא חיות:** `lalum-mail-intake` (וגם המיגרציה שלה, 0041, לא הוחלה), `lalum-mcp`, `verify-attorney`.
- **21 פונקציות רצות עם `verify_jwt` כבוי.** רובן webhooks או cron, שמאמתים חתימה או מפתח בעצמם (הפירוט ב־`docs/security-check-2026-10-19.md`). הבדיקה שלהן שייכת ליום האבטחה, 26.10.
- **שש נפרסו מה־Mac של אבי ב־CLI** (נתיב הכניסה מתחיל ב־`/Users/lalom/desktop-tutorial-deploy`). כל השאר הועלו דרך ה־API, בדרך כלל מסשן של Claude דרך MCP.
- **לא נבדק אם הקוד החי זהה לריפו** גם כשיש קוד בריפו. ההשוואה דורשת להוריד את הקוד החי, וזה חלק מצעד 12.

## שתי תיקיות, בלי כלל

קוד Edge יושב בשתי תיקיות: `supabase/functions` (14 פונקציות ותיקיית `_shared`) ו־`lalum-app/supabase/functions` (18). אין כלל שקובע מה הולך לאן, ופונקציות כספים מתחלקות בין שתיהן: `lalum-fin-issue` בראשונה, `lalum-fin-archive-pdf` בשנייה. ההמלצה היא לקבוע תיקייה אחת לפונקציות חדשות, אבל זה לא חלק מה־PR הזה.

## הטבלה (44 פונקציות חיות)

"נפרסה מ" נקבע לפי נתיב הכניסה שהפרויקט מחזיר. "מי קורא" נמצא בחיפוש טקסט בריפו הזה וב־`cron.job`. היעדר קורא בטבלה לא מוכיח שאין כזה.

| פונקציה | גרסה | עודכנה | verify_jwt | קוד בריפו | נפרסה מ | מי קורא | הערה |
|---|---|---|---|---|---|---|---|
| `lalum-diag` | 49 | 16.07 | **לא** | **אין** | העלאה דרך API | לא נמצא קורא | בלי קוד בריפו. לפי `docs/security-check-2026-10-19.md` הוא הושבת ומחזיר "disabled"; T71 |
| `lalum-dispatch-worker` | 29 | 07.10 | **לא** | **אין** | העלאה דרך API | cron כל דקה | בלי קוד בריפו הזה. כנראה LALUMap (לא נבדק) |
| `lalum-draft-reply` | 45 | 06.10 | כן | **אין** | העלאה דרך API | `cockpit/MessageInbox.tsx` | **חי בלי קוד בריפו.** נקראת מתיבת ההודעות |
| `lalum-file-notify` | 44 | 17.07 | כן | **אין** | העלאה דרך API | `Portal.tsx` | **חי בלי קוד בריפו.** נקראת מהפורטל |
| `lalum-fin-probe` | 8 | 21.10 | כן | **אין** | העלאה דרך API | לא נמצא | בלי קוד בריפו. נראית ככלי בדיקה זמני מ־21.10 |
| `lalum-fin-tax-advisor` | 2 | 23.10 | כן | **אין** | העלאה דרך API | הקוד ב־PR 1228 | הקוד ב־PR 1228 (לא ממוזג); נפרסה לפני המיזוג |
| `lalum-inquiry-email` | 11 | 09.10 | **לא** | **אין** | העלאה דרך API | Resend (webhook, Svix) | בלי קוד בריפו הזה. כנראה LALUMap (לא נבדק) |
| `lalum-message` | 44 | 17.07 | כן | **אין** | העלאה דרך API | `Portal.tsx` | **חי בלי קוד בריפו.** נקראת מהפורטל |
| `lalum-newsletter-daily` | 26 | 07.10 | **לא** | **אין** | העלאה דרך API | cron `0 6 * * *` | בלי קוד בריפו הזה |
| `lalum-newsletter-subscribe` | 25 | 14.09 | **לא** | **אין** | העלאה דרך API | לא נמצא בריפו הזה | בלי קוד בריפו הזה |
| `lalum-newsletter-unsubscribe` | 25 | 14.09 | **לא** | **אין** | העלאה דרך API | לא נמצא בריפו הזה | בלי קוד בריפו הזה |
| `lalum-parse-event` | 45 | 06.10 | כן | **אין** | העלאה דרך API | `CommandBar.tsx` | **חי בלי קוד בריפו.** נקראת משורת הפקודות |
| `lalum-send-reply` | 44 | 17.07 | כן | **אין** | העלאה דרך API | `cockpit/MessageInbox.tsx` | **חי בלי קוד בריפו.** נקראת מתיבת ההודעות |
| `lalum-travel-time` | 44 | 17.07 | כן | **אין** | העלאה דרך API | `lib/scheduling.ts` | **חי בלי קוד בריפו.** נקראת ממודול התזמון |
| `pii-gateway` | 26 | 06.10 | **לא** | **אין** | העלאה דרך API | `lalum-pipeline` | בלי קוד בריפו הזה. כנראה LALUMap (לא נבדק) |
| `analyze-contract` | 29 | 19.10 | **לא** | `lalum-app/supabase/functions` | Mac של אבי (CLI) | `LegalOS.tsx` |  |
| `compare-contracts` | 29 | 19.10 | **לא** | `lalum-app/supabase/functions` | Mac של אבי (CLI) | `LegalOS.tsx` |  |
| `lalum-admin-files` | 40 | 22.07 | כן | `supabase/functions` | העלאה דרך API | `cockpit/ClientDocuments.tsx` |  |
| `lalum-assistant` | 75 | 22.10 | **לא** | `lalum-app/supabase/functions` | העלאה דרך API | `ChatWidget.tsx`, `LegalOS.tsx` |  |
| `lalum-attorney-verify` | 50 | 16.07 | כן | `lalum-app/supabase/functions` | העלאה דרך API | לא נמצא קורא | הגרסה החיה מ־16.7; בריפו יש גם `verify-attorney` שלא נפרסה |
| `lalum-book` | 50 | 07.10 | **לא** | `lalum-app/supabase/functions` | העלאה דרך API | `Book.tsx` |  |
| `lalum-daily-report` | 48 | 19.10 | **לא** | `lalum-app/supabase/functions` | Mac של אבי (CLI) | cron `0 17 * * *` |  |
| `lalum-discussion-submit` | 27 | 07.10 | **לא** | `lalum-app/supabase/functions` | העלאה דרך API | `DiscussionsPanel.tsx` |  |
| `lalum-esign` | 8 | 19.10 | **לא** | `lalum-app/supabase/functions` | העלאה דרך API | `cockpit/SignatureRequests.tsx` |  |
| `lalum-export-originals` | 5 | 21.10 | כן | `lalum-app/supabase/functions` | העלאה דרך API | `firmExport.ts` |  |
| `lalum-fin-archive-backup` | 3 | 22.10 | כן | `lalum-app/supabase/functions` | העלאה דרך API | `archiveBackup.ts` |  |
| `lalum-fin-archive-pdf` | 13 | 22.10 | כן | `lalum-app/supabase/functions` | העלאה דרך API | `archivePdf.ts`, `lalum-fin-doc-send` |  |
| `lalum-fin-doc-send` | 9 | 23.10 | כן | `supabase/functions` | העלאה דרך API | `financeApi.ts`, `financeSend.ts`, `lalum-fin-issue` |  |
| `lalum-fin-doc-send-webhook` | 4 | 21.10 | **לא** | `supabase/functions` | העלאה דרך API | Resend (webhook) |  |
| `lalum-fin-dunning-send` | 8 | 12.10 | כן | `supabase/functions` | העלאה דרך API | `financeApi.ts` |  |
| `lalum-fin-import` | 9 | 09.10 | כן | `supabase/functions` | העלאה דרך API | `financeApi.ts` |  |
| `lalum-fin-issue` | 13 | 22.10 | כן | `supabase/functions` | העלאה דרך API | `financeApi.ts`, `financeSend.ts` |  |
| `lalum-fin-receipt-scan` | 4 | 21.10 | כן | `supabase/functions` | העלאה דרך API | `financeApi.ts` |  |
| `lalum-fin-report-mail` | 8 | 12.10 | כן | `supabase/functions` | העלאה דרך API | `finance/ReportsTab.tsx` |  |
| `lalum-lead` | 36 | 19.10 | **לא** | `lalum-app/supabase/functions` | Mac של אבי (CLI) | `CourseSignup.tsx` |  |
| `lalum-lead-submit` | 6 | 19.10 | **לא** | `lalum-app/supabase/functions` | Mac של אבי (CLI) | `LeadForm.tsx`, `AuthContext.tsx` |  |
| `lalum-mfa-recovery` | 7 | 12.10 | כן | `supabase/functions` | העלאה דרך API | `lib/cockpit/recovery.ts` |  |
| `lalum-notify` | 51 | 17.09 | כן | `lalum-app/supabase/functions` | העלאה דרך API | `Portal.tsx` |  |
| `lalum-open-original` | 6 | 14.10 | כן | `lalum-app/supabase/functions` | העלאה דרך API | `openOriginal.ts` |  |
| `lalum-pay-create` | 50 | 28.07 | כן | `supabase/functions` | העלאה דרך API | `cockpit/Payments.tsx`, `Portal.tsx` |  |
| `lalum-pay-webhook` | 47 | 19.10 | **לא** | `supabase/functions` | העלאה דרך API | ספק התשלום (webhook) |  |
| `lalum-pipeline` | 30 | 17.10 | **לא** | `lalum-app/supabase/functions` | העלאה דרך API | `cockpit/Billing.tsx` | גרסת הקוד החי מול main נבדקת בצעד 14 |
| `lalum-voice-webhook` | 47 | 06.10 | **לא** | `supabase/functions` | העלאה דרך API | ספק הטלפוניה (webhook) |  |
| `lalum-whatsapp-webhook` | 34 | 19.10 | **לא** | `supabase/functions` | Mac של אבי (CLI) | Meta (webhook) |  |

## בריפו ולא חיות

| תיקייה | פונקציה | מצב |
|---|---|---|
| `lalum-app/supabase/functions` | `lalum-mail-intake` | לא נפרסה. גם המיגרציה 0041 לא הוחלה (`docs/infra/migrations-map.md`). T50 |
| `lalum-app/supabase/functions` | `lalum-mcp` | לא נפרסה |
| `supabase/functions` | `verify-attorney` | לא נפרסה. הפונקציה החיה היא `lalum-attorney-verify` |

## משימות cron שקוראות לפונקציות

| משימה | תזמון | פונקציה |
|---|---|---|
| `lalum-daily-report` | `0 17 * * *` | `lalum-daily-report` |
| `lalum-dispatch-worker` | כל דקה | `lalum-dispatch-worker` |
| `lalum-newsletter-daily` | `0 6 * * *` | `lalum-newsletter-daily` |

ארבע משימות cron נוספות (`lalum-retention-purge`, `lalum-site-leads-purge`, `lalum-whatsapp-body-purge`, `pii-shield-purge-expired`) רצות בתוך המסד ולא קוראות לפונקציה.

## מה הלאה

1. **צעד 12:** להוריד את הקוד החי של שש הפונקציות שהאפליקציה קוראת להן ולהכניס אותו לריפו, ב־PR נפרד ובלי פריסה.
2. **צעד 12:** לבדוק בריפו LALUMap אם יש בו את `pii-gateway`, `lalum-dispatch-worker` ו־`lalum-inquiry-email`.
3. **צעד 13:** החלטה לכל פונקציה בלי קוד שלא נקראת מהאפליקציה: לייבא, להשאיר, או למחוק. מחיקה היא לחיצה של אבי.
4. **יום האבטחה, 26.10:** `lalum-diag` (T71) ושאר הפונקציות עם `verify_jwt` כבוי.

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { EXPENSE_CATEGORY, r2 } from "../../../lib/cockpit/finance";

const vatIncluded = (total: number) => r2((total * 18) / 118);

/**
 * One-time pilot catch-up: expenses for January, March, June and August 2026 found in the three
 * bookkeeping mailboxes and independently cross-checked against the underlying receipts (not just
 * the monthly summary emails sent to the bookkeeper). January's own summary email claimed an
 * attached report that does not actually exist, so every January row here was rebuilt from the
 * primary notices (Meta, Apple, invoice4u, Azrieli) found directly in the mailboxes, not from that
 * summary.
 *
 * What is NOT here, and why:
 * - The Anthropic, OpenRouter, MainFunc/Genspark and Airalo charges (USD) are left out. lalum_fin_expenses
 *   has no currency column, and the house rule for a foreign-currency document (see archiveRevenueEffect
 *   in finance.ts) is to convert at a rate actually on record, never a guessed one. No sourced NIS rate
 *   for these dates was reachable this round.
 * - The March "Link" invoice (142864) and the June UCO thesis fee, Haim Friedrich invoice 30151,
 *   and Google Ads/Wix charge: a real document exists for each, but no email gave a shekel amount.
 * - The August Azrieli rent (SI260200001644), Herzliya management fee (SI260210003176) and water
 *   charge (SI260210003188), and their four credit notes: these belong to the same-month lease
 *   termination and net out at or near zero, which lalum_fin_expenses cannot represent (total must
 *   be a positive number). They need the bookkeeper's own reconciliation, not an invented net figure.
 * - Cellcom Energy (377724412) and the Booking.com / Radisson Odesa charge: no invoice was found
 *   for either (the booking confirmation is not a tax invoice).
 * - January's Cellcom mobile invoice (period 14.12.2025 to 13.1.2026): the notification email carries
 *   only a binary PDF with no amount in the text, and no "charge notice" email with a figure was found
 *   this round. The Azrieli water invoice (SI260210000489, ₪142.00) is dated 1.2.2026, so it belongs to
 *   February, not January, and the office is disputing that water charge outright.
 *   (The Fiverr thesis-proofreading charge, ₪832.77, was called personal here at the time; the 2026
 *   ledger below books it as a business expense, and that later, more authoritative call is the one
 *   reflected in the data now.)
 *
 * One row added outside the four-month pilot batch: a Cellcom Energy electricity invoice supplied
 * directly by the user as a PDF (account 403733457, bill 380230665), billed to the home address
 * (האיריסים 8, נתניה) rather than the office. Confirmed by the user as a business expense to import
 * in full. This is a different Cellcom Energy account from the one already noted above as "no invoice
 * found" (377724412); that gap is still open.
 *
 * Source convention from this point on (set by the user, October 2026): expense documents come from
 * the same two bookkeeping mailboxes already used for the pilot, plus a fixed local folder named
 * "LALUM" on the user's desktop holding manual scans, organized by month. This session runs in the
 * cloud with no access to that local folder, so its contents are supplied by the user uploading files
 * into the chat.
 *
 * Full 2026 ledger import (129 rows, October 2026): the user supplied the bookkeeper's own general
 * ledger ("כרטסת חשבונות") for tax year 2026, produced by her accounting software ("רבגונית", בית
 * ארדני) and run through October, covering 19 expense accounts from January through September. The
 * user explicitly asked to trust this ledger and import it in full. Every account's running total
 * in the PDF was used as a checksum: each account's lines were transcribed and summed, and the sum
 * matched the ledger's own stated subtotal for all 19 accounts before anything was imported, so the
 * transcription below is verified against the source document itself, not assumed.
 * - Rows the ledger carries that were already in this file (by matching amount, date and the
 *   bookkeeper's own document reference) were left out to avoid duplicating them: the January Azrieli
 *   rent and management-fee rows, the August Azrieli electricity, BF Bitachon, Link, and invoice4u
 *   attendance-clock rows, and the June and August Gett rides.
 * - One line (חיים פרידריך, 9.8.2026, ₪389.00, ref 90048) is already in this file from the original
 *   August verification, which read the underlying document as "חשבון עסקה" (not a tax invoice) and
 *   so recorded it with no recoverable VAT. The ledger itself books the same amount with 18% VAT
 *   claimed. That is a real conflict between the two sources, not a timing difference; the existing
 *   row is left as it was found and verified, and the ledger's duplicate of it is not re-imported.
 * - The Azrieli water invoice (ref 489, ₪142.00) is excluded here too, for the same two reasons noted
 *   above: it is dated into February and it is under active dispute with Azrieli.
 * - The "999 - העברת מס תשומות" line (₪68.00) is a bookkeeping input-VAT transfer, not a purchase, and
 *   is not an expense this table can represent.
 * - Several rows the ledger books as 0% VAT (Anthropic, OpenAI, Genspark, and two un-labelled "ai"
 *   lines) are the same recurring USD charges excluded everywhere else in this file for lacking a
 *   sourced NIS rate. Here the bookkeeper's own ledger already states the NIS amount she posted (the
 *   actual credit-card-statement conversion, not a guessed rate), so these are imported using her
 *   figures rather than left out.
 * - The Fiverr thesis-proofreading charge (₪832.77, 3.1.2026) was called personal in the January pilot
 *   above; the ledger books it as a business expense, and that is the treatment imported here.
 * - Where a GL account name does not map cleanly onto EXPENSE_CATEGORY (e.g. "אולפן תאורה" under
 *   "אחזקה ותיקונים", or "IP TELECOM" under "פירסום"), the category follows the bookkeeper's own
 *   account rather than a guess from the vendor name.
 */
type Row = {
  spent_on: string; supplier: string; category: string; description: string;
  total: number; vat_amount: number; vat_recoverable_pct: number; ref: string; source: string;
};

const ROWS: Row[] = [
  { spent_on: "2026-01-03", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-31.12.2025 עד 3.1.2026",
    total: 482.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25694053963617651-25517579297931780", source: "הודעת תשלום Meta (לא חשבונית), 3.1.2026" },
  { spent_on: "2026-01-04", supplier: "Apple (iCloud+)", category: "SOFTWARE", description: "iCloud+ 50GB",
    total: 3.90, vat_amount: 0, vat_recoverable_pct: 100, ref: "MMQGH86D9J", source: "קבלת Apple, 4.1.2026" },
  { spent_on: "2026-01-04", supplier: "לינק ניהול תקשורת לעסקים", category: "COMMUNICATION", description: "",
    total: 58.73, vat_amount: vatIncluded(58.73), vat_recoverable_pct: 100, ref: "140179", source: "חשבונית מס קבלה, invoice4u, 4.1.2026" },
  { spent_on: "2026-01-06", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-2.1.2026 עד 6.1.2026",
    total: 510.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25600440132979036-25719991074357273", source: "הודעת תשלום Meta (לא חשבונית), 6.1.2026" },
  { spent_on: "2026-01-11", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-5.1.2026 עד 9.1.2026",
    total: 543.69, vat_amount: 0, vat_recoverable_pct: 100, ref: "25792394397116936-25681479828208391", source: "הודעת תשלום Meta (לא חשבונית), 11.1.2026" },
  { spent_on: "2026-01-13", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-11.1.2026 עד 13.1.2026",
    total: 539.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25699344813088565-25652460671110306", source: "הודעת תשלום Meta (לא חשבונית), 13.1.2026" },
  { spent_on: "2026-01-16", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-13.1.2026 עד 16.1.2026",
    total: 570.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25680322278324145-25808059798883733", source: "הודעת תשלום Meta (לא חשבונית), 16.1.2026" },
  { spent_on: "2026-01-21", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "שכירות 2/2026",
    total: 8530.00, vat_amount: 1301.19, vat_recoverable_pct: 100, ref: "SI260200000183", source: "חשבונית עזריאלי, 21.1.2026" },
  { spent_on: "2026-01-21", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "דמי ניהול 2/2026",
    total: 2341.00, vat_amount: 357.10, vat_recoverable_pct: 100, ref: "SI260210000338", source: "חשבונית עזריאלי, 21.1.2026" },
  { spent_on: "2026-01-30", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-15.1.2026 עד 30.1.2026",
    total: 603.00, vat_amount: 0, vat_recoverable_pct: 100, ref: "25761424516880590-25868210446201994", source: "הודעת תשלום Meta (לא חשבונית), 30.1.2026" },
  { spent_on: "2026-01-31", supplier: "Meta Platforms Ireland", category: "MARKETING", description: "מודעות Meta, מ-29.1.2026 עד 30.1.2026",
    total: 9.47, vat_amount: 0, vat_recoverable_pct: 100, ref: "25950878987935146-25891815013841542", source: "הודעת תשלום Meta (לא חשבונית), 31.1.2026" },

  { spent_on: "2026-03-04", supplier: "Apple (iCloud+)", category: "SOFTWARE", description: "iCloud+ 50GB",
    total: 3.90, vat_amount: 0, vat_recoverable_pct: 100, ref: "MMQGNH8X3H", source: "קבלת Apple, 4.3.2026" },

  { spent_on: "2026-06-13", supplier: "Gett", category: "TRAVEL", description: "נסיעה (לבדוק עסקי/פרטי)",
    total: 76.50, vat_amount: vatIncluded(76.50), vat_recoverable_pct: 100, ref: "", source: "קבלת Gett, 13.6.2026" },

  { spent_on: "2026-08-04", supplier: "Apple (iCloud+)", category: "SOFTWARE", description: "iCloud+ 50GB",
    total: 3.90, vat_amount: 0, vat_recoverable_pct: 100, ref: "MMQH3W25Z7", source: "קבלת Apple, 4.8.2026" },
  { spent_on: "2026-08-15", supplier: "Google One / AI Pro", category: "SOFTWARE", description: "מינוי AI Pro 5TB",
    total: 74.90, vat_amount: 0, vat_recoverable_pct: 100, ref: "SOP.3377-1494-8056", source: "קבלת Google Play, 15.8.2026" },
  { spent_on: "2026-08-05", supplier: "Gett", category: "TRAVEL", description: "נסיעה, ת\"א–הרצליה (לבדוק עסקי/פרטי)",
    total: 91.60, vat_amount: vatIncluded(91.60), vat_recoverable_pct: 100, ref: "", source: "קבלת Gett, 5.8.2026" },
  { spent_on: "2026-08-05", supplier: "Gett", category: "TRAVEL", description: "נסיעה, נתניה–בית יהושע (לבדוק עסקי/פרטי)",
    total: 46.70, vat_amount: vatIncluded(46.70), vat_recoverable_pct: 100, ref: "", source: "קבלת Gett, 5.8.2026" },
  { spent_on: "2026-08-03", supplier: "לינק ניהול תקשורת לעסקים", category: "COMMUNICATION", description: "",
    total: 58.87, vat_amount: vatIncluded(58.87), vat_recoverable_pct: 100, ref: "149750", source: "חשבונית מס קבלה, invoice4u" },
  { spent_on: "2026-08-04", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "חשמל סייטק 7/2026",
    total: 96.00, vat_amount: vatIncluded(96.00), vat_recoverable_pct: 100, ref: "SI260210002998", source: "חשבונית עזריאלי" },
  { spent_on: "2026-08-05", supplier: "ניהול חשבונות ישיר", category: "OFFICE", description: "שעון נוכחות",
    total: 53.00, vat_amount: vatIncluded(53.00), vat_recoverable_pct: 100, ref: "1094778", source: "חשבונית מס קבלה, invoice4u" },
  { spent_on: "2026-08-09", supplier: "חיים פרידריך עו\"ד", category: "OFFICE", description: "חשבון עסקה (אינו חשבונית מס, אין לנכות תשומות)",
    total: 389.00, vat_amount: 0, vat_recoverable_pct: 0, ref: "90048", source: "חשבון עסקה, ezcount" },
  { spent_on: "2026-08-14", supplier: "סלקום ישראל", category: "COMMUNICATION", description: "חיוב לתקופה 14.7–13.8",
    total: 216.77, vat_amount: vatIncluded(216.77), vat_recoverable_pct: 100, ref: "377532756", source: "הודעת חיוב סלקום, 20.8.2026" },
  { spent_on: "2026-08-17", supplier: "חיים פרידריך עו\"ד", category: "OFFICE", description: "סלקום 7/2026 + יתרת חוב",
    total: 943.00, vat_amount: vatIncluded(943.00), vat_recoverable_pct: 100, ref: "30158", source: "חשבונית מס קבלה, ezcount" },
  { spent_on: "2026-08-17", supplier: "חיים פרידריך עו\"ד", category: "OFFICE", description: "ארנונה (קבלה בלבד, אינה מזכה בניכוי תשומות)",
    total: 1635.00, vat_amount: 0, vat_recoverable_pct: 0, ref: "20010", source: "קבלה, ezcount" },
  { spent_on: "2026-08-23", supplier: "BF ביטחון", category: "COMMUNICATION", description: "אינטרנט למשרד",
    total: 1672.00, vat_amount: vatIncluded(1672.00), vat_recoverable_pct: 100, ref: "50183", source: "חשבונית מס" },

  { spent_on: "2026-10-18", supplier: "סלקום אנרג'י", category: "OFFICE", description: "חשמל, תקופה 9/2026, האיריסים 8 נתניה",
    total: 791.02, vat_amount: 120.66, vat_recoverable_pct: 100, ref: "380230665", source: "חשבונית מס, סלקום אנרג'י, 18.10.2026" },
  { spent_on: "2026-01-04", supplier: "נורית שטיין", category: "EDUCATION", description: "הדרכה",
    total: 560.00, vat_amount: 85.42, vat_recoverable_pct: 100, ref: "10283", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-09-04", supplier: "ניהול חשבונות ישיר", category: "SOFTWARE", description: "שעון נוכחות",
    total: 53.00, vat_amount: 8.08, vat_recoverable_pct: 100, ref: "4619", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-09-03", supplier: "לינק ניהול תקשורת לעסקים", category: "COMMUNICATION", description: "",
    total: 60.12, vat_amount: 9.17, vat_recoverable_pct: 100, ref: "51290", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-01", supplier: "ג'י אינטרנשיונל", category: "OFFICE", description: "אחזקת משרד",
    total: 666.00, vat_amount: 101.59, vat_recoverable_pct: 100, ref: "10033", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-23", supplier: "קומפיוטר לייט", category: "OFFICE", description: "",
    total: 35.00, vat_amount: 5.34, vat_recoverable_pct: 100, ref: "62707", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-16", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "דמי ניהול 3/2026",
    total: 2341.00, vat_amount: 357.10, vat_recoverable_pct: 100, ref: "790", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-16", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "דמי ניהול 4/2026",
    total: 2341.00, vat_amount: 357.10, vat_recoverable_pct: 100, ref: "1207", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-11", supplier: "נספרסו", category: "OFFICE", description: "",
    total: 356.90, vat_amount: 54.44, vat_recoverable_pct: 100, ref: "22404", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-17", supplier: "אולפן תאורה", category: "OFFICE", description: "",
    total: 1000.00, vat_amount: 152.54, vat_recoverable_pct: 100, ref: "1344", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-04-26", supplier: "נספרסו", category: "OFFICE", description: "",
    total: 329.50, vat_amount: 50.26, vat_recoverable_pct: 100, ref: "88477", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-07", supplier: "חיים פרידריך עו\"ד", category: "OFFICE", description: "ניקיון + סלקום",
    total: 2173.00, vat_amount: 331.47, vat_recoverable_pct: 100, ref: "30151", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-04", supplier: "א.י.ל גלאס", category: "OFFICE", description: "",
    total: 2360.00, vat_amount: 360.00, vat_recoverable_pct: 100, ref: "51406", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-31", supplier: "אהוד נופש וספורט בע\"מ", category: "OFFICE", description: "",
    total: 472.00, vat_amount: 72.00, vat_recoverable_pct: 100, ref: "25198", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-17", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "דמי ניהול 6/2026",
    total: 2361.00, vat_amount: 360.15, vat_recoverable_pct: 100, ref: "1980", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-12", supplier: "חיים פרידריך עו\"ד", category: "OFFICE", description: "חניה + סלקום",
    total: 1358.00, vat_amount: 207.15, vat_recoverable_pct: 100, ref: "30134", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-16", supplier: "נספרסו", category: "OFFICE", description: "",
    total: 432.30, vat_amount: 65.94, vat_recoverable_pct: 100, ref: "67537", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-20", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "דמי ניהול 8/2026",
    total: 2361.00, vat_amount: 360.15, vat_recoverable_pct: 100, ref: "2877", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-02", supplier: "אמילי נתניה", category: "OFFICE", description: "",
    total: 130.00, vat_amount: 19.83, vat_recoverable_pct: 100, ref: "44472", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-10", supplier: "נספרסו", category: "OFFICE", description: "",
    total: 69.68, vat_amount: 10.63, vat_recoverable_pct: 100, ref: "63588", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-23", supplier: "דור חדש חומרי חשמל", category: "OFFICE", description: "",
    total: 58.00, vat_amount: 8.85, vat_recoverable_pct: 100, ref: "13198", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-27", supplier: "פוקס הום", category: "OFFICE", description: "",
    total: 329.91, vat_amount: 50.33, vat_recoverable_pct: 100, ref: "75407", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-10", supplier: "דור חדש חומרי חשמל", category: "OFFICE", description: "",
    total: 687.00, vat_amount: 104.80, vat_recoverable_pct: 100, ref: "2895", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-21", supplier: "עלאא לגיזום", category: "OFFICE", description: "",
    total: 2360.00, vat_amount: 360.00, vat_recoverable_pct: 100, ref: "257", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-02", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "חשמל 1/2026",
    total: 151.00, vat_amount: 23.03, vat_recoverable_pct: 100, ref: "607", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-21", supplier: "סלקום אנרג'י", category: "OFFICE", description: "חשמל 1/2026",
    total: 317.87, vat_amount: 48.49, vat_recoverable_pct: 100, ref: "22678", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-04", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "חשמל 12/2025",
    total: 138.00, vat_amount: 21.05, vat_recoverable_pct: 100, ref: "39", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-04", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "חשמל 2/2026",
    total: 99.00, vat_amount: 15.10, vat_recoverable_pct: 100, ref: "962", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-04-21", supplier: "סלקום אנרג'י", category: "OFFICE", description: "חשמל 3/2026",
    total: 178.43, vat_amount: 27.22, vat_recoverable_pct: 100, ref: "54012", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-31", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "חשמל 3/2026",
    total: 80.00, vat_amount: 12.20, vat_recoverable_pct: 100, ref: "1403", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-21", supplier: "סלקום אנרג'י", category: "OFFICE", description: "חשמל 2/2026",
    total: 195.34, vat_amount: 29.80, vat_recoverable_pct: 100, ref: "50783", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-05", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "חשמל 4/2026",
    total: 76.00, vat_amount: 11.59, vat_recoverable_pct: 100, ref: "1728", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-05", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "חשמל 6/2026",
    total: 68.00, vat_amount: 10.37, vat_recoverable_pct: 100, ref: "2763", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-18", supplier: "סלקום אנרג'י", category: "OFFICE", description: "חשמל 6/2026",
    total: 332.86, vat_amount: 50.78, vat_recoverable_pct: 100, ref: "61721", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-18", supplier: "סלקום אנרג'י", category: "OFFICE", description: "חשמל 7/2026",
    total: 290.88, vat_amount: 44.37, vat_recoverable_pct: 100, ref: "24412-el", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-09-02", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "חשמל 8/2026",
    total: 80.00, vat_amount: 12.20, vat_recoverable_pct: 100, ref: "3383", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-06", supplier: "Anthropic", category: "MARKETING", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 290.80, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "12", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-24", supplier: "גאמא", category: "MARKETING", description: "",
    total: 286.00, vat_amount: 43.63, vat_recoverable_pct: 100, ref: "59193", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-19", supplier: "גאמא", category: "MARKETING", description: "",
    total: 286.00, vat_amount: 43.63, vat_recoverable_pct: 100, ref: "53737", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-12", supplier: "חיים פרידריך עו\"ד", category: "MARKETING", description: "פרסום",
    total: 3642.00, vat_amount: 555.56, vat_recoverable_pct: 100, ref: "30135", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-01", supplier: "Anthropic", category: "MARKETING", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 30.16, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "6", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-01", supplier: "Anthropic", category: "MARKETING", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 44.22, vat_amount: 6.75, vat_recoverable_pct: 100, ref: "5", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-01", supplier: "Anthropic", category: "MARKETING", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 29.48, vat_amount: 4.50, vat_recoverable_pct: 100, ref: "7", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-06", supplier: "AI", category: "MARKETING", description: "חיוב כרטיס אשראי, ש\"ח (ספק לא מזוהה בכרטסת)",
    total: 301.30, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "14-ai", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-06", supplier: "AI", category: "MARKETING", description: "חיוב כרטיס אשראי, ש\"ח (ספק לא מזוהה בכרטסת)",
    total: 300.60, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "13-ai", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-20", supplier: "IP TELECOM", category: "MARKETING", description: "",
    total: 109.73, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "54642", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-06", supplier: "Anthropic", category: "MARKETING", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 300.00, vat_amount: 45.76, vat_recoverable_pct: 100, ref: "14-an2", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-30", supplier: "עג'מי ייעוץ כספים והנהלת חשבונות", category: "PROFESSIONAL", description: "",
    total: 1770.00, vat_amount: 270.00, vat_recoverable_pct: 100, ref: "1930", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-19", supplier: "מיקרוסופט", category: "SOFTWARE", description: "",
    total: 47.40, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "5174", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-31", supplier: "Genspark", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 61.90, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "74273", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-03", supplier: "Fiverr Pro", category: "SOFTWARE", description: "עריכת עבודת תזה (בעבר סווג פרטי; הכרטסת מציגה אותו כהוצאה עסקית)",
    total: 832.77, vat_amount: 127.03, vat_recoverable_pct: 100, ref: "34280", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2025-12-19", supplier: "מיקרוסופט", category: "SOFTWARE", description: "",
    total: 47.21, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "5602", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2025-12-09", supplier: "OpenAI", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 62.94, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "60025", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-19", supplier: "מיקרוסופט", category: "SOFTWARE", description: "",
    total: 47.21, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "33401", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-09", supplier: "OpenAI", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 94.41, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "60026", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-09", supplier: "OpenAI", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 0.01, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "60027", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-08", supplier: "Anthropic", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 94.41, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "1-an", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-22", supplier: "Anthropic", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 31.47, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "2-an", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-22", supplier: "Anthropic", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 157.35, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "3-an", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-18", supplier: "Anthropic", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 15.74, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "70001", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-03", supplier: "לינק ניהול תקשורת לעסקים", category: "COMMUNICATION", description: "",
    total: 62.89, vat_amount: 9.59, vat_recoverable_pct: 100, ref: "41548", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-06", supplier: "קומפיוטר לייט", category: "SOFTWARE", description: "",
    total: 385.00, vat_amount: 58.73, vat_recoverable_pct: 100, ref: "62792", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-06", supplier: "קומפיוטר לייט", category: "SOFTWARE", description: "",
    total: 280.00, vat_amount: 42.71, vat_recoverable_pct: 100, ref: "62798", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-29", supplier: "Genspark", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 740.61, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "13402", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-04", supplier: "Genspark", category: "SOFTWARE", description: "חיוב כרטיס אשראי, ש\"ח",
    total: 61.72, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "26698", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-03", supplier: "לינק ניהול תקשורת לעסקים", category: "COMMUNICATION", description: "",
    total: 55.85, vat_amount: 8.52, vat_recoverable_pct: 100, ref: "46965", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-03", supplier: "לינק ניהול תקשורת לעסקים", category: "COMMUNICATION", description: "",
    total: 63.00, vat_amount: 9.61, vat_recoverable_pct: 100, ref: "45454", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-18", supplier: "סלקום", category: "COMMUNICATION", description: "אינטרנט 7/2026",
    total: 47.90, vat_amount: 7.31, vat_recoverable_pct: 100, ref: "24412-net", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-17", supplier: "חיים פרידריך עו\"ד", category: "COMMUNICATION", description: "אינטרנט",
    total: 389.00, vat_amount: 59.34, vat_recoverable_pct: 100, ref: "90032-net", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-05", supplier: "yes", category: "COMMUNICATION", description: "מנוי 12/2025",
    total: 20.49, vat_amount: 3.13, vat_recoverable_pct: 100, ref: "55127", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-03", supplier: "לינק ניהול תקשורת לעסקים", category: "COMMUNICATION", description: "",
    total: 71.94, vat_amount: 10.97, vat_recoverable_pct: 100, ref: "42864", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-21", supplier: "סלקום", category: "COMMUNICATION", description: "טלפון 12/2025",
    total: 163.29, vat_amount: 16.61, vat_recoverable_pct: 100, ref: "6204", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-14", supplier: "סלקום", category: "COMMUNICATION", description: "טלפון, מ-14.2.2026 עד 13.3.2026",
    total: 29.90, vat_amount: 3.04, vat_recoverable_pct: 100, ref: "61696", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-04-14", supplier: "סלקום", category: "COMMUNICATION", description: "טלפון, מ-14.3.2026 עד 13.4.2026",
    total: 29.90, vat_amount: 3.04, vat_recoverable_pct: 100, ref: "83237", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-14", supplier: "סלקום", category: "COMMUNICATION", description: "טלפון 5/2026",
    total: 35.28, vat_amount: 3.59, vat_recoverable_pct: 100, ref: "34543", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-14", supplier: "סלקום", category: "COMMUNICATION", description: "טלפון 4/2026",
    total: 35.28, vat_amount: 3.59, vat_recoverable_pct: 100, ref: "1943", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-04-19", supplier: "בהנובג אל מוביל", category: "COMMUNICATION", description: "סוללה",
    total: 258.00, vat_amount: 26.24, vat_recoverable_pct: 100, ref: "51523", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-14", supplier: "סלקום", category: "COMMUNICATION", description: "טלפון 6/2026",
    total: 29.90, vat_amount: 3.04, vat_recoverable_pct: 100, ref: "85025", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-01", supplier: "סלולר מרקט", category: "COMMUNICATION", description: "",
    total: 150.00, vat_amount: 15.25, vat_recoverable_pct: 100, ref: "66775", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-18", supplier: "סלקום", category: "COMMUNICATION", description: "טלפון 7/2026",
    total: 29.90, vat_amount: 3.04, vat_recoverable_pct: 100, ref: "24412-mob", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-09-14", supplier: "סלקום", category: "COMMUNICATION", description: "טלפון 8/2026",
    total: 516.22, vat_amount: 52.50, vat_recoverable_pct: 100, ref: "64304", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-04", supplier: "נסיעת עסקים לאוקראינה", category: "TRAVEL", description: "מ-28.7.2026 עד 4.8.2026",
    total: 7022.79, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "18", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-25", supplier: "מונית", category: "TRAVEL", description: "",
    total: 450.00, vat_amount: 68.64, vat_recoverable_pct: 100, ref: "4860", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-26", supplier: "מרקט טו גו", category: "OFFICE", description: "",
    total: 39.08, vat_amount: 5.96, vat_recoverable_pct: 100, ref: "18301", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-01", supplier: "מאפה נאמן", category: "OFFICE", description: "",
    total: 65.90, vat_amount: 10.05, vat_recoverable_pct: 100, ref: "82783", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-15", supplier: "פוליצר", category: "OFFICE", description: "",
    total: 52.84, vat_amount: 8.06, vat_recoverable_pct: 100, ref: "84282", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-20", supplier: "ג'ינג'ר", category: "OFFICE", description: "",
    total: 69.77, vat_amount: 5.37, vat_recoverable_pct: 100, ref: "41251", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-14", supplier: "מאפה נאמן", category: "OFFICE", description: "",
    total: 76.00, vat_amount: 11.59, vat_recoverable_pct: 100, ref: "44246", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-04", supplier: "מאפה נאמן", category: "OFFICE", description: "",
    total: 78.00, vat_amount: 11.90, vat_recoverable_pct: 100, ref: "38376", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-23", supplier: "ג'ינג'ר", category: "OFFICE", description: "",
    total: 180.63, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "47722", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-12", supplier: "ג'ינג'ר", category: "OFFICE", description: "",
    total: 282.11, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "46599", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-20", supplier: "ג'ינג'ר", category: "OFFICE", description: "",
    total: 454.48, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "50307", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-20", supplier: "ג'ינג'ר", category: "OFFICE", description: "",
    total: 227.66, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "50313", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-24", supplier: "אברהמי תבלינים ופיצוחים", category: "OFFICE", description: "",
    total: 470.28, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "32864", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-01", supplier: "חיים פרידריך עו\"ד", category: "OFFICE", description: "על חשבון שכירות",
    total: 666.00, vat_amount: 101.59, vat_recoverable_pct: 100, ref: "30123", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-16", supplier: "גמל תשואה להשקעות", category: "OFFICE", description: "שכירות 3/2026",
    total: 8530.00, vat_amount: 1301.19, vat_recoverable_pct: 100, ref: "335", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-16", supplier: "גמל תשואה להשקעות", category: "OFFICE", description: "שכירות 4/2026",
    total: 8530.00, vat_amount: 1301.19, vat_recoverable_pct: 100, ref: "638", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-04-16", supplier: "גמל תשואה להשקעות", category: "OFFICE", description: "שכירות + חניה 5/2026",
    total: 9178.00, vat_amount: 1400.03, vat_recoverable_pct: 100, ref: "809", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-16", supplier: "גמל תשואה להשקעות", category: "OFFICE", description: "שכירות + חניה 7/2026",
    total: 9259.00, vat_amount: 1412.39, vat_recoverable_pct: 100, ref: "1290", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-17", supplier: "גמל תשואה להשקעות", category: "OFFICE", description: "שכירות + חניה 6/2026",
    total: 9259.00, vat_amount: 1412.39, vat_recoverable_pct: 100, ref: "964", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-07-20", supplier: "גמל תשואה להשקעות", category: "OFFICE", description: "שכירות 8/2026",
    total: 9259.00, vat_amount: 1412.39, vat_recoverable_pct: 100, ref: "1482", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-01-07", supplier: "חיים פרידריך עו\"ד", category: "VEHICLE", description: "חניה 1/2026",
    total: 656.00, vat_amount: 66.71, vat_recoverable_pct: 100, ref: "30114", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-17", supplier: "חיים פרידריך עו\"ד", category: "VEHICLE", description: "חניה 2/2026",
    total: 969.00, vat_amount: 98.54, vat_recoverable_pct: 100, ref: "90032-park", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-14", supplier: "חניון יכין סנטר", category: "VEHICLE", description: "",
    total: 11.75, vat_amount: 1.19, vat_recoverable_pct: 100, ref: "24363", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-12", supplier: "חניון הברזל", category: "VEHICLE", description: "",
    total: 36.00, vat_amount: 3.66, vat_recoverable_pct: 100, ref: "211", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-30", supplier: "גמל תשואה להשקעות", category: "VEHICLE", description: "חניה 4/2026",
    total: 323.00, vat_amount: 32.85, vat_recoverable_pct: 100, ref: "105", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-07", supplier: "דורון מוטורס", category: "VEHICLE", description: "",
    total: 6962.00, vat_amount: 708.00, vat_recoverable_pct: 100, ref: "40917", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-17", supplier: "חניון יכין סנטר", category: "VEHICLE", description: "",
    total: 4.25, vat_amount: 0.43, vat_recoverable_pct: 100, ref: "66409", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-17", supplier: "חניון יכין סנטר", category: "VEHICLE", description: "",
    total: 14.75, vat_amount: 1.50, vat_recoverable_pct: 100, ref: "66411", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-18", supplier: "חניון הילטון", category: "VEHICLE", description: "",
    total: 15.60, vat_amount: 1.59, vat_recoverable_pct: 100, ref: "6022", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-18", supplier: "חניון הילטון", category: "VEHICLE", description: "",
    total: 64.20, vat_amount: 6.53, vat_recoverable_pct: 100, ref: "6026", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-17", supplier: "חניון יכין סנטר", category: "VEHICLE", description: "",
    total: 16.25, vat_amount: 1.65, vat_recoverable_pct: 100, ref: "66410", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-24", supplier: "שטיפת רכבים", category: "VEHICLE", description: "",
    total: 100.00, vat_amount: 10.17, vat_recoverable_pct: 100, ref: "1754", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-17", supplier: "חניון דר", category: "VEHICLE", description: "",
    total: 20.00, vat_amount: 2.03, vat_recoverable_pct: 100, ref: "92634", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-23", supplier: "חניון רכב בי.סי", category: "VEHICLE", description: "",
    total: 85.00, vat_amount: 8.64, vat_recoverable_pct: 100, ref: "40851", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-19", supplier: "חניוני הדרך", category: "VEHICLE", description: "",
    total: 100.00, vat_amount: 10.17, vat_recoverable_pct: 100, ref: "13828", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-24", supplier: "חניון קרתא", category: "VEHICLE", description: "",
    total: 145.00, vat_amount: 14.75, vat_recoverable_pct: 100, ref: "10587", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-09-30", supplier: "כביש 6 / נתיבי איילון", category: "VEHICLE", description: "ריכוז מנהרות הכרמל, מ-12/2025 עד 5/2026",
    total: 1448.99, vat_amount: 0.00, vat_recoverable_pct: 100, ref: "68739", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-31", supplier: "עיריית הרצליה", category: "FEES", description: "ארנונה 1-8/2026, תשלום 1 מתוך 3",
    total: 35766.17, vat_amount: 0.00, vat_recoverable_pct: 0, ref: "arnona8m", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-01", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "מים 12/2025",
    total: 48.00, vat_amount: 7.32, vat_recoverable_pct: 100, ref: "449", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-03-31", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "מים, מ-12/2025 עד 2/2026",
    total: 387.55, vat_amount: 59.12, vat_recoverable_pct: 100, ref: "31551", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-17", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "מים, מ-2/2026 עד 4/2026",
    total: 588.95, vat_amount: 89.84, vat_recoverable_pct: 100, ref: "75626", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-30", supplier: "הרצליה ביזנס פארק תפעול", category: "OFFICE", description: "מים 7/2026",
    total: 59.00, vat_amount: 9.00, vat_recoverable_pct: 100, ref: "2562", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-05-05", supplier: "רשות הרישוי", category: "FEES", description: "אגרה שנתית לחידוש רישיון",
    total: 1830.00, vat_amount: 0.00, vat_recoverable_pct: 0, ref: "lic2026", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-18", supplier: "קומפיוטר לייט", category: "OFFICE", description: "מחשב מיני Lenovo",
    total: 1750.00, vat_amount: 266.95, vat_recoverable_pct: 100, ref: "62656", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-02-23", supplier: "קומפיוטר לייט", category: "OFFICE", description: "מחשב נייד + מסך",
    total: 4084.00, vat_amount: 622.98, vat_recoverable_pct: 100, ref: "62706", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-06-17", supplier: "דבליו שמונה", category: "OFFICE", description: "ריהוט",
    total: 5394.00, vat_amount: 822.81, vat_recoverable_pct: 100, ref: "3929", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-08-17", supplier: "טיב טוב אלקטריק", category: "OFFICE", description: "מזגן",
    total: 2180.00, vat_amount: 332.54, vat_recoverable_pct: 100, ref: "33095", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-09-02", supplier: "אל איי ספורט", category: "OFFICE", description: "שולחן",
    total: 2979.00, vat_amount: 454.42, vat_recoverable_pct: 100, ref: "33041", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
  { spent_on: "2026-04-01", supplier: "דאבלגייט בע\"מ", category: "OFFICE", description: "שיפורים במבנה",
    total: 35400.00, vat_amount: 5400.00, vat_recoverable_pct: 100, ref: "472", source: "כרטסת חשבונות 2026, רבגונית/ארדני, 22.10.2026" },
];

export function HistoricalImport({ firmId, onImported }: { firmId: string; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(ROWS);
  const [checked, setChecked] = useState<boolean[]>(() => ROWS.map(() => true));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const selectedCount = checked.filter(Boolean).length;

  async function importSelected() {
    if (!supabase) return;
    setBusy(true); setMsg(null);
    const picked = rows.filter((_, i) => checked[i]);
    const { error } = await supabase.from("lalum_fin_expenses").insert(
      picked.map((r) => ({
        firm_id: firmId, spent_on: r.spent_on, supplier: r.supplier, category: r.category,
        description: r.description.trim() || null, total: r.total, vat_amount: r.vat_amount,
        vat_recoverable_pct: r.vat_recoverable_pct, supplier_doc_ref: r.ref.trim() || null,
      })),
    );
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `יובאו ${picked.length} הוצאות.` });
    onImported();
    setDone(true);
  }

  if (!open) {
    return (
      <div className="ck-card">
        <div className="ck-row" style={{ justifyContent: "space-between" }}>
          <div className="ck-meta">ייבוא הוצאות היסטוריות: הוצאות מינואר עד אוגוסט 2026 שאומתו מול המיילים המקוריים, חשבונית חשמל מאוקטובר, וכרטסת החשבונות המלאה של רונית לשנת 2026 (129 שורות, מינואר עד ספטמבר).</div>
          <button className="ck-btn" onClick={() => setOpen(true)}>פתיחה לבדיקה</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ck-card ck-stack">
      <div className="ck-title">ייבוא הוצאות היסטוריות (פיילוט)</div>
      <div className="ck-warn">
        הוצאות ב-דולר שלא נמצא להן שער מתועד בכרטסת (MainFunc/Genspark מקצת החודשים, Airalo) הושארו בצד: אין שדה מטבע
        בטבלה, ועדיף לא לייבא מאשר לנחש שער. שלוש חשבוניות עזריאלי/הרצליה שקוזזו באותו חודש בסיום השכירות, וזיכויי
        invoice4u/הרצליה (אגרת UCO, Wix/Google Ads) חסרי סכום מאומת, הושארו גם הם בצד. חשבונית הסלקום החודשית לינואר
        וחשבונית המים של עזריאלי (SI260210000489, מתוארכת 1.2.2026 ותחת מחלוקת של המשרד) הושארו בצד גם הן. כרטסת
        החשבונות של רונית (129 שורות, ינואר עד ספטמבר) יובאה במלואה לבקשת המשתמש, למעט שורות שכבר קיימות כאן, שורה אחת
        שסותרת אימות קודם (חיים פרידריך 90048, ראו הערת הקוד), ושורת "העברת מס תשומות" שאינה הוצאה אמיתית.
      </div>
      <div className="ck-table-wrap">
        <table className="ck-table" data-cards="off">
          <thead><tr><th></th><th>תאריך</th><th>ספק</th><th>קטגוריה</th><th>תיאור</th><th className="fin-num">סכום</th><th className="fin-num">מע"מ</th><th>מקור</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input type="checkbox" checked={checked[i]} onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} /></td>
                <td><input className="ck-input" type="date" value={r.spent_on} onChange={(e) => setRow(i, { spent_on: e.target.value })} /></td>
                <td className="fin-text">{r.supplier}</td>
                <td><select className="ck-select" value={r.category} onChange={(e) => setRow(i, { category: e.target.value })}>{Object.entries(EXPENSE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td className="fin-text">{r.description}</td>
                <td className="fin-num"><input className="ck-input" dir="ltr" inputMode="decimal" style={{ width: 80, minWidth: 80 }} value={r.total} onChange={(e) => setRow(i, { total: Number(e.target.value) || 0 })} /></td>
                <td className="fin-num"><input className="ck-input" dir="ltr" inputMode="decimal" style={{ width: 70, minWidth: 70 }} value={r.vat_amount} onChange={(e) => setRow(i, { vat_amount: Number(e.target.value) || 0 })} /></td>
                <td className="ck-meta">{r.source}{r.ref ? ` · ${r.ref}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
      <div className="ck-row">
        <button className="ck-btn primary" disabled={busy || selectedCount === 0} onClick={() => void importSelected()}>
          {busy ? "מייבאים…" : `ייבוא ${selectedCount} הוצאות שנבחרו`}
        </button>
        <button className="ck-btn" onClick={() => setOpen(false)}>סגירה</button>
      </div>
    </div>
  );
}

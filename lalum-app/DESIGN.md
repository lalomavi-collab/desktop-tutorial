---
name: LALUM
colors:
  ivory: "#f5f1e8"
  paper: "#fbf9f3"
  card: "#ffffff"
  ink: "#1a1815"
  slate: "#55514a"
  sage: "#537056"
  sage-hover: "#4c6850"
  sage-bright: "#769d79"
  sage-tint: "#e7ede4"
  line: "#e3dccd"
  line-strong: "#d3c9b5"
  success: "#3f8f5f"
  danger: "#b3402f"
  warning: "#b8842a"
  brand-green-on-white: "#00855d"
typography:
  body-latin:
    fontFamily: "Hanken Grotesk"
  display:
    fontFamily: "Lalum Serif"
  body-hebrew:
    fontFamily: "Assistant"
---

# Design system: LALUM (app and site)

Source of truth: `src/index.css` (`:root` and the `html[lang="he"]` block). This file describes it; it does not redefine it. If they differ, the CSS wins and this file is corrected.

## Overview

A warm ivory ground, near black ink, one muted sage accent, hairline borders. Editorial and calm: serif display type over a clean sans body. The accent token names still say `clay` in the code (`--clay`, `--clay-hover`, `--clay-bright`, `--clay-tint`) for historical reasons, but the colour is sage. Do not reintroduce clay or terracotta.

## Colour

- **Ground:** `--ivory` for the page, `--paper` for raised bands, `--card` (white) for cards.
- **Text:** `--ink` for headings and body, `--slate` for secondary text.
- **Accent:** one only. `--clay` (sage `#537056`) carries white button text and passes AA on ivory and on the tint. `--clay-bright` is for text and icons on `--ink`. `--clay-tint` is the soft fill.
- **Lines:** `--line` and `--line-strong`.
- **Status:** `--success`, `--danger`, `--warning` for state only, never decoration.
- `--brand-green-on-white` only where white text sits on a green fill.
- Contrast is a hard floor (WCAG AA). The CSS comments record the measured ratios: do not lighten these tokens.

## Typography

- Display, all languages except Arabic: Lalum Serif, a merged cut of Frank Ruhl Libre (Hebrew) and Newsreader (Latin), self-hosted, with real 400, 500 and 700 faces and a 400 italic. Headlines sit on 500. See `brand/fonts/README.md`. Never set the LALUM name in it as a logo.
- Body, Latin: Hanken Grotesk. Body, Hebrew (`html[lang="he"]`): Assistant, with Heebo as fallback. Hebrew gets slightly more line height so descenders never clip.
- Arabic keeps Markazi Text and Cairo. Do not add families.
- One exception, by the owner (20.10.2026): the home page headline ("AI שאפשר להגן עליו.") is set in Amatic SC Regular, a condensed handwritten face used as a signature, self-hosted as `public/fonts/amatic-sc-400.woff2`. On 21.10.2026 the owner extended it to the page headline (h1) of every public route, in Hebrew, English, Spanish and French, with one size scale (48 to 72px) and one ink colour; nothing else is set in it, and Arabic, the cockpit and the workspace keep their own faces.
- Mono (JetBrains Mono) is for data and code only.

## Layout

Section rhythm `--sec` (108px), content width `--maxw` (1180px). Right-to-left is the reference: use logical properties and mirror icons that imply direction. Verify at 375, 768 and 1280 px.

## Logo

The wordmark is artwork. Use `src/components/Wordmark.tsx` inside the app. It inherits `currentColor`, so it works on ivory and on dark bands. Outside the app use `public/lalum-logo.svg` (light) or `public/lalum-logo-inverse.svg` (dark). Clear space equals the letter height. Never recolour to two tones, stretch, box, or substitute a typeface.

## Do

- Reuse existing tokens and classes before adding any.
- Keep one accent colour per view.
- Respect `prefers-reduced-motion`.
- Keep Hebrew and English layouts equally finished.

## Don't

- No gradients on text, no glow shadows, no glassmorphism, no neon.
- No new colour, font or radius outside the tokens above without the owner's request.
- No side-stripe card borders, no decorative eyebrow labels added for filler.
- No dashes as punctuation in any copy or comment.
- No second logo or mark.

## The cockpit's navy skin

By the owner's request (30.10.2026, "the look of Clio's apps, a quality professional app"), the cockpit offers a navy look beside the beige and the dark ones, not instead of them; the three swatches at the top of the rail switch between them, beige stays the default, and the choice is remembered per browser. The navy look is a skin: `src/styles/cockpit-navy.css`, applied as `data-ck-skin="navy"` on `.ck-root` over the light (mint) theme. Cool grey ground, flat white cards with a hairline, one deep navy (`#14324f`) for the rail, the primary action and selection, Heebo at every level, 16px cards and 10px controls. Charts move from green to a navy and blue ramp; red stays for expenses and risk, amber for caution. The drawings keep their shapes, recoloured by CSS. The dark theme and the public site are unchanged. Contrast of the skin's tokens is checked by `npm run cockpit-text-check`.

## The matters table

By the owner's request (31.10.2026, from the competitor scan, after Clio's matters list), the matters list on `/workspace` is a table you work with: a search, a sort by six keys (last updated, opened, name, number, owner, nearest date), filters by status, practice, "mine" and "needs attention", and a list or cards view. Open matters show by default; the archive is one choice away. The owner is the first member placed on the matter, else its creator; the nearest date is the nearest open deadline or open task, an overdue one included and marked red. The view and the sort are remembered per browser, the search text never is, and while client names are hidden the search and the name sort see the matter code only (`src/lib/cockpit/matterTable.ts`, checked by `npm run matter-table-check`). On a phone the filters fold behind one "סינון ומיון" button.

## The entry gate

By the owner's request (31.10.2026, after Clio's "select the application" screen), the first screen after a partner or admin signs in is `/workspace/start`: the wordmark large, one question, and six cards that open the parts of the system (matters, finance, dashboard, clients, diary, LEX). Each card points at a screen that already exists, carries one soft tint of its own and one of the cockpit drawings, and reads like an app icon; on a phone the cards become two columns of tiles with the name only. The card opened last is offered first. The bookkeeper skips the gate and lands in finance; a client goes to the portal. The rail logo leads back to the gate. It follows the three looks through the same tokens (`src/styles/cockpit-gate.css`).

## Not this system: documents and posts

Documents (docx, html, pdf), social images and decks use the Prestige palette from the root `CLAUDE.md`: Obsidian `#1B1B1B`, Gold `#D4AF37`, Cream `#FFFDD0`, Burgundy `#800020`. That palette is not used in the app.

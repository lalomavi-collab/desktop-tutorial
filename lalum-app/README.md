# LALUM app

The full LALUM web application: a marketing site plus a client area, built with
React, Vite, and TypeScript. The visual language (clay/ivory, Newsreader +
Hanken Grotesk) is ported from the `Home-en` Claude Design source.

## Stack

- React 19 + React Router 7
- Vite 8 + TypeScript
- Supabase (`@supabase/supabase-js`) for the client area

## Languages (bilingual)

The whole app is bilingual, Hebrew and English, with a language toggle in the
header. Switching language sets `dir` and `lang` on the document, swaps to
Hebrew-appropriate fonts (Frank Ruhl Libre, Heebo), and keeps Latin and
technical tokens (LALUM, Tech-Legal, EU AI Act) upright inside Hebrew text.

The opening language is resolved in this order:

1. A saved choice in `localStorage` (the toggle writes it), which always wins.
2. Otherwise, browser detection: a Hebrew browser (`he-*` or the legacy `iw-*`)
   opens in Hebrew (RTL); everyone else opens in English.

- All copy lives in one dictionary, `src/lib/strings.ts` (`en` and `he`); `he`
  is type-checked against `en`, so a missing key fails the build.
- The active language comes from `src/context/LangContext.tsx` (`useLang()`).
- To change the no-hint fallback, edit `FALLBACK_LANG` in that file.

## Getting started

```bash
cd lalum-app
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
```

## Pages

Marketing:

- `/` Home: positioning, three pillars, the Tech-Legal envelope, why LALUM, founder, FAQ.
- `/advisory` Advisory & Mediation: services, Decision-Oriented Mediation (DOM), testimonials, engagement models.
- `/training` Training: audiences, curriculum modules, formats.
- `/insights` Insights, and `/insights/:slug` individual articles (legal-logic, memory, defensible).
- `/legal` Terms, privacy, and accessibility (linked from the footer), with a not-legal-advice disclaimer.

A floating **AI assistant** (chat widget) is available site-wide. It posts the
conversation to the `legal-assistant` Supabase Edge Function, which proxies to
the Anthropic API server-side (set `ANTHROPIC_API_KEY` as a function secret). In
demo mode (no Supabase) it returns a canned reply pointing to booking a call.

Client area:

- `/login` Sign in / sign up.
- `/portal` Protected. Book a Tech-Legal Diagnostics session, and run attorney verification against the bar registry.

## Supabase / client area

The client area reads two Vite env vars:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Copy `.env.example` to `.env.local` and fill them in. **When they are absent the
app runs in demo mode**: authentication and the portal forms work end to end
against local state, so the whole app is runnable with no backend.

When configured, the portal talks to the existing Supabase project:

- **Booking** inserts into `public.consultation_requests`
  (migration `supabase/migrations/0003_consultation_requests.sql`), owned by the
  signed-in user via RLS.
- **Attorney verification** calls the `verify-attorney` Edge Function, which
  matches the submitted name and license against `bar_registry`
  (migrations `0001`/`0002`). Only an exact match auto-verifies; everything else
  is routed to manual review.

## Notes

- Icons are served from `public/icons.svg` as an SVG sprite.
- Routing uses `BrowserRouter`; `vite preview` and most static hosts need an SPA
  fallback to `index.html` for deep links.

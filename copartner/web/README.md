# CoPartner AI: Landing Page

The AI-native legal partnership platform: a single marketing/application page
selecting experienced practitioners to lead specialized domains. Built from
the CoPartner AI master build specification, adapted to this repository's
existing conventions (Vite + React + TypeScript + Tailwind v4, the same stack
`lalum-app` and `ldr/web` already use) rather than the spec's default
Next.js suggestion, per the spec's own instruction to integrate with what a
project already has instead of replacing it.

This is a **separate brand and a separate app** from LALUM (`lalum-app`) and
LAWDin (`ldr/web`). It does not use the LALUM wordmark, palette or
positioning rules; it has its own dark/cyan/gold design system (see
`src/index.css`).

## Running locally

```bash
cd copartner/web
npm install
npm run dev        # http://localhost:5174
```

## Backend (application form)

The confidential "Apply to Lead a Domain" form persists to its own Supabase
project (not shared with lalum-app or ldr/web):

1. Create a Supabase project for CoPartner AI.
2. Run `supabase/schema.sql` against it (creates `copartner_applications`
   with RLS: anon can insert, nothing can be read back from the browser).
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (the publishable/anon key; RLS is what protects
   the data, same pattern as `ldr/web`).

Until that project exists, the form still works end-to-end in the browser
(validation, success state) but submissions are only logged to the console,
not persisted. `src/lib/supabase.ts` fails open rather than crashing.

## Build

```bash
npm run build       # tsc -b && vite build, outputs dist/
```

## What's still a placeholder

- The production domain (`copartner.ai`) in `index.html` / `robots.txt` /
  `sitemap.xml` is a placeholder until a real domain is provisioned.
- `og-card.png` referenced in the OG/Twitter meta tags does not exist yet;
  add a real 1200x630 share image at that path before launch.
- The Supabase project for `copartner_applications` (see above) has not been
  created; the form degrades gracefully until it is.

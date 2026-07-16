# Deploying the LALUM app

The app is a static Vite build (a single-page app). It runs on any static host.
Config for the three common hosts is included, so the hosting provider can be
chosen at the end without code changes.

## Build

```
cd lalum-app
npm install
npm run build      # outputs static files to dist/
```

Generic host settings (use these on whichever provider is chosen):

- Root directory: `lalum-app`
- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: 22 (pinned in `.nvmrc`)

## SPA routing (already configured)

Client-side routes such as `/insights/legal-logic` must fall back to
`index.html`. The needed config ships in the repo:

- **Vercel**: `vercel.json` (rewrites).
- **Netlify**: `netlify.toml` (redirect rule).
- **Cloudflare Pages / Netlify**: `public/_redirects`, copied to `dist/_redirects` on build.

Any other static host: add a rule that rewrites unknown paths to `/index.html`
with status 200.

## Environment variables (optional)

Without these, the app runs in a self-contained demo mode (auth and portal forms
work locally, the assistant returns a canned reply). Set them to connect the live
backend:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Set them in the host's environment settings, then redeploy.

## Backend (Supabase), when going live

From `lalum-app/`:

1. Apply the migrations in `supabase/migrations/` to your Supabase project.
2. Deploy the Edge Functions:
   ```
   supabase functions deploy lalum-assistant
   supabase functions deploy lalum-attorney-verify
   ```
3. Set the assistant's API key as a function secret:
   ```
   supabase secrets set ANTHROPIC_API_KEY=...
   ```

All backend objects are LALUM-owned (`lalum_*`); the app does not touch any other
application's data.

## Custom domain

1. Deploy to the chosen host and confirm the app works on its default URL.
2. Add the new domain (or a subdomain such as `app.lalum.co`) in the host's
   domain settings.
3. Point DNS at the host: a `CNAME` for a subdomain, or the host's `A`/`ALIAS`
   records for a root domain. The host issues HTTPS automatically.

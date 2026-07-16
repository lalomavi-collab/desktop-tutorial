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

## Cloudflare Pages (smoothest, since the domain is at Cloudflare)

Because `lalumapp.com` is registered at Cloudflare, Cloudflare Pages keeps DNS
and HTTPS in the same account.

1. Cloudflare dashboard, Workers & Pages, Create, Pages, Connect to Git, and pick
   this repository and branch.
2. Build settings:
   - Root directory: `lalum-app`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variable `NODE_VERSION` = `22` (or rely on `.nvmrc`).
3. SPA routing works out of the box via `public/_redirects`.
4. After the first deploy: Custom domains, add `lalumapp.com` and
   `www.lalumapp.com`. Cloudflare wires the DNS automatically.
5. Optional live backend: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as
   Pages environment variables, then redeploy.

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

## Custom domain: lalumapp.com

The app's domain is `lalumapp.com` (register it at any registrar first).

1. Deploy to the chosen host and confirm the app works on its default URL.
2. Add `lalumapp.com` (and `www.lalumapp.com`) in the host's domain settings.
3. Point DNS at the host. Typical records (the host shows the exact values):
   - Root `lalumapp.com`: an `A` / `ALIAS` / `ANAME` record to the host's target.
   - `www.lalumapp.com`: a `CNAME` to the host's target, or a redirect to the root.
4. HTTPS is issued automatically by the host once DNS resolves.

The app is served at the domain root, so no build config changes are needed for
this domain.

## SEO

`index.html` sets the canonical URL and Open Graph tags to `https://lalumapp.com/`.
`public/robots.txt` and `public/sitemap.xml` reference the same domain and are
served from the site root after build. If the final domain ever changes, update
those three files.

# LALUM production infrastructure (lalumapp.com)

Reference for wiring the production stack: Cloudflare (DNS, TLS), Supabase
(database, auth, Edge Functions), Resend (transactional email), and Calendly
(embedded scheduling). Every backend object is LALUM owned; nothing here touches
another application.

## Topology

| Hostname | Purpose | Cloudflare proxy |
| --- | --- | --- |
| `lalumapp.com`, `www.lalumapp.com` | The app (Cloudflare Pages) | Proxied (orange) |
| `api.lalumapp.com` | Supabase REST, Auth, Functions (custom domain) | DNS only (grey) |
| `send.lalumapp.com` | Resend return-path and SPF | DNS only (grey) |

Rule of thumb: proxy the app, never proxy Supabase or mail hosts.

---

## 1. DNS configuration cheatsheet (Cloudflare)

### 1a. The app on Cloudflare Pages

When you add `lalumapp.com` and `www.lalumapp.com` as custom domains inside the
Pages project, Cloudflare creates and manages the required records for you. You
do not add them by hand. Confirm afterwards that both resolve and are proxied.

### 1b. Supabase custom domain (`api.lalumapp.com`)

Supabase issues the exact verification tokens; add precisely what the CLI prints.

```
# one time, from lalum-app/
supabase domains create   --project-ref <REF> --custom-hostname api.lalumapp.com
supabase domains get      --project-ref <REF>   # prints the records to add
# add them in Cloudflare, then:
supabase domains reverify --project-ref <REF>
supabase domains activate --project-ref <REF>
```

Record shape (values come from `supabase domains get`):

| Type | Name | Value | Proxy | TTL |
| --- | --- | --- | --- | --- |
| CNAME | `api` | `<REF>.supabase.co` | DNS only | Auto |
| TXT | `_cf-custom-hostname.api` | `<verification token>` | DNS only | Auto |
| TXT | `api` (or `_acme-challenge.api`) | `<validation token>` | DNS only | Auto |

The CNAME MUST stay grey cloud (DNS only). Supabase provisions the certificate;
proxying it through your own Cloudflare double proxies TLS and breaks SNI.

After activation, in Supabase, Authentication, URL Configuration:

- Site URL: `https://lalumapp.com`
- Redirect URLs: `https://lalumapp.com/**`, `https://www.lalumapp.com/**`

### 1c. Email (Resend, on the `send` subdomain)

Add the domain `lalumapp.com` in Resend; it prints values for these records:

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| MX | `send` | `feedback-smtp.<region>.amazonses.com` (priority 10) | DNS only |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | DNS only |
| TXT | `resend._domainkey` | `p=<DKIM public key from Resend>` | DNS only |

Using the `send` subdomain for the return-path keeps the root `MX` free, so
Cloudflare Email Routing or Google Workspace can still receive mail at
`@lalumapp.com`.

### 1d. Cloudflare SSL/TLS settings (avoid redirect loops)

In the Cloudflare dashboard, SSL/TLS:

- Encryption mode: **Full (strict)**. Never Flexible. Flexible terminates TLS at
  the edge and talks HTTP to an origin that itself forces HTTPS, which produces
  an infinite redirect (`ERR_TOO_MANY_REDIRECTS`).
- Edge Certificates: Always Use HTTPS on, Automatic HTTPS Rewrites on, Minimum
  TLS 1.2.

Because `api.lalumapp.com` is DNS only, it is not affected by the app's proxy
settings; Supabase serves its own valid certificate on that hostname.

---

## 2. Supabase client with the custom domain

The client is env driven. In production, `VITE_SUPABASE_URL` points at the custom
domain. The anon key is public by design and is protected by Row Level Security.

`.env.local` (Vite):

```
VITE_SUPABASE_URL=https://api.lalumapp.com
VITE_SUPABASE_ANON_KEY=<anon public key>
```

This app already initializes a single client in `src/lib/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;
```

Next.js equivalent (browser client), for reference:

```ts
// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,       // https://api.lalumapp.com
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

Server side (Route Handler, Server Action, or Edge Function) with the service
role key. Never ship the service role key to the browser:

```ts
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,               // https://api.lalumapp.com
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // secret, server only
    { auth: { persistSession: false } },
  );
}
```

---

## 3. Email sender authentication (SPF, DKIM, DMARC)

Goal: mail from `no-reply@lalumapp.com` and `assistant@lalumapp.com` passes
authentication and aligns to `lalumapp.com`, so it lands in the inbox.

**SPF** (one TXT per host; never publish two SPF records on the same name):

```
Name:  send
Type:  TXT
Value: v=spf1 include:amazonses.com ~all
```

If you also send from the root through Google Workspace, publish a single
combined record on the root instead of two:

```
Name:  @
Type:  TXT
Value: v=spf1 include:_spf.google.com include:amazonses.com ~all
```

**DKIM** (Resend selector; use the exact key Resend gives you):

```
Name:  resend._domainkey
Type:  TXT
Value: p=<DKIM public key>
```

Google Workspace uses a different selector (`google._domainkey`), so the two
coexist without conflict.

**DMARC** (start in monitor mode, then tighten):

```
Name:  _dmarc
Type:  TXT
Value: v=DMARC1; p=none; rua=mailto:dmarc@lalumapp.com; adkim=s; aspf=r; fo=1
```

Roll out: `p=none` for one to two weeks while you read the `rua` reports, then
`p=quarantine`, then `p=reject` once SPF and DKIM pass and align on all streams.
DKIM alignment is what carries DMARC here: Resend signs with
`resend._domainkey.lalumapp.com`, which aligns to the `From` domain.

The `lalum-notify` Edge Function (see `supabase/functions/lalum-notify/`) sends
through Resend with `From: LALUM <no-reply@lalumapp.com>`. Secrets:

```
supabase secrets set RESEND_API_KEY=...
supabase secrets set LALUM_FROM_EMAIL="LALUM <no-reply@lalumapp.com>"
supabase secrets set LALUM_NOTIFY_TO="avraham@lalum.co"
supabase secrets set LALUM_REPLY_TO="avraham@lalum.co"
supabase functions deploy lalum-notify
```

### Receiving mail

The firm receives at `avraham@lalum.co` on the existing `lalum.co` domain, so
`lalumapp.com` does not need to receive any mail. Two consequences:

- Outbound mail sends `From: no-reply@lalumapp.com` with `Reply-To:
  avraham@lalum.co`, so a client reply reaches the existing inbox. The firm
  notification uses the client address as its `Reply-To`, so the firm can reply
  straight back to the client. The `lalum-notify` function already does this.
- Since `lalumapp.com` accepts no inbound mail, publish a null MX (RFC 7505) on
  the root for hygiene. It does not conflict with the `send` subdomain records.

```
Name: @   Type: MX   Value: .   Priority: 0
```

If you would rather receive at an address on `lalumapp.com` too, enable
Cloudflare Email Routing (which sets the root MX to Cloudflare) and forward to
`avraham@lalum.co`; in that case drop the null MX above.

---

## 4. Embedded scheduling (Zoho Bookings, free)

The portal embeds the scheduling provider inline (as an iframe) so the client
never leaves `lalumapp.com`. It is wired behind `VITE_SCHEDULING_URL`: set it
and the embed replaces the built-in picker; leave it empty and the built-in
picker (a manual request form, see `Book.tsx`) stays.

```
VITE_SCHEDULING_URL=https://<yourzone>.zoho.com/bookings/<service-link>
```

Per-meeting-type links (Zoom / Teams / phone / in-person) live in
`src/lib/content.ts` (`meetingTypes`), each pointing at its own Zoho Bookings
service link. A blank `url` there falls back to `bookingBaseUrl` /
`VITE_SCHEDULING_URL`; if both are blank, `Book.tsx` shows the manual request
form instead of embedding a dead link.

We switched from Calendly to **Zoho Bookings** because its free, single-user
plan includes unlimited calendar connections (including two-way Outlook /
Microsoft 365 sync), unlimited service types, and an embeddable booking page,
at no cost. Setmore is a solid free alternative if the firm ever needs more
than one staff member on the free tier.

Setup (in the Zoho Bookings dashboard, not in this repo):
1. Create a free account at zoho.com/bookings.
2. Settings → Integrations → Calendar Sync: connect the firm's Outlook /
   Office 365 calendar, two-way sync.
3. Services: create one service per meeting format (Zoom, Microsoft Teams,
   Phone Call, In-Person Meeting), each with its own duration.
4. Per service, use Share / Embed to get its booking URL, and paste it into
   the matching `meetingTypes` entry in `content.ts`.

Component: `src/components/SchedulingEmbed.tsx`. It renders a plain iframe, so
it works with any provider that allows iframe embedding, not just Zoho, no
component change needed if the provider changes again later.

```tsx
import { SchedulingEmbed } from "./components/SchedulingEmbed";

<SchedulingEmbed
  url={import.meta.env.VITE_SCHEDULING_URL!}
  prefill={{ name: "Client name", email: "client@company.com" }}
  onScheduled={() => {/* best-effort: fires only if the provider postMessages a booking-confirmed event */}}
/>
```

Note: `onScheduled` listens broadly for a postMessage event whose `event`
field looks booking-related. This was Calendly's documented contract
(`calendly.event_scheduled`); Zoho Bookings' exact event name has not been
verified here, so treat the callback as best-effort. The visitor still always
gets a confirmation directly from Zoho Bookings by email regardless.

---

## Environment variable matrix

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Pages (build) | Supabase URL, e.g. `https://api.lalumapp.com` |
| `VITE_SUPABASE_ANON_KEY` | Pages (build) | Public anon key (RLS protected) |
| `VITE_SCHEDULING_URL` | Pages (build) | Optional scheduling link (Zoho Bookings) for the portal embed |
| `SUPABASE_URL` | Edge Functions | Same URL, server side |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Service role, secret |
| `ANTHROPIC_API_KEY` | Edge Functions | `lalum-assistant` chat |
| `RESEND_API_KEY` | Edge Functions | `lalum-notify` email |
| `LALUM_FROM_EMAIL` | Edge Functions | e.g. `LALUM <no-reply@lalumapp.com>` |
| `LALUM_NOTIFY_TO` | Edge Functions | Firm inbox for new requests (`avraham@lalum.co`) |
| `LALUM_REPLY_TO` | Edge Functions | Reply-To on client mail (`avraham@lalum.co`) |

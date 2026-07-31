# Next.js app scaffold

This directory documents the production Next.js app boundary for APEX Scanner v2.

- `(marketing)` — landing and pricing pages
- `(auth)` — sign-in, sign-up, callback, and account flows
- `dashboard` — authenticated customer dashboard
- `scanner` — scanner results and explanation panels
- `watchlists` — user-managed symbols
- `alerts` — alert rules and delivery history
- `billing` — Stripe Checkout and billing portal entry points
- `api` — short authenticated API requests and webhooks

Keep long-running market-wide scans out of Vercel request handlers. Trigger durable jobs through `api/inngest` or a dedicated worker.

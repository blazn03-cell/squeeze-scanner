# APEX Scanner v2 Setup Guide

## Prerequisites

- Node.js 20+
- npm 8+
- A Vercel account for the customer-facing web app
- Written commercial market-data rights before enabling any real provider adapter

## Current MVP mode

The scanner runs with mocked market data by default. This is intentional: validate indicator math, scoring, confidence, snapshots, and explanations before connecting paid vendor feeds.

```bash
npm install
npm run scan
npm test
```

Optional symbol list:

```bash
APEX_SYMBOLS=NVDA,MSFT,SPY npm run scan
```

The worker writes immutable JSON snapshots to `data/snapshots/` and prints separated `score`, `confidence`, and `state` fields.

## Vercel deployment

Deploy the customer-facing static MVP page to Vercel. Do not run continuous market-wide scanning in Vercel Functions.

1. Import the repository into Vercel.
2. Keep `vercel.json` pointed at `index.html` for the static MVP page.
3. Add only server-side secrets when backend API routes are introduced. Never expose vendor keys through browser code or `NEXT_PUBLIC_*` variables.
4. Use the Vercel app for landing pages, auth, dashboards, watchlists, billing, alerts, admin controls, and short authenticated API requests.

## Worker deployment path

- For 25–100 symbols every few minutes: add Inngest to a Next.js app and run scans as durable jobs with concurrency limits, retries, idempotency, caching, and provider rate-limit handling.
- For continuous full-market WebSocket ingestion: run a dedicated worker on long-running compute outside Vercel Functions.

## Provider activation checklist

Adapters for Massive and FlashAlpha are intentionally disabled.

Before enabling a real adapter:

1. Confirm the provider's written agreement covers commercial display, redistribution, and derived scanner signals.
2. Keep provider keys server-side only.
3. Add rate-limit handling and provider-health monitoring.
4. Store provider, market timestamp, processing timestamp, indicator version, score-engine version, data freshness, explanations, and warnings for every result.
5. Label delayed data clearly in the UI.

## Storage plan

| Storage | Use |
| --- | --- |
| PostgreSQL | Users, plans, watchlists, alerts, snapshots, audit records |
| Redis | Current quotes, rate limits, scan locks, temporary results |
| Object storage | Historical exports and large backtesting files |

On Vercel, use Marketplace database/cache providers: Vercel Postgres is no longer first-party and existing databases were migrated to Neon through the Vercel Marketplace in December 2024; Vercel KV is no longer first-party and existing stores were migrated to Upstash Redis through the Vercel Marketplace in December 2024. Vercel Blob remains first-party for exports and large files.

## Billing and access control

Stripe subscriptions must be controlled through verified, idempotent webhooks, not the checkout success page. Add database ownership policies before exposing customer data. If Supabase is used, enable row-level security on every exposed user table.

## Legal and product safety

- Never promise guaranteed profits.
- Display timestamps and delayed-data labels.
- Publish terms, privacy policy, refund policy, and market-data disclosures.
- Have an attorney review whether rankings, alerts, and language could be interpreted as personalized investment advice.

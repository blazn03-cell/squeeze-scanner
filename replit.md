# APEX Scanner v2 MVP

This repository is no longer a browser-only scanner that accepts vendor keys in the UI. The MVP keeps market-data credentials server-side and runs mocked scans until commercial data agreements are confirmed.

## Architecture

- Static Vercel-facing page in `index.html` for the MVP landing surface.
- Node.js scanning worker entry point in `index.js`.
- Domain logic under `src/domain/`.
- Provider adapters under `src/infrastructure/providers/`.
- Mock provider enabled by default; Massive and FlashAlpha adapters intentionally throw until written commercial rights are confirmed.

## Running

```bash
npm run scan
npm test
```

Optional symbols:

```bash
APEX_SYMBOLS=NVDA,MSFT,SPY npm run scan
```

## Notes

- Do not put vendor keys in browser code or `NEXT_PUBLIC_*` variables.
- Vercel should host the website and short API routes; continuous full-market scanning belongs on a durable job or long-running worker platform.
- For 25–100 symbols every few minutes, use Inngest with bounded concurrency, retries, caching, and rate-limit handling.
- SmartFlow Proxy is not institutional order-flow data and must not be marketed as such.

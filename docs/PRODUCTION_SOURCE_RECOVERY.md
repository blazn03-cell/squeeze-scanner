# WallStreetHustler Production Source Recovery

## Problem

The Vercel production deployment currently serving WallStreetHustler is materially newer than GitHub `main`.

Verified production deployment: `dpl_67j3PfDuop9xJKqhLZm5VUPVXpTD`.

Production build evidence:
- Vercel CLI / Codex deployment, not a GitHub deployment.
- 214 deployment files downloaded during build.
- build cache approximately 22.43 MB.
- live static shell includes `scanner.html`, `app.js`, `scanner-safe.js`, `dashboard.js`, many additional pages/styles, and a large serverless API surface.

Current GitHub feature previews build from the much smaller repository state and use approximately a 1.20 MB build cache.

Promoting GitHub `main` or PR #13 directly to production can therefore remove current functionality.

## Hard safety rule

**Do not promote, alias, or deploy GitHub `main`/PR #13 over the current production domains until the production source has been synchronized into version control and compared.**

The low-float engine may continue to build in preview safely.

## Recoverable directly from the current deployment

The browser-served static shell can be recovered because Vercel still serves the exact production assets. The production service worker identifies the shell as `wsh-static-v52` and lists the pages, JS, CSS, manifest, icons, and images that make up the current frontend.

Key live assets include:
- `scanner.html`
- `app.js`
- `scanner-safe.js`
- `dashboard.js`
- `app.css`
- `apex.css`
- `data-coverage.html`
- `day-trading.html`
- `watchlist.html`
- `history.html`
- the rest of the `wsh-static-v52` shell.

These can be copied byte-for-byte into a recovery branch and compared before any production switch.

## Not recoverable from public deployment responses

Vercel serverless function **source code** is not exposed by normal HTTP responses. Current production APIs such as `/api/buylist`, `/api/options-data`, `/api/mover-news`, `/api/apex-convexity`, `/api/catalysts`, and `/api/news` are functioning, but their implementation source cannot be reconstructed safely from their JSON output alone.

Do not reverse-engineer those endpoints by guessing business logic from responses.

## Safe bridge architecture

Until the CLI-deployed API source is recovered from the machine/workspace that created it, use this migration order:

1. Freeze the current production deployment ID as the known-good backend reference.
2. Recover the served frontend assets into a dedicated source-control branch.
3. Compare recovered frontend against GitHub and preserve all current routes/features.
4. Add the Low-Float Momentum Ignition V2 code only to that recovered source.
5. Keep current production API endpoints untouched during the first integration.
6. Connect verified low-float inputs only where data contracts are known: public float, intraday/pre-market bars, catalyst/SEC data, short/borrow data, and option-chain fields.
7. Deploy to a **preview only** and verify scanner, auth, dashboard, watchlist, alerts, existing APIs, mobile shell, and service worker.
8. Promote only after parity checks pass.
9. After the original CLI serverless source is recovered, commit it and remove any temporary dependency on the frozen production deployment.

## Production parity gate

Before promotion, all of these must pass:
- home page and auth load
- scanner loads without JS errors
- `/api/buylist` parity
- `/api/mover-news` parity
- `/api/options-data` parity where authorized
- `/api/apex-convexity` parity
- dashboard/watchlist/history routes work
- Simple/Advanced mode survives
- PWA/service worker installs and updates
- alerts do not fire on `EXTENDED`
- missing low-float inputs remain labeled missing
- no fake probability is shown
- current production domains are not changed until preview verification passes.

## Probability rule

The new scanner uses `priorityScore` and `proximityScore` for immediate ranking. A field may be labeled **probability** only after the empirical calibration module has enough timestamped forward outcomes for the relevant score bucket. Until then the UI must display ranking/confidence, not a win percentage.

# WallstreetHustler / Squeeze Scanner

An educational **options-candidate research** dashboard plus a separately tested
Thinkorswim underlying-stock scanner package.

The beginner view includes daily candlestick charts, volume, support and resistance,
plain-English pattern lessons, an educational study zone, and a safety/invalidation
line. These are learning aids, not guaranteed entries or personalized trade advice.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:10000`. Verify the backend at
`http://localhost:10000/api/health`; it should return `{ "ok": true }`.

A missing data key prints a warning but does not crash the server. Environment
variables and provider choices are explained in `.env.example` and `docs/DATA_SETUP.md`.

## Deploy on Render

Use the included root `render.yaml` Blueprint; it points Render at `apex-v4`
automatically. For a manually created Web Service, set **Root Directory** to
`apex-v4`. Render supplies `PORT` automatically. Follow the beginner walkthrough
in [docs/RENDER_DEPLOY.md](docs/RENDER_DEPLOY.md).

## Important scope

- The daily-bar engine ranks the **underlying stock**. It does not select or validate an option contract.
- Price and volume can label a generic squeeze/flush proxy. A gamma-flush label requires recent ask-side put flow, short-gamma GEX, and falling price from the optional licensed feed; candles alone never claim gamma positioning.
- When qualifying flow agrees with direction, the beginner view repeats the observed call or put strike as a research reference and converts the user's loss limit into a maximum premium/ask ceiling. It still lacks live option bid/ask, delta, IV, volume, and open-interest validation.
- Selling puts is shown only as a cash-secured or defined-risk lesson around chart support. The app does not submit short-option orders or approve naked short puts.
- Every surfaced stock must be at least $10 with at least $25M estimated average daily dollar volume.
- A live stock spread at or below 0.25% is marked `TIGHT`; missing quotes are marked `CHECK`, never assumed liquid.
- An options-flow row is shown only when the optional licensed feed supplies it.
- A score is a technical ranking, not a probability of profit or a win rate.
- No component places orders or connects to Robinhood. The Robinhood MCP is intentionally excluded.
- Public status is **beta / paper-trading only**. Historical confidence intervals in the current evidence package include zero, so profitability is not demonstrated.

See [docs/OPTIONS_TRADING_SCOPE.md](docs/OPTIONS_TRADING_SCOPE.md) and [docs/RELEASE_STATUS.md](docs/RELEASE_STATUS.md) before testing or publishing.

## Local checks

```bash
npm test
npm run check:release
```

## Market-data configuration

The browser never receives a provider key. Configure server-side bars and quote providers in the hosting environment as described in [docs/DATA_SETUP.md](docs/DATA_SETUP.md). If none is configured, `/api/bars` or `/api/quotes` fails visibly; the interface must not describe missing data as “no qualifying setups.”

The V4 table also replays historical daily bars to audit objective three-session squeeze/flush moves. Those labels measure price and volume, not proof of short covering, and they do not include historical NBBO spreads.

## Thinkorswim evidence package

The audited package is stored under `evidence/thinkorswim/`. Only files inside its `install_current` directory are install candidates. Experimental and reference-only files are not presented as live-verified.

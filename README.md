# WallstreetHustler / Squeeze Scanner

An educational **options-candidate research** dashboard plus a separately tested
Thinkorswim underlying-stock scanner package.

## Important scope

- The daily-bar engine ranks the **underlying stock**. It does not select or validate an option contract.
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

The browser never receives a provider key. Configure one server-side provider in Vercel as described in [docs/DATA_SETUP.md](docs/DATA_SETUP.md). If none is configured, `/api/bars` fails visibly with `NO_PROVIDER_CONFIGURED`; the interface must not describe that condition as “no qualifying setups.”

## Thinkorswim evidence package

The audited package is stored under `evidence/thinkorswim/`. Only files inside its `install_current` directory are install candidates. Experimental and reference-only files are not presented as live-verified.

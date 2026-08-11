# Technical Specification

## Difficulty

Medium. The repository had reusable market-data API handlers and a complete single-page scanner, but no long-running HTTP entry point for Render. The chart feature also needed to remain educational and avoid representing a computed area as a guaranteed trade entry.

## Technical context

- Node.js 20 with ES modules.
- Static React application compiled in the browser by Babel from `index.html`.
- Provider-neutral `/api/bars` and `/api/quotes` handlers.
- Node's built-in test runner.
- Render web-service deployment.

## Implementation approach

1. Add a dependency-free Node HTTP server that serves the app and adapts the existing API handlers.
2. Add `/api/health` returning an HTTP 200 JSON response with `ok: true`.
3. Read `PORT` from the environment, default locally to 10000, and warn rather than crash when bars or quote credentials are absent.
4. Add a Render Blueprint with build, start, health-check, Node-version, and secret-key configuration.
5. Analyze retained daily candles for simple chart shapes and render candles, volume, support, resistance, a study zone, and an invalidation line.
6. Label downside ideas as learn-only for beginners and state that all patterns are educational clues rather than predictions or personalized advice.

## Source changes

- `backend/server.js`: Render-compatible HTTP server and health endpoint.
- `render.yaml`: one-click Render service definition.
- `package.json`: `start` and `dev` scripts.
- `index.html`: chart analyzer, SVG chart, lessons, and result-card controls.
- `test/client-engine.test.js`: chart-analysis tests.
- `.env.example`: local server variables and provider placeholders.
- `README.md`, `docs/DATA_SETUP.md`, `docs/RENDER_DEPLOY.md`: local and deployment runbooks.
- `api/bars.js`: provider-credit and host-neutral configuration wording corrections.

## API and interface changes

- `GET /api/health` returns `{ ok: true, service, time }`.
- `GET /api/bars` and `GET /api/quotes` are available from the persistent Node server as well as serverless hosts.
- Scanner candidate cards can expand an educational chart and plain-language pattern guide.

## Verification

- Run `npm install`.
- Run `npm test`.
- Run `npm run check:release`.
- Parse the Babel JSX source with `@babel/parser`.
- Run `node --check` for server and API modules.
- Start the server and verify `/`, `/api/health`, and the no-provider behavior of `/api/bars`.
- Run `git diff --check`.

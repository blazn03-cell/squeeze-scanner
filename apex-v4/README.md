# APEX V4

## Run locally

```bash
npm install
npm start
```

The local server uses `http://localhost:3000`. Copy `.env.example` to `.env` and add `TWELVEDATA_API_KEY` to enable scans. Without a key, the frontend and `/api/health` still run and scan routes return setup help instead of crashing.

## Health check

```text
GET /api/health
```

`dataConfigured` is `true` when the Twelve Data key is present.

## Render

The repository's root `render.yaml` deploys this folder. See `docs/RENDER_DEPLOY.md` for Blueprint, manual, and custom-domain steps.

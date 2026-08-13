# APEX V4 on Render

## Current production state (2026-08-13)

- Render service: `squeeze-scanner-apex-v4`
- Canonical domain: `https://wallstreethustler.com`
- Render fallback: `https://squeeze-scanner-apex-v4.onrender.com`
- Health endpoint: `/api/health`
- Git branch: `main`, auto-deploy enabled
- Vercel no longer serves the production alias. It remains the registrar and DNS
  provider for the domain.

The DNS records are:

```text
@    A       216.24.57.1
www  CNAME   squeeze-scanner-apex-v4.onrender.com
```

Do not restore a Vercel project alias or its default apex record unless intentionally
rolling back hosting.

The migration is complete. Buying or registering the domain through Vercel does not
lock hosting to Vercel; Vercel nameservers can continue serving the Render records.

## Easiest setup: Blueprint

1. Open [Render](https://dashboard.render.com/).
2. Click **New +**, then **Blueprint**.
3. Connect the GitHub `squeeze-scanner` repository.
4. Select the root `render.yaml` file when prompted.
5. Enter `TWELVEDATA_API_KEY` when Render asks for it.
6. Click **Apply** and wait for the green **Live** label.

The Blueprint already sets:

- Root directory: `apex-v4`
- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/api/health`
- Instance: Free
- Twelve Data free-tier budget: 8 credits per minute

Do not add `PORT`. Render injects it automatically and `apex-v4/backend/server.js` reads it. Setting `PORT=10000` is harmless but unnecessary.

## Manual Web Service setup

If you choose **New + → Web Service** instead of Blueprint, use:

| Field | Value |
|---|---|
| Root Directory | `apex-v4` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

Add these environment variables:

```text
TWELVEDATA_API_KEY=your private key
CREDITS_PER_MINUTE=8
DECISION_LOG=false
```

## Verify before moving the domain

Open the Render URL first:

```text
https://YOUR-APP.onrender.com/api/health
```

Expected result after adding the key:

```json
{"ok":true,"service":"apex-v4","dataConfigured":true}
```

Then open the normal Render URL and run a scan. A free Twelve Data key loads a limited number of symbols per minute, so a full scan takes longer.

## Domain migration/rollback procedure

1. Verify the `onrender.com` URL and `/api/health` first.
2. Verify the apex and `www` domains in Render and wait for both TLS certificates.
3. Confirm the root A and `www` CNAME records shown above.
4. Confirm the production health response identifies `apex-v4`.
5. Keep the Render subdomain enabled as an emergency diagnostic path.
6. For rollback only, restore the prior hosting records and re-add a project alias;
   do not run two competing apex records simultaneously.

The domain can remain registered and billed through Vercel even when its DNS points to Render.

## Keep the key safe

- Put keys only in Render's **Environment** page.
- Never paste a key into GitHub, source code, screenshots, or chat.
- If a key is exposed, revoke it and create a new one.

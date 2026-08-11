# Put APEX V4 on Render

The existing `wallstreethustler.com` site is live on Vercel. Keep it there while the new Render service is tested. Buying or registering a domain through Vercel does not lock the domain to Vercel hosting; DNS can point to Render later.

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

## Domain move without downtime

1. Keep `wallstreethustler.com` on Vercel while testing Render.
2. In Render, add `apex.wallstreethustler.com` as a custom domain first.
3. In the Vercel Domains DNS page, add the CNAME value Render displays.
4. Test the scanner at the new `apex` address.
5. Only after it works, add `wallstreethustler.com` in Render and change the root DNS records to the exact values Render displays.
6. Wait for Render's TLS certificate and verify the site before removing the domain from the old Vercel project.

The domain can remain registered and billed through Vercel even when its DNS points to Render.

## Keep the key safe

- Put keys only in Render's **Environment** page.
- Never paste a key into GitHub, source code, screenshots, or chat.
- If a key is exposed, revoke it and create a new one.

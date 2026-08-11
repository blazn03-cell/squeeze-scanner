# Put WallstreetHustler on Render

This project includes `render.yaml`, so Render can fill in the server settings for you.

## Easiest setup

1. Push this repository to GitHub.
2. Open [Render](https://dashboard.render.com/).
3. Click **New +**, then **Blueprint**.
4. Connect the GitHub repository.
5. Leave **Root Directory** blank. There is no `apex-v4` folder in this repository.
6. When Render asks for `TWELVEDATA_API_KEY`, paste the key from your Twelve Data account.
7. Click **Apply** and wait for the green **Live** label.

Render reads these settings from `render.yaml`:

- Build: `npm ci`
- Start: `npm start`
- Health check: `/api/health`
- Node: 20

Do not add `PORT` on Render. Render supplies it automatically, and the server already reads it. Local development defaults to port `10000`.

## Check that it worked

Replace `YOUR-APP` with the name Render gives you:

```text
https://YOUR-APP.onrender.com/api/health
```

You should see:

```json
{"ok":true,"service":"wallstreethustler"}
```

Then open the normal app URL. On Render's free service, the first visit after a quiet period can take longer while the service wakes up.

## What the data key does

`TWELVEDATA_API_KEY` supplies historical daily candles for scores, patterns, and charts. Twelve Data does not provide the two-sided stock bid/ask needed by this app's spread check. Without a separate quote provider, the app correctly says the spread still needs verification instead of guessing.

For live bid/ask, add one supported quote provider from `docs/DATA_SETUP.md`. Alpaca is the simplest single provider for both bars and quotes.

## Keep the key safe

- Put keys only in Render's **Environment** page.
- Never paste a key into `index.html`, GitHub, screenshots, or chat.
- If a key is exposed, revoke it and create a new one.

# Turning the scanner on

The scoring engine needs daily candles. This is the one thing that has to be
configured before the site shows setups, and it takes about five minutes.

## Why there is a server at all

A static page cannot hold an API key. Anything shipped to the browser is readable
by anyone who opens View Source, so a key put in `index.html` is a key you have
given away. `api/bars.js` exists so the key can live on the server, where the
browser can use it without ever seeing it.

That is also the whole reason a visitor now needs no key of their own.

## Step 1 — get a market-data key

Pick **one**. Any of them works; nothing in the code is bound to a vendor.

| Provider | Free tier | Notes |
|---|---|---|
| **twelvedata.com** | 800 requests/day, 8/min | **Start here.** It accepts several symbols in one request, so a full 34-symbol scan costs about 5 requests instead of 34. |
| polygon.io | 5 requests/min | Good data. One symbol per request, so a full scan takes a few minutes to warm the cache. |
| tiingo.com | 1000 requests/day | One symbol per request. |
| alphavantage.co | 25 requests/day | Too small for a real scan. Fine for a smoke test. |

## Step 2 — put the key in Vercel

1. Go to the project → **Settings** → **Environment Variables**.
2. Add one variable, named for the provider you chose:

   | Provider | Variable name |
   |---|---|
   | Twelve Data | `TWELVEDATA_API_KEY` |
   | Polygon | `POLYGON_API_KEY` |
   | Tiingo | `TIINGO_API_KEY` |
   | Alpha Vantage | `ALPHAVANTAGE_API_KEY` |

3. Paste the key as the value. Apply it to **Production**, **Preview** and **Development**.
4. **Redeploy.** Environment variables are read at boot — an existing deployment
   will not pick up a new variable on its own.

Set only one. If several are present the first match in the table above wins.

## Step 3 — check it

Open `https://your-domain/api/bars` directly.

- `{"ok":true,"provider":"twelvedata","returned":34,…}` — done. The site will show
  scores on the next load.
- `{"ok":false,"reason":"NO_PROVIDER_CONFIGURED"}` — the variable is not set, is
  named differently, or the project was not redeployed after adding it.
- `{"ok":false,"reason":"PROVIDER_ERROR","message":"…"}` — the key is set but the
  provider rejected it. The provider's own message is passed through, so read it:
  it is usually an invalid key or a rate limit.

The app shows the same states in words. It never invents rows to cover a failure —
an empty setup list always means *nothing qualified* or *no data*, and it says
which.

## What it costs

The default universe is 34 liquid symbols and the endpoint refreshes every 15
minutes, with a cache in front of it.

On Twelve Data that is roughly **5 requests per refresh**, so about 480 a day
against an 800/day free allowance — with the CDN cache absorbing repeat visitors,
since every visitor shares one cached response rather than triggering their own
fetch. In practice a small site stays inside the free tier. A busy one needs a
paid plan, typically $10–50/month.

To use less: pass a shorter list, e.g. `/api/bars?symbols=SPY,QQQ,AAPL,NVDA`.

## Changing which symbols are scanned

`DEFAULT_UNIVERSE` at the top of `api/bars.js`. Keep them liquid — the liquidity
gate blocks thin names anyway, so adding microcaps mostly spends your rate limit
on rows that will be rejected.

The cap is 40 symbols per request, and symbols are validated against
`^[A-Z][A-Z.\-]{0,6}$` before anything is sent to the provider.

## What this does not do

- No intraday data. Daily bars only, which is what the model is tuned for.
- No options flow. That is still the separate, optional Unusual Whales connection.
- No storage. Bars are fetched, scored in the browser, and forgotten. There is no
  database and no user data.

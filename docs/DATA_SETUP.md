# Turning the scanner on

The scanner uses two separate data contracts:

1. `/api/bars` supplies daily OHLCV history for V4 scoring and the squeeze/flush replay audit.
2. `/api/quotes` supplies current stock bid/ask for the execution-quality gate.

Keys stay in server-side environment variables. They are never shipped in `index.html`.

## Recommended setup: Alpaca

Alpaca is the simplest path because one credential pair can cover multi-symbol daily bars and current quotes.

Set these in Render or your hosting environment and redeploy:

```text
ALPACA_API_KEY_ID=...
ALPACA_API_SECRET_KEY=...
ALPACA_DATA_FEED=iex
```

The free `iex` feed is one exchange, not the consolidated NBBO. Use `sip` only when the account includes SIP data. The interface labels the feed so an IEX quote is never represented as NBBO.

## Historical-bar alternatives

Configure one of these if Alpaca is not used:

| Provider | Environment variable | Default symbol window |
|---|---|---:|
| Twelve Data | `TWELVEDATA_API_KEY` | 8/minute |
| Polygon | `POLYGON_API_KEY` | 5/minute |
| Tiingo | `TIINGO_API_KEY` | 40/minute |
| Alpha Vantage | `ALPHAVANTAGE_API_KEY` | 1/minute |

Twelve Data charges one API credit **per symbol**, including batch requests. Its free plan has eight credits per minute. The browser therefore loads eight symbols, waits 65 seconds, merges the next window, and retains the accumulated daily history locally. Override the window only when the plan supports it:

```text
TWELVEDATA_CREDITS_PER_MINUTE=55
```

Polygon and Alpha Vantage have equivalent window overrides:

```text
POLYGON_SYMBOLS_PER_MINUTE=5
ALPHAVANTAGE_SYMBOLS_PER_MINUTE=1
```

## Quote alternatives

`/api/quotes` tries configured providers in this order:

1. Alpaca (`ALPACA_API_KEY_ID` + `ALPACA_API_SECRET_KEY`)
2. Massive/Polygon (`MASSIVE_API_KEY` or `POLYGON_API_KEY`) when the plan includes stock quotes
3. Tiingo (`TIINGO_API_KEY`)

Twelve Data's `/quote` response has latest price and volume but no two-sided stock bid/ask, so it cannot satisfy the spread gate.

## Verify production

Open these routes directly:

```text
https://wallstreethustler.com/api/bars?cursor=0
https://wallstreethustler.com/api/quotes?symbols=AAPL,MSFT,NVDA
```

Expected bar fields include `attempted`, `returned`, `deferred`, and `nextCursor`. A rate-limited provider may return only one window; that is expected and is shown as partial coverage until subsequent windows merge.

Expected quote rows include `bid`, `ask`, `spreadPct`, `asOf`, `feed`, and `nbbo`. The V4 quality labels mean:

- `TIGHT`: price and dollar-volume gates pass, a two-sided quote exists, and spread is at most 0.25%.
- `CHECK`: price and dollar-volume gates pass, but no usable stock quote reached the site. Verify in thinkorswim.
- `BLOCK`: price below $10, average dollar volume below $25M, liquidity score below 50, stale market-hours quote, or spread above 0.25%.

## Historical audit

The V4 panel scans retained daily bars for objective moves:

- squeeze proxy: at least +12% within three sessions;
- flush proxy: at least -12% within three sessions;
- event volume: at least 1.5 times the prior 20-session average;
- prior price: at least $10;
- prior average dollar volume: at least $25M.

It then replays V4 using only bars available before the move and reports captured versus missed events. This is an outcome audit, not evidence that short covering caused a move. The current universe also creates survivorship bias; point-in-time universe and historical quote data are still required before profitability claims.

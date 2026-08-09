# FINAL_V4 — ThinkorSwim quant column & scanner system

32 ThinkScript files: 18 watchlist columns, 10 Stock Hacker scans, 4 chart studies.

**Read `DOCUMENTATION/PROJECT_AUDIT.md` first.** It contains one finding that changes
how you should read everything else: this repository contained **no ThinkScript at all**
before this branch. What was reverse-engineered is the JavaScript scoring engine that
was already here.

---

## Install order

Do it in this order — later pieces read the earlier ones' numbers.

**1. Columns** (MarketWatch → Quotes → right-click any column header → Customize →
scroll to *Custom Quotes* → **+** → paste → name it → Apply)

| Order | File | Column name to use |
|---|---|---|
| 1 | `WATCHLIST_COLUMNS/V4_APEX_SCORE.ts` | `V4_APEX` |
| 2 | `WATCHLIST_COLUMNS/V4_DIRECTION.ts` | `V4_DIR` |
| 3 | `WATCHLIST_COLUMNS/V4_CONFIDENCE.ts` | `V4_CONF` |
| 4 | `WATCHLIST_COLUMNS/V3_StableScore.ts` | `V3_StableScore` |
| 5 | `WATCHLIST_COLUMNS/V4_Confirmed.ts` | `V4_Confirmed` |
| 6 | `WATCHLIST_COLUMNS/V4_EarlyEntry.ts` | `V4_Early` |
| 7 | `WATCHLIST_COLUMNS/V3_ModelATRpct.ts` | `V3_ModelATRpct` |
| 8 | `WATCHLIST_COLUMNS/RelVol30.ts` | `RelVol30` |
| 9 | `WATCHLIST_COLUMNS/RelVol30Intraday.ts` | `RelVol30Intraday` |
| 10 | `WATCHLIST_COLUMNS/DarvasScan.ts` | `DarvasScan` |
| 11 | `WATCHLIST_COLUMNS/DarvasBias.ts` | `DarvasBias` |
| 12 | `WATCHLIST_COLUMNS/SqueezeHitPct.ts` | `SqueezeHit%` |
| 13 | `WATCHLIST_COLUMNS/SqueezeState.ts` | `SqueezeState` |
| 14 | `WATCHLIST_COLUMNS/SmartFlow.ts` | `SmartFlow` |
| 15 | `WATCHLIST_COLUMNS/BidAskSpread.ts` | `BidAskSpread` |
| 16 | `WATCHLIST_COLUMNS/EarningsRisk.ts` | `Earnings` |
| 17 | `WATCHLIST_COLUMNS/V4_REGIME.ts` | `V4_Regime` |
| 18 | `WATCHLIST_COLUMNS/V4_RelStrength.ts` | `V4_RS` *(optional — slow, see below)* |

**2. Scans** (Scan tab → Stock Hacker → Add Study Filter → wrench → thinkScript Editor →
paste → OK; leave the condition on `plot is true`)

`V4_MASTER_SCAN` is the one to run if you only run one.

**3. Studies** (Charts → Studies → Edit Studies → Create → paste)

`V4_Dashboard` prints every number as an on-chart label, including the regime as a
word. `V4_DarvasBox` and `V4_SqueezeStudy` draw what the scanner is reading.

---

## The two rules that make or break this

**Aggregation must match everywhere.** A column set to Daily and a scan set to 15m will
disagree, and neither is wrong — they are answering different questions. Pick one
timeframe per workflow (Daily for swing, 15m for intraday) and set it on every column
and every scan filter.

**`RelVol30Intraday` needs `barsPerDay` set to match.** 5m → 78, 10m → 39, 15m → 26,
30m → 13, and extended-hours data **off**. Get this wrong and the column reads garbage
rather than blank, which is worse. See the header comment in the file.

---

## Reading a row

```
SYMBOL  APEX  DIR  CONF  STABLE  EARLY  ATR%  RVOL  DARVAS  SQZ  FLOW  SPREAD
GMAB     82   +2    86     74      71   2.55  2.4     +2     78   +64   0.08%
```

- **APEX** — is it tradeable at all? Sort on this.
- **DIR** — which side. `+2` long, `-2` short. A high APEX with `-2` is a high-quality
  **short**, not a buy.
- **CONF** — do the six lenses agree? Low CONF on a high APEX means the signals are
  fighting each other.
- **STABLE** — setup quality on its own terms, direction-agnostic.
- **EARLY** — are you early or late? High APEX + low EARLY = the move already happened.
- **SPREAD** — under 0.25% or skip it.

`DOCUMENTATION/WATCHLIST_LAYOUT.md` has the full interpretation table.

---

## The same engine runs on the web dashboard

`index.html` (the Vercel app) now carries a **JavaScript port of this exact model** —
same buckets, same caps, same penalties, same thresholds — computed from the 5-minute
OHLC bars the Unusual Whales API already returns. Toggle it with the **🧮 V4** button in
the toolbar.

That is deliberate: if ThinkorSwim and the dashboard disagree on a ticker, one of them
is wrong and you need to be able to tell which. Two known-and-intended deviations, both
because the dashboard's input is 5m bars rather than a daily column:

1. Dollar volume is scaled by 78 bars/day to approximate average **daily** dollar volume,
   so the $2M liquidity floor means the same thing in both places.
2. VWAP is rebuilt as a real session VWAP from the bars, rather than TOS's `vwap`.

The dashboard has **no BidAskSpread column** — the UW endpoints in use return no
stock-level quote. Liquidity is shown as approximate average daily dollar volume there,
and the real spread lives in ThinkorSwim where `bid`/`ask` are actually exposed.

---

## What this system will not do

- It does not see dark-pool prints, block trades, gamma exposure, or short interest.
  ThinkScript has no access to any of them. `SmartFlow` is a **price/volume pressure
  proxy** and is documented as such in its own header.
- It does not predict. `SqueezeHit%` grades how well a bar matches the pre-expansion
  template. That is a setup-quality score, not a probability.
- It has not been compiled inside ThinkorSwim by the author. See
  `DOCUMENTATION/TOS_LIMITATIONS.md` for the specific constructs that need your eyes on
  first paste.

---

## Regenerating

The `.ts` files are generated so that the shared module blocks stay **byte-identical**
across all 32 of them — a build-time audit fails if any two copies drift. The generator
and its static-analysis pass live outside the repo (they were scratch tooling, not a
build dependency); the committed `.ts` files are the artefact. Edit them directly, or
ask for the generator back if you want to re-tune the shared modules in one place.
`STUDIES/V4_Core.ts` is the in-ThinkorSwim equivalent of that single source — see
`DOCUMENTATION/TOS_LIMITATIONS.md` for the trade-off.

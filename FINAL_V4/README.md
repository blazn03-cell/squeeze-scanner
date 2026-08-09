# FINAL_V4 — ThinkorSwim quant column & scanner system

36 ThinkScript files: 22 watchlist columns, 10 Stock Hacker scans, 4 chart studies.

**This folder is completely standalone.** Nothing in it calls an API, reads this repo's
JavaScript, or needs the web dashboard. Hand `FINAL_V4/` to anyone with ThinkorSwim and
it works. The dashboard integration described at the bottom is a convenience, not a
dependency.

**Daily is the default and the maximum aggregation.** The parameters are tuned for a
**1-3 day** holding period, stretching to a couple of weeks on the cleanest trends —
which is where squeezes and flushes resolve. Use **4h** if you want the same system to
move faster and accept that it gets jumpier. Anything below 15m is not supported.

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
| 18 | `WATCHLIST_COLUMNS/V4_TIMING.ts` | `V4_Timing` |
| 19 | `WATCHLIST_COLUMNS/V4_EXTENSION.ts` | `V4_Extension` |
| 20 | `WATCHLIST_COLUMNS/V4_LIQUIDITY_SCORE.ts` | `V4_Liquidity` |
| 21 | `WATCHLIST_COLUMNS/V4_DaysToEarnings.ts` | `V4_DaysToEarnings` *(Daily only)* |
| 22 | `WATCHLIST_COLUMNS/V4_RelStrength.ts` | `V4_RS` *(optional — slow, see below)* |

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
timeframe (Daily, or 4h for the faster variant) and set it on every column and every
scan filter.

**`RelVol30Intraday` needs `barsPerDay` set to match.** 5m → 78, 10m → 39, 15m → 26,
30m → 13, and extended-hours data **off**. Get this wrong and the column reads garbage
rather than blank, which is worse. See the header comment in the file.

---

## Reading a row

```
SYMBOL  APEX  DIR  CONF  TIME  STABLE  EARLY  ATR%  RVOL  DARVAS  SQZ  FLOW  EXT   LIQ  SPREAD
GMAB     82   +2    86    +1     74      71   2.55  2.4     +2     78   +64  0.84   93  0.08%
```

- **APEX** — is it tradeable at all? Sort on this.
- **DIR** — which side. `+2` long, `-2` short. A high APEX with `-2` is a high-quality
  **short**, not a buy. `0` means skip, whatever else the row says.
- **CONF** — do the six lenses agree? Low CONF on a high APEX means the signals are
  fighting each other.
- **TIME** — is the move still available? `+2` prime, `-2` exhausted. **A high APEX with
  `-1` or `-2` is a setup you have already missed.**
- **STABLE** — setup quality on its own terms, direction-agnostic.
- **EARLY** — is something *changing* right now? This scores transition, not strength, so
  a stock that has been strong for weeks correctly scores near zero.
- **EXT** — ATR from equilibrium. Above 3.0 APEX is hard-blocked.
- **LIQ** — tradeability 0-100. Below 35 APEX is hard-blocked. Not market depth.
- **SPREAD** — under 0.25% or skip it.

The full decision hierarchy and interpretation tables are in
`DOCUMENTATION/WATCHLIST_LAYOUT.md`.

---

## The architectural boundary

FINAL_V4 is the **technical signal engine** and nothing else. No news, no calendar feed,
no catalyst scoring is implemented in ThinkScript — it cannot reach those sources, and
attempting it would mean fabricating data. That layer lives in the web app and is
specified in `docs/V5_PRODUCT_SPEC.md`.

The one boundary case is `EarningsRisk.ts` / `V4_DaysToEarnings.ts`, which read
ThinkorSwim's own event calendar. That is a scheduled corporate event, not news.

No catalyst score ever modifies APEX, Direction, Confidence or StableScore. The
dimensions stay independent and are fused for display only — see
`docs/CATALYST_ARCHITECTURE.md` for why subtraction destroys information.

## Also in this branch: the Income ETF Lab

Separate discipline, separate tab. The scanner hunts 1-3 day moves; the **💰 INCOME**
tab in the dashboard is about owning option-income ETFs and getting paid monthly —
YieldMax, Kurv, Defiance, Roundhill, NEOS, JPMorgan, REX and cash. It carries a
plain-English explanation of how covered-call income actually works, a card per issuer,
four allocation presets, and a compounding model.

The model's one non-obvious design decision: **NAV drift is a first-class input, not
assumed to be zero.** Most income spreadsheets model distributions against a flat share
price, which flatters high-yield single-stock funds badly, because a large part of some
distributions is return of capital — your own money handed back while the share price
drops to match. Four scenarios (Ignore NAV / Base / Stress / Bear year) let you see the
difference. If a plan only works under "Ignore NAV", it is not a plan.

Every yield and drift figure there is an **editable assumption, not a quote or a
forecast**.

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
stock-level quote. It shows `V4_LIQUIDITY_SCORE` instead, with the approximate average
daily dollar volume in the tooltip. The real spread lives in ThinkorSwim, where
`bid`/`ask` are exposed to custom quotes and nowhere else.

---

## What this system will not do

- It does not see dark-pool prints, block trades, gamma exposure, or short interest.
  ThinkScript has no access to any of them. `SmartFlow` is a **price/volume pressure
  proxy** and is documented as such in its own header.
- It does not predict. `SqueezeHit%` grades how well a bar matches the pre-expansion
  template. That is a setup-quality score, not a probability.
- It does not detect gamma, dealer positioning, or options flow of any kind. No V4
  column makes an options-positioning claim.
- **It has not been compiled inside ThinkorSwim.** Status is
  **STATICALLY VALIDATED — REQUIRES TOS COMPILE TEST**. The 20-point acceptance checklist
  and the ranked list of what to compile-test first are in
  `DOCUMENTATION/TOS_LIMITATIONS.md`.

---

## Regenerating

The `.ts` files are generated so that the shared module blocks stay **byte-identical**
across all 32 of them — a build-time audit fails if any two copies drift. The generator
and its static-analysis pass live outside the repo (they were scratch tooling, not a
build dependency); the committed `.ts` files are the artefact. Edit them directly, or
ask for the generator back if you want to re-tune the shared modules in one place.
`STUDIES/V4_Core.ts` is the in-ThinkorSwim equivalent of that single source — see
`DOCUMENTATION/TOS_LIMITATIONS.md` for the trade-off.

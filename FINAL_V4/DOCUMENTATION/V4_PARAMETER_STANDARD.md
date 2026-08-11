# V4 parameter standard

Canonical defaults. Every script in FINAL_V4 uses these unless its own header
documents a reason to differ. If you re-tune, re-tune **here first**, then apply the
same value everywhere — a column and a scan disagreeing on `boxLength` is the most
common way this system starts producing nonsense.

## Timeframe policy

**Daily is the default and the ceiling.** The parameters below are tuned for it, and
the intended holding period is **1-3 days**, stretching to a couple of weeks on the
cleanest trends. Squeezes and flushes in particular resolve inside that window.

| Aggregation | Use | Holding period |
|---|---|---|
| **Daily** | default, maximum | a few days to a few weeks |
| **4h** | faster variant, jumpier | 1-3 days |
| 15m / 30m | intraday timing only — not for scanning | hours |
| < 15m | not supported; the box and squeeze lengths are meaningless | — |

Do not run a column on Daily and a scan on 4h and expect the numbers to agree. They
are answering different questions and both are right.

## Core lengths

| Parameter | Default | Used by | Why this value |
|---|---|---|---|
| `atrLength` | 14 | everything | Wilder standard. Changing it moves every ATR-normalised threshold in the system. |
| `adxLength` | 14 | trend bucket, DI lens | Wilder standard. |
| `rsiLength` | 14 | momentum bucket, direction lens | Wilder standard. |
| `rvolLength` | 30 | participation, liquidity | 30 daily bars ≈ six trading weeks — long enough to survive one busy week. |
| `trendFastLen` | 8 | EMA stack | ~1.5 trading weeks on Daily. |
| `trendMidLen` | 21 | EMA stack, slope, extension reference | One trading month. The equilibrium everything else is measured against. |
| `trendSlowLen` | 50 | EMA stack | Institutional reference level. |
| `boxLength` | 20 | Darvas box | One trading month of range. Shorter fires constantly; longer misses 1-3 day setups. |
| `sqzLength` | 20 | Bollinger / Keltner / momentum | Standard squeeze length. |
| `bbFactor` | 2.0 | Bollinger width | Standard. |
| `kcFactor` | 1.5 | Keltner width | Standard TTM-style. Raising it makes squeezes rarer. |
| `flowLength` | 20 | SmartFlow / CMF | Matches `sqzLength` so flow and momentum cover the same window. |
| `effLength` | 20 | efficiency ratio | Same window again — deliberate. |

## Thresholds and gates

| Parameter | Default | Meaning |
|---|---|---|
| `minDollarVol` | 2,000,000 | Hard liquidity floor. Below it: ×0.55 on StableScore, 0 liquidity points, every scan rejects. |
| `ATR_Min` (band floor) | 1.0% | Below this, the volatility bucket scores 3/15 — nothing to trade. |
| `ATR_Max` (band ceiling) | 5.0% | Above this the bucket degrades; above 8% it scores 2/15; above 12% a ×0.75 penalty applies. |
| `ADX_TrendMinimum` | 16 / 22 / 30 | 2 / 5 / 7 points in the trend bucket. Below 15 with no squeeze: ×0.85. |
| `Extension_ATR_Limit` | 3.0 | Above this SCORE is hard-blocked to 55. Note the **column's** display bands (0.5 / 1.0 / 1.5 / 2.0) are tighter — those drive Timing, not the block. |
| `Stable_Minimum` | 55 | Acceptable. Also the score gate threshold. |
| `Stable_Strong` | 65 | Strong. Default floor for the ranked scans. |
| `Stable_Elite` | 75 | Very strong. Requires 3+ buckets at 70% of max. |
| `Confidence_Minimum` | 55 | score gate threshold. 60 on the ranked scans. |
| `Score_Minimum` | 70 | Default floor for `V4_LONG` / `SHORT`. 68 on `V4_MASTER`. |
| `Liquidity_Gate` | 50 | Costs a score gate below this. Below **35** SCORE is hard-blocked. |
| `Timing_Minimum` | +1 | Floor for `V4_EARLY_ENTRY_SCAN`. |

## Score caps — the saturation controls

These exist so the top of the range stays rare. Do not remove them to get more hits.

| Cap | Rule |
|---|---|
| Bucket caps | 20 / 15 / 20 / 15 / 15 / 15 — correlated indicators pool inside one bucket and cannot exceed it |
| StableScore elite gate | capped at **74** unless ≥3 buckets reach 70% of their max |
| Score elite gate | capped at **72** unless ≥4 of 6 gates pass |
| Score hard block | capped at **55** if direction is 0, liquidity < 35, or extension > 3.0 ATR |
| Penalty floor | multiplicative penalties floor at **×0.40** — a stack degrades, it never annihilates |
| Confidence neutral cap | capped at **45** whenever direction is 0 |

## signalMode

Every script carries `input signalMode = {default LIVE, CLOSED_BAR};`.

- **LIVE** reads the forming bar. Earlier, but the value changes until the bar closes.
- **CLOSED_BAR** shifts every input series back one bar. One bar later, but final once printed.

LIVE is **not** repaint-proof and is not claimed to be. Nothing that reads a forming bar
can be. Use CLOSED_BAR when you are recording or reviewing signals; LIVE when you are
watching live and accept that a row can appear and vanish before the close.

## When a component's data is missing

Never fabricate. The rules, in order:

1. If the component is **required** (ATR, price, volume) → the whole column returns
   `Double.NaN` and the cell is blank.
2. If the component is **optional** (VWAP on Daily, earnings calendar on an ADR) → it
   contributes **0**, and where it is one of several lenses the denominator shrinks with
   it, so the remaining lenses are re-normalised rather than diluted. This is why
   confidence tops out near 96 on Daily instead of 100.
3. A blank cell means *unknown*, not *safe*. `V4_DaysToEarnings` blank does not mean no
   earnings — it means the calendar had nothing for that symbol.

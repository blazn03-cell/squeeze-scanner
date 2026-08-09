# Dependency matrix

What each output actually consumes. Use it to spot duplication: if two columns draw on
the same inputs and you treat them as independent confirmation, you are double-counting.

## Outputs × subsystems

| Output | Trend | Volume | ATR | Darvas | Squeeze | Flow | Liquidity | VWAP | RSI/ADX |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `V3_ModelATRpct` | | | X | | | | | | |
| `RelVol30` | | X | | | | | | | |
| `RelVol30Intraday` | | X | | | | | | | |
| `DarvasScan` | | X | X | X | | | | | |
| `DarvasBias` | X | | X | X | | | | | |
| `SqueezeHitPct` | | X | X | | X | | | | |
| `SqueezeState` | | | X | | X | | | | |
| `SmartFlow` | | X | X | | | X | | X | |
| `V4_EXTENSION` | X | | X | | | | | X | |
| `V4_LIQUIDITY_SCORE` | | X | | | | | X | | |
| `V3_StableScore` | X | X | X | X | X | X | X | | X |
| `V4_DIRECTION` | X | | X | X | X | X | | X | X |
| `V4_CONFIDENCE` | X | | X | X | X | X | | X | X |
| `V4_TIMING` | X | X | X | X | X | | | X | X |
| `V4_EarlyEntry` | X | X | X | X | X | | | X | X |
| `V4_REGIME` | X | | X | X | X | X | | | X |
| `V4_Confirmed` | X | X | X | X | X | X | X | X | X |
| `V4_APEX_SCORE` | X | X | X | X | X | X | X | X | X |
| `EarningsRisk` | | | | | | | | | |
| `V4_DaysToEarnings` | | | | | | | | | |
| `BidAskSpread` | | | | | | | | | |
| `V4_RelStrength` | | | | | | | | | |

The bottom four are the only fully independent columns in the system. That is exactly
why they are useful as tiebreakers — nothing else in the matrix knows what they know.

## Where correlation is controlled, and how

| Overlap | Risk | Control |
|---|---|---|
| EMA stack + ADX + slope | all measure "is it trending" | pooled in one bucket, **capped at 20** |
| RSI + squeeze momentum + efficiency ratio | all measure "is it moving cleanly" | pooled, **capped at 15** |
| RelVol + volume trend + CMF magnitude | all measure participation | pooled, **capped at 20** |
| ATR% band + ATR stability | both volatility | pooled, **capped at 15** |
| StableScore inside APEX | would re-add all six buckets | APEX takes StableScore **once** at 0.55 and adds only what StableScore does not contain |
| `V4_EXTENSION` inside Timing and EarlyEntry | same input, two consumers | intentional and different: Timing uses **bands**, EarlyEntry uses it as a **penalty** |
| `V4_LIQUIDITY_SCORE` and the `minDollarVol` floor | both liquidity | the floor is a hard gate, the score is a ranking — the floor runs first |

## Known residual overlaps, accepted

**1. CMF appears twice.** It contributes up to 4 of the 20 participation points inside
StableScore, and it drives SmartFlow. Since APEX takes 0.55 × StableScore plus
0.20 × |SmartFlow|, effective overlap is ≈ 2.2% of APEX. Kept because removing it would
leave the participation bucket with nothing but volume magnitude.

**2. Dollar volume appears twice.** It is the liquidity bucket in StableScore (15 pts)
and the largest term in `V4_LIQUIDITY_SCORE` (45 pts), and both feed APEX. This is
deliberate — liquidity is the one factor allowed to be over-weighted, because an
illiquid setup is not a setup regardless of how good it looks.

**3. ATR is everywhere.** It normalises extension, slope, box distance and the Keltner
channel. This is a *scaling* dependency rather than a signal dependency: ATR does not
push any score up or down on its own, it makes the others comparable across symbols.
The one place ATR is a genuine signal is the volatility bucket, where it appears once.

## Confirmation categories in `V4_Confirmed` — independence check

`V4_Confirmed` counts seven categories. They must be genuinely separable or the count
inflates:

| Category | Primary input | Independent of the others? |
|---|---|---|
| Trend | EMA stack + ADX | shares ADX with nothing else in the count |
| Momentum | squeeze momentum + RSI | shares squeeze momentum with the Squeeze category — **partial overlap** |
| Volume | RelVol | yes |
| Volatility | ATR% band | yes |
| Structure | DarvasScan | yes |
| Flow | SmartFlow | shares volume with the Volume category — **partial overlap** |
| Squeeze | squeeze state | shares momentum with the Momentum category — **partial overlap** |

Three of seven categories carry partial overlap, so a count of 7/7 is worth roughly 5-6
truly independent confirmations. The thresholds account for this: level 4 (APEX) needs
6 of 7 **and** StableScore ≥ 75 **and** Confidence ≥ 70, so the count alone can never
produce the top level.

**Relative strength is deliberately excluded** from the count. It would be a genuinely
independent eighth category, but it requires loading a second symbol per row, which
roughly doubles watchlist cost. It lives in `V4_RelStrength.ts` as an optional column
instead.

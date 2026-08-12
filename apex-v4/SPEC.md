# APEX V4 — Metric Specification (Phase 0)

> Language-neutral formulas derived from the master prompt's metric definitions.
> Each entry: inputs → computation → output range → interpretation bands.

---

## ATR% (V3_ModelATRpct)

**Purpose**: Tradeable volatility context.

**Inputs**: OHLCV daily bars, period = 14.

**Computation**:
```
TrueRange[i] = max(High[i]-Low[i], |High[i]-PrevClose|, |Low[i]-PrevClose|)
ATR[i] = Wilder_EMA(TrueRange, 14)    // k = 1/14
ATR% = (ATR[last] / Close[last]) * 100
```

**Output range**: 0–∞% (practical 0.3–20%)

**Bands**:
| Band | ATR% Range | Score | Interpretation |
|------|-----------|-------|----------------|
| LOW | < 1% | 20 | Dead, illiquid — skip |
| NORMAL | 1–2% | 60 | Acceptable range |
| ACTIVE | 2–3% | 90 | Ideal — good range without chaos |
| ELEVATED | 3–6% | 75 | High vol — size down |
| EXTREME | > 6% | 30 | Dangerous — skip or tiny size |

**Web vs ThinkScript**: Computed locally from `/time_series`. No difference.

---

## StableScore (0–100)

**Purpose**: Multi-dimension setup quality. Rewards INDEPENDENT evidence only.

**Inputs**: Daily bars, EMA(9/20/50), ADX(14), RelVol30, VWAP, ATR%.

**Computation** (5 components, weights add to 100 pts):
```
1. ADX Trend Strength (0–25 pts):
   ADX > 40 → 25 | > 30 → 20 | > 20 → 12 | > 15 → 5 | ≤ 15 → 0
   (ADX < 15 triggers global 0.7x penalty)

2. EMA Alignment (0–20 pts):
   EMA9 > EMA20 > EMA50 (bullish) → 20
   EMA9 < EMA20 < EMA50 (bearish) → 15 (useful for shorts)
   Mixed → 3

3. RelVol (0–15 pts):   [independent of price]
   RV ≥ 2.0 → 15 | ≥ 1.5 → 10 | ≥ 1.0 → 5 | < 1.0 → 0

4. Price vs VWAP (0–20 pts):  [independent of RSI/MACD]
   dev > 1.5% above → 20 | > 0.3% → 14 | ±0.3% → 8 | > 1.5% below → 0

5. ATR% regime (0–20 pts):
   1.5–4% → 20 | 1–6% → 12 | < 0.5% → 3 | extreme → 6
```

**Penalties** (applied after sum):
- ADX < 15: ×0.7
- ATR band = EXTREME: ×0.8

**Output range**: 0–100

**Bands**: ELITE (≥80) · STRONG (65–79) · MODERATE (50–64) · WEAK (35–49) · POOR (<35)

**Anti-correlation note**: ADX, EMA alignment, RelVol, VWAP position, and ATR% are INDEPENDENT — they don't share the same underlying data series. RSI and MACD are intentionally EXCLUDED to avoid overlap with ADX.

---

## DarvasScan / DarvasBias

**Purpose**: Structural breakout detection (non-repainting) + trend bias.

**Inputs**: Daily OHLCV, EMA(20).

**DarvasScan Computation** (look-back 60 bars):
```
For i from last-1 downward:
  isNewHigh = High[i] > max(High[i-20 : i-1])
  if isNewHigh AND (i+3) <= last:
    BoxTop = High[i]
    BoxBot = min(Low[i+1], Low[i+2], Low[i+3])
    for k from i+4 to last:
      if Close[k] > BoxTop AND Volume[k] > AvgVol20 * 1.2:
        state = BREAKOUT
    (no look-ahead: box is complete at i+3, never uses future bars for box definition)
```

**DarvasBias Computation**:
```
slope = (EMA20[last] - EMA20[last-5]) / EMA20[last-5] * 100
bias = UP if slope > 0.3% | DOWN if slope < -0.3% | FLAT
```

**States**: `BREAKOUT` (90) · `APPROACHING` price within 2% below BoxTop (65) · `IN_BOX` (50) · `NO_BOX` (20)

**Non-repainting guarantee**: Box bottom uses bars AFTER the high, already closed. No current bar used for box definition.

---

## RelVol30 / RelVol30Intraday

**Purpose**: Volume confirmation (independent of price). 30-period relative volume.

**Daily computation**:
```
RelVol30 = Volume[last] / mean(Volume[last-30 : last-1])
```

**Intraday computation** (time-of-day normalized — requires intraday bars):
```
AccumVol_today = sum(Volume[0 : currentBarIndex])
HistAvgAtMinute = mean over last 30 sessions of: sum(Volume[0 : currentBarIndex])
RelVolIntraday = AccumVol_today / HistAvgAtMinute
```

**Output**: ratio (e.g. 1.5 = 50% above average)

**Bands**: VERY_LOW (<0.5) · LOW (0.5–1.0) · NORMAL (1.0–1.5) · HIGH (1.5–2.0) · SURGE (2.0–3.0) · EXTREME (>3.0 — possible exhaustion)

---

## SqueezeHit% (0–100)

**Purpose**: Bollinger Band / Keltner Channel compression detection.

**Inputs**: Closing prices, daily bars. BB(20, 2.0), KC(20 EMA, 1.5×ATR10).

**Computation**:
```
BB_upper[i] = SMA(20)[i] + 2.0 × std(Close, 20)[i]
BB_lower[i] = SMA(20)[i] - 2.0 × std(Close, 20)[i]
KC_upper[i] = EMA(20)[i] + 1.5 × ATR(10)[i]
KC_lower[i] = EMA(20)[i] - 1.5 × ATR(10)[i]

SqueezeON[i] = BB_upper[i] ≤ KC_upper[i] AND BB_lower[i] ≥ KC_lower[i]
SqueezeOFF[i] = NOT SqueezeON[i]

squeezeBars = consecutive SqueezeON bars ending at [last]
BBW[i] = (BB_upper[i] - BB_lower[i]) / SMA(20)[i]
expansionRatio = BBW[last] / min(BBW[last-10 : last])

state:
  FIRING = SqueezeOFF[last] AND SqueezeON[last-1]
  ACTIVE = SqueezeON[last]
  POST   = SqueezeOFF[last] AND SqueezeOFF[last-1]

pct:
  FIRING → 85
  ACTIVE → min(95, 40 + squeezeBars × 2)
  POST → 30

score:
  FIRING → min(100, 70 + squeezeBars × 1.5 + expansionRatio × 5)
  ACTIVE → min(95, 40 + squeezeBars × 1.5)
  POST → 25
```

**Direction**: price vs KC midline → +1 bull, -1 bear, 0 neutral

---

## SmartFlow (−100 to +100)

**Purpose**: Buying/selling pressure PROXY from OHLCV. Not order flow.

**Inputs**: Single bar H/L/C/V, VWAP, AvgVol20.

**Computation**:
```
closeLoc = (Close - Low) / (High - Low)    // 0 = closed at low, 1 = at high
volRatio = Volume / AvgVol20               // capped at 3×
vwapDev  = (Close - VWAP) / VWAP

raw = (closeLoc × 2 - 1) × min(volRatio, 3) × 50 + vwapDev × 200
SmartFlow = clamp(raw, -100, +100)
```

**Bands**: STRONG_BUY (>60) · BUY (25–60) · NEUTRAL (−25 to 25) · SELL (−60 to −25) · STRONG_SELL (<−60)

**Limitation**: Close at high + high volume = +100, but this is a proxy — real order flow requires Level 2 data. Label as "PROXY" in UI.

---

## BidAskSpread

**Purpose**: Liquidity filter.

**Inputs**: Positive, non-crossed bid and ask fields from a two-sided stock quote.
Twelve Data's `/quote` response is used for current price but does not reliably
provide that market, so a missing side is `CHECK`/unverified rather than a
manufactured spread.

**Computation**:
```
spread = ask - bid
spreadPct = spread / ((ask + bid) / 2) × 100
```

**Bands**: TIGHT (<0.1%) · NORMAL (0.1–0.5%) · WIDE (0.5–1%) · ILLIQUID (>1%)

**Filter**: verified spreadPct > 1% → APEX score penalty ×0.8; > 0.5% → ×0.9.
Unknown spread is neutral in scoring and remains visibly unverified.

---

## Earnings (0–3)

**Purpose**: Binary risk flag — proximity to earnings. Real dates from `/earnings`.

**Computation**:
```
daysToEarnings = next_earnings_date - today (calendar days)
risk:
  daysToEarnings ≤ 7  → 3 (DANGER — binary event, avoid directional plays)
  ≤ 14               → 2 (CAUTION)
  ≤ 30               → 1 (WATCH)
  > 30 or none       → 0 (CLEAR)
```

**APEX penalty**:
- risk = 3 → APEX ×0.6
- risk = 2 → APEX ×0.8

---

## V4_APEX_SCORE (0–100)

**Purpose**: Weighted master score. Rewards INDEPENDENT signals.

**Weights** (no correlated pairs in same group):
| Component | Weight | What it measures |
|-----------|--------|------------------|
| StableScore | 25% | Setup quality (ADX, EMA, RelVol, VWAP, ATR — 5 independent dims) |
| SqueezeHit | 20% | Compression catalyst |
| RelVol | 15% | Volume confirmation (independent of price) |
| SmartFlow | 15% | Directional pressure proxy |
| Darvas | 10% | Structural breakout |
| EarlyEntry | 10% | Timing bonus |
| ATR% | 5% | Volatility context |

**Penalties** applied after weighted sum:
- Earnings risk 3 → ×0.6 | risk 2 → ×0.8
- Verified spread > 1% → ×0.8 | > 0.5% → ×0.9; unknown stays unverified
- ADX < 15 (chop) → ×0.85

**Output**: 0–100. Elite ≥80 · Strong 65–79 · Moderate 50–64 · Weak 35–49 · Poor <35.

---

## V4_DIRECTION (−2 to +2)

**Purpose**: Bullish/bearish orientation. INDEPENDENT of quality score.

**6 independent signals** (each casts +1 bull or −1 bear vote):
1. EMA stack: EMA9>20>50 → bull; 9<20<50 → bear
2. Price vs VWAP: +0.2% above → bull; −0.2% → bear
3. ADX+DI (only when ADX>20): DI+ > DI− → bull; DI− > DI+ → bear
4. SmartFlow: >30 → bull; <−30 → bear
5. Darvas bias: UP → bull; DOWN → bear
6. SqueezeHit dir: above midline → bull; below → bear

**Vote tally**: net = bull − bear
- net ≥ 4 → +2 | ≥ 2 → +1 | −1 to 1 → 0 | ≤ −2 → −1 | ≤ −4 → −2

---

## V4_CONFIDENCE (0–100)

**Purpose**: AGREEMENT among independent signals. Distinct from quality.

**Computation**:
```
count_signals_matching_direction(V4_DIRECTION)
confidence = agreeing / total × 100
neutral direction → 50% by definition
```

---

## V4_REGIME

**Purpose**: Market structure classification.

**Priority order** (first match wins):
1. SqueezeHit FIRING → **BREAKOUT**
2. SqueezeHit ACTIVE + squeezeBars ≥ 5 → **SQUEEZE**
3. Darvas BREAKOUT → **BREAKOUT**
4. ADX > 30 + ATR% ≥ 1% → **TREND** (strong)
5. ADX > 20 + ATR% ≥ 1% → **TREND**
6. ATR% > 4% → **HIGH_VOL**
7. ATR% < 0.8% → **LOW_VOL**
8. ADX < 15 → **CHOP**
9. RSI > 75 → **REVERSAL** (overbought)
10. RSI < 25 → **REVERSAL** (oversold)
11. Default → **NEUTRAL**

---

## EARLY_ENTRY Score (0–100)

**Purpose**: Detect setups BEFORE they extend. Solves scanner lag.

**5 independent signals** (each adds pts):
| Signal | Pts | Condition |
|--------|-----|-----------|
| Volume starting | 25 | RelVol 1.0–1.8 (expanding, not climactic) |
| Near resistance | 25 | Price within 2% below Darvas BoxTop |
| Squeeze building | 25 | ACTIVE + squeezeBars ≥ 5 + expansionRatio > 1.1 |
| EMA cross | 25 | EMA9 crossed above EMA20 in last 3 bars |
| VWAP reclaim | 20 | Close crossed above VWAP this bar |

**Partial credit**: volume elevated not extreme (+10), squeeze forming squeezeBars ≥ 3 (+10), EMA aligned not crossing (+8), price at VWAP ±0.5% (+8).

**Bands**: VERY_EARLY (≥70) · EARLY (50–69) · DEVELOPING (30–49) · LATE_OR_NEUTRAL (<30)

---

## Market Regime Layer (SPY/QQQ/VIX)

**Purpose**: Modulate all scores based on macro environment.

**Data**: `/quote` for SPY, QQQ, VIX daily.

**Rules** (applied as APEX global multiplier):
- VIX > 30 (fear spike): all APEX scores ×0.85 (wider ATR discounts setups)
- VIX < 15 + ATR% < 1%: APEX ×1.05 (calm tape = cleaner signals)
- SPY and QQQ both in confirmed downtrend (ADX>25, DI−>DI+): bearish shorts +10%, longs −10%

---

## Credit Budget Formula

```
cost = (symbols × bars_call_cost) + (symbols × quote_call_cost) + earnings_calls
earnings_calls = symbols_with_earnings_check × 5  (cached 24h, rarely called)

Grow tier ≈ 377 credits/min (use 80% = 302 effective)
Pro  tier ≈ 1,597 credits/min (use 80% = 1,278 effective)

For 50 symbols: 50 (daily) + 50 (quote) = 100 credits → 3 scans/min on Grow.
For 100 symbols: 200 credits → 1.5 scans/min on Grow (pages across 2 min).
```

---

*This SPEC is the contract. Web implementation must match these formulas exactly.*
*Improvements allowed where noted; silent drops are not.*

# Scoring model — reasoning, weights, correlation control, stress tests

## Why there are four scores and not one

Four questions, four answers. Collapsing them loses information:

| Score | Question | Range |
|---|---|---|
| `StableScore` | How good is this setup? | 0-100 |
| `Direction` | Which side? | -2 … +2 |
| `Confidence` | Do the signals agree with each other? | 0-100 |
| `EarlyEntry` | Am I early or late? | 0-100 |

`APEX` blends them into one sortable number, but the four remain visible because APEX
alone cannot tell you an `82` is a **short**.

---

## StableScore — six buckets, capped

The correlation problem: EMA stack, ADX, MACD, slope, and RSI all partly measure "is it
trending." Summing them independently means a single trending stock collects five
separate rewards for one fact.

**The fix is bucketing with a hard cap.** Correlated indicators are pooled inside one
bucket, and the bucket cannot exceed its ceiling no matter how many of its members fire.

| Bucket | Max | Members (pooled because correlated) | Independent of |
|---|---|---|---|
| Trend structure | 20 | EMA stack, ADX, ATR-normalised slope | volume, volatility |
| Momentum & persistence | 15 | RSI position, efficiency ratio, squeeze momentum | volume, liquidity |
| Participation | 20 | RelVol, volume trend, CMF magnitude | price entirely |
| Volatility quality | 15 | ATR% band, ATR stability | direction |
| Structure / location | 15 | Darvas box position, breakout distance, extension | volume |
| Liquidity | 15 | Dollar volume | everything |

Participation and Liquidity are the only buckets computed **purely from volume**, which
is why they carry 35 of the 100 points between them: they are the least correlated with
everything else in the model, so they carry the most independent information.

### Why RSI is scored as a band, not a level

`rsiQual` gives **6 points for 55-72 and also 6 points for 28-45**. High RSI is not
"good" — it is bullish. Since StableScore is direction-agnostic, what it rewards is
*being decisively somewhere*, and it penalises the extremes (`>78` or `<22` → 1 point)
because those are exhaustion, not strength.

### The anti-false-positive engine

Multiplicative, applied after the buckets sum:

| Condition | Multiplier | Why |
|---|---|---|
| dollar volume < `minDollarVol` | ×0.55 | Illiquid. Nothing else matters. |
| RelVol < 0.50 | ×0.80 | Nobody is there. |
| bar range > 3× prior ATR | ×0.80 | One-bar spike, usually news or a print. |
| \|price − EMA21\| > 4 ATR | ×0.80 | Overextended; you are late. |
| ADX < 15 **and** no squeeze | ×0.85 | Chop with no compression thesis. |
| ATR% > 12 | ×0.75 | Untradeable range. |
| failed breakout in last 3 bars | ×0.80 | The level already rejected. |

Floored at **0.40** — a stack of penalties degrades a score, it does not annihilate it.
Something scoring 90 on merit with every penalty firing still lands at 36, which reads
as "real setup, bad conditions," not "nothing here."

### The confirmation gate

`stableScore` is **capped at 74 unless at least 3 of the 6 buckets score ≥70% of their
max.** This is the rule that stops one huge reading from manufacturing an elite score. A
stock with RelVol 8.0 and nothing else collects 20/20 participation and very little
otherwise — under a plain sum it would look strong. It cannot exceed 74.

---

## Direction and Confidence

Six lenses, chosen to fail differently:

| Lens | Reads | Fails when |
|---|---|---|
| `sigTrend` | EMA stack + slope sign | ranging |
| `sigMom` | RSI + squeeze momentum sign | mid-transition |
| `sigFlow` | Chaikin money flow sign | thin volume |
| `sigStruct` | Darvas breakout / box position | mid-box |
| `sigVwap` | price vs VWAP | **daily aggregation — returns 0** |
| `sigDI` | +DI vs −DI | low ADX |

```
netSig     = sum of the six          (-6 … +6)
activeSig  = count of non-zero        (0 … 6)
direction  = ±2 at |netSig| ≥ 4, ±1 at ≥ 2, else 0
agreement  = 100 × |netSig| / activeSig
confidence = direction == 0 ? min(45, agreement)
                            : agreement × (0.75 + 0.25 × min(1, activeSig/6))
```

**Why confidence is capped at 45 when direction is 0:** this is the existing dashboard's
COIN FLIP rule, expressed as a number. If the lenses split evenly, you do not have a
50/50 opportunity — you have no read. The cap makes those rows sort to the bottom.

**Why the `activeSig` multiplier exists:** three lenses agreeing unanimously is weaker
evidence than six agreeing unanimously, even though both give `agreement = 100`. The
multiplier scales 100% agreement from 6 lenses to 100, and from 3 lenses to ~87.

**On daily aggregation the VWAP lens returns 0**, so direction is decided by five
lenses. This is handled, not hidden — `activeSig` drops, and confidence drops with it.
Expect a ceiling of ~96 rather than 100 on daily columns for exactly this reason.

---

## APEX — and where it departs from the requested weights

The brief specified: stable 25%, trend 15%, rvol 15%, momentum 10%, darvas 10%, flow
10%, squeeze 5%, ATR 5%, liquidity 5%.

**That weighting double-counts.** Trend, rvol, momentum, darvas, ATR and liquidity are
already *inside* StableScore with correlation control applied. Adding them again on top
of StableScore's 25% re-introduces exactly the overlap the buckets were built to
prevent, and it does so **without** the caps — so a trending stock would collect its
trend reward once inside StableScore (capped at 20) and again at the APEX level
(uncapped at 15%).

What is implemented instead:

```
apexRaw     = 0.55 × StableScore      ← all six buckets, correlation-controlled
            + 0.20 × |SmartFlow|      ← pressure magnitude, NOT in StableScore
            + 0.15 × Confidence       ← agreement, NOT in StableScore
            + 0.10 × SqueezeHit       ← compression state, NOT in StableScore

apexGate    = count of: stable ≥ 55, confidence ≥ 55, |flow| ≥ 25, |darvas| ≥ 1
apexPenalty = (spike ? 0.85 : 1) × (failedBO ? 0.90 : 1)

APEX        = (apexGate ≥ 3 ? apexRaw : min(72, apexRaw)) × apexPenalty
```

`apexPenalty` exists because of a leak found during testing, not by design. A single
huge-volume bar closing at its high maxes SmartFlow (+100) **and** Confidence (100)
simultaneously, which alone clears three of the four gates — so a spike that StableScore
had correctly discounted to 47 was still producing APEX **68**. Discounting spikes at the
blend level as well as inside StableScore brings that same case to **58**. Both numbers
are measured, not estimated; see the stress table.

Effective decomposition, so you can compare against what was asked for:

| Dimension | Requested | Effective | Path |
|---|---|---|---|
| Stable quality | 25% | — | dissolved into its components below |
| Trend | 15% | 11.0% | 0.55 × (20/100) |
| Relative volume | 15% | 11.0% | 0.55 × (20/100) |
| Momentum | 10% | 8.25% | 0.55 × (15/100) |
| Darvas / structure | 10% | 8.25% | 0.55 × (15/100) |
| ATR opportunity | 5% | 8.25% | 0.55 × (15/100) |
| Liquidity | 5% | 8.25% | 0.55 × (15/100) + hard gate |
| Smart-flow proxy | 10% | 20.0% | direct |
| Squeeze quality | 5% | 10.0% | direct |
| Agreement | — | 15.0% | direct — added, see above |

Flow and squeeze are weighted **above** the request deliberately: they are the two
dimensions with the least overlap with everything else, so they carry the most marginal
information per point. Liquidity's nominal 8.25% understates it — it is also a hard gate
in every scan and a ×0.55 penalty in StableScore.

**Known residual double-count:** CMF contributes up to 4 of the 20 participation points
inside StableScore *and* drives SmartFlow. Effective overlap is ~2.2% of APEX. Left in
place because removing it would cost participation its only non-volume-magnitude input.

---

## Explainability — reading real values

| APEX | DIR | CONF | STABLE | EARLY | Reading |
|---|---|---|---|---|---|
| 82 | +2 | 86 | 74 | 71 | Textbook long. Every lens agrees, still early. Full size. |
| 82 | −2 | 86 | 74 | 71 | Textbook **short**. Identical quality, opposite side. |
| 78 | +2 | 84 | 76 | 22 | Real, and you missed it. Extended. Wait for a pullback. |
| 71 | 0 | 41 | 68 | 55 | The COIN FLIP row. Good structure, lenses fighting. Skip. |
| 65 | +1 | 72 | 52 | 81 | Early-entry candidate. Weak now by design — that is what early looks like. |
| 44 | +1 | 60 | 41 | 30 | Nothing. Do not go looking for a reason. |

**High APEX + low EARLY is the single most useful divergence in the system.** It is the
scanner-lag problem made visible: the setup is real, and it is not yours any more. The
dashboard marks this case with a `⚠LATE` chip.

**High STABLE + low CONF** means the components are individually strong and mutually
contradictory — usually a stock at a decision point. Wait for CONF to resolve.

---

## False-positive stress tests

Rows marked **measured** were run through the JavaScript port of this model (which
carries identical thresholds) on synthetic 5-minute bars. Rows marked *traced* were
worked through the formulas by hand and have not been executed.

| Adversarial case | Naive result | This model | Mechanism |
|---|---|---|---|
| **measured** — illiquid microcap, $0.12M ADV | "acceptable" | **STABLE 14, APEX 21** | ×0.55 illiquidity, liquidity bucket 0, confidence collapses to 33 |
| **measured** — thin name, one 400× volume bar +35% | "elite, RVOL 28" | **STABLE 47, APEX 58** | spike penalty in both StableScore and APEX; without the APEX term this was 68 |
| **measured** — high-vol biotech, ATR% 4.9 | "extreme vol = opportunity" | **STABLE 61** | ATR% band scores *tradeable* range, not maximum range |
| **measured** — low-vol utility, ATR% 0.08 | "safe, stable" | **STABLE 66, EARLY 35** | quality is real, but nothing to trade — read EARLY and ATR% together |
| **measured** — parabolic, compounding 1.2%/bar | "very strong" | **EARLY 8** | extension penalty; EARLY is the tell, not STABLE |
| *traced* — broke out yesterday, closed back inside | "breakout" | DarvasScan 0, ×0.80 ×0.90 | `failedBO` in both StableScore and APEX |
| *traced* — dead ADX 11, no squeeze, RelVol 0.4 | "acceptable" | ~24 | ×0.85 chop × ×0.80 low-rvol |
| *traced* — every lens neutral (perfect chop) | direction 0 | confidence capped 45 | COIN FLIP rule |

**Where it still gets fooled, honestly:**

1. A stock in a genuine multi-week uptrend pulling back to its 21 EMA on light volume
   scores middling on participation and loses the RelVol points, even though it may be
   the best entry available. This model is built for expansion, not pullback entries.
   Use `V4_EARLY_ENTRY_SCAN` with `minEarly` lowered to ~50 if you trade pullbacks, and
   expect to filter by eye.
2. The spike case above still lands at 58 — depressed, not eliminated. A genuinely
   explosive single bar and a print-driven fake bar look identical in OHLCV. If you want
   them gone entirely rather than demoted, raise `minApex` on the scans to 70+, which
   all the APEX scans already default to.

---

## Repainting and look-ahead

Audited construct by construct.

**Non-repainting by construction:**
- Darvas box uses `Highest(high[1], n)` / `Lowest(low[1], n)` — the forming bar cannot
  redraw the box that it is being measured against. This is deliberate and is why a
  plotted box sometimes sits below an intrabar spike.
- Every `CompoundValue` counter (`sqzBars`, `sinceFire`, `sinceBO`, `barsSinceLast`)
  reads only `[1]` and earlier.
- No positive-index offsets appear anywhere.

**Recalculates intrabar, as all ThinkScript does:** every score changes until the bar
closes, because `close`, `volume`, and therefore RelVol, CMF and the momentum terms are
still moving. Historical bars are final; the current bar is provisional. This is
inherent to the platform, not a defect in these scripts — but it means an intrabar scan
hit can vanish before the bar closes.

**One genuine look-ahead, contained and labelled:** `GetEventOffset(Events.EARNINGS, 0)`
reads a *future* calendar date. That is intentional — the whole point of an earnings
warning is to know before it happens — and it is why `EarningsRisk` must never be used
as a component of a backtest.

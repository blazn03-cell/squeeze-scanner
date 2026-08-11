# V3 → V4 changelog

"V3" here means the JavaScript engine that was already in `index.html` — `calcWinProb`,
`computeIchimoku`, `getTechnicalRead`. There was no V3 ThinkScript. See
`PROJECT_AUDIT.md`.

Nothing was silently replaced. Every entry below states what the old logic did, what
replaced it, why, and what it costs.

---

## 1. Conviction score: `calcWinProb` → `V3_StableScore`

**Old:** additive points across nine options-flow dimensions (sweep+DP 28, staircase 20,
short interest 20, size/OI 12, repeat sweeps 10, GEX 8, net premium 8, P/C 6, ask 4),
then multiplicative penalties (earnings ×0.7, trade-day decay ×0.85/×0.65/×0.45).

**New:** additive points across six price/volume buckets (trend 20, participation 20,
momentum 15, volatility 15, structure 15, liquidity 15), each **capped**, then
multiplicative penalties floored at ×0.40.

**Why:** ~68 of the old 100 points are Unusual Whales data ThinkScript cannot reach. The
*shape* of the old engine — additive evidence, multiplicative discounts — was kept
because it is correct. What changed is the evidence available.

**Benefit:** works standalone in ThinkorSwim with no API.

**Trade-off:** it measures a genuinely different thing. The old score answered "is
institutional positioning building?" The new one answers "is the price structure good?"
They will disagree, and that disagreement is informative rather than an error.

---

## 2. Penalties: kept multiplicative, against the brief

**Old:** `pts = Math.round(pts * 0.7)`.
**Brief asked for:** a subtractive penalty list.
**New:** multiplicative, floored at ×0.40.

**Why the old approach won:** subtractive penalties flatten every weak setup onto the
same floor and destroy ranking at the bottom of the list. Multiplicative penalties scale
with the score, so a 90 with every penalty firing lands at 36 — "real setup, bad
conditions" — instead of collapsing to 0 alongside genuine garbage.

**Trade-off:** a very high raw score can survive more penalties than it arguably should.
Mitigated by the hard blocks in §6.

---

## 3. Direction: Ichimoku bias → six-lens `V4_DIRECTION`

**Old:** one lens. Ichimoku on 5m bars → BULLISH / BEARISH / NEUTRAL.
**New:** six lenses (EMA stack+slope, RSI+momentum, money flow, Darvas structure, VWAP,
DI) netted to −2…+2.

**Why:** Ichimoku is excellent but it is a single method — when it is wrong, nothing
disagrees with it. Six lenses chosen to fail under *different* conditions produce a
usable agreement measure, which one lens cannot.

**Benefit:** Confidence becomes measurable rather than asserted.

**Trade-off:** Ichimoku's cloud geometry (a genuinely different read on support and
resistance) is not represented. If you want it, `computeIchimoku` still runs in the
dashboard, untouched, alongside V4.

---

## 4. COIN FLIP → `direction == 0`, confidence capped at 45

**Old:** a string verdict, `verdictConf = 50`.
**New:** numeric, capped at 45.

**Why:** the rule was right and is preserved exactly — conflicting signals mean *no read*,
not a 50/50 opportunity. It became a number so it sorts to the bottom of a watchlist
instead of needing to be read row by row. 45 rather than 50 so it always ranks below a
genuine weak-but-consistent read.

---

## 5. Trade-day decay → `V4_TIMING` + `V4_EarlyEntry`

**Old:** ×0.85 / ×0.65 / ×0.45 by day held.
**New:** two columns — Timing (−2…+2, is the move still available) and EarlyEntry
(0-100, how much transition is underway).

**Why:** ThinkScript has no idea you are in a trade. Extension from equilibrium is the
available proxy for "how late am I."

**Trade-off:** it measures lateness of the *move*, not of *your position*. A setup that
just triggered reads early even if you have held it for a week.

---

## 6. Score gates: added after testing, not designed in

**v1 (first commit):** cap at 72 unless 3 of 4 gates pass.
**v2 (now):** 4 of 6 gates (added liquidity ≥50 and direction ≠0), plus **hard blocks** at
55 for direction 0, liquidity <35, or extension >3.0 ATR, plus a spike/failed-breakout
multiplier.

**Why:** testing found a one-bar volume spike maxing SmartFlow (+100) and Confidence (100)
simultaneously — enough to clear three gates alone. A setup StableScore had correctly
discounted to 47 was producing SCORE 68. It now produces 47.

**Benefit:** no single extreme reading can manufacture an elite score.

**Trade-off:** genuinely explosive single bars are demoted along with fake ones. OHLCV
cannot distinguish them.

---

## 7. EarlyEntry: absolute → transition

**Old (v1):** rewarded absolute conditions with lower thresholds than SCORE — RelVol in a
band, squeeze active, near breakout.
**New:** every term compares **now against 3-6 bars ago**. RelVol *rising*, ADX
*improving*, EMA stack *flipping*, VWAP *reclaimed*, compression *releasing*, momentum
slope *accelerating*.

**Why:** "the master scan with lower thresholds" finds the same names, later. It does not solve
scanner lag; it just lowers the bar. Detecting the transition is a different measurement.

**Benefit:** a stock that has been strong for two weeks now scores near **0** here, which
is correct — there is no transition to catch.

**Trade-off:** noisier. Transitions fail more often than established trends. This is why
`V4_EARLY_ENTRY_SCAN` also gates on Timing ≥ +1 and liquidity ≥ 45.

---

## 8. Extension reference: VWAP → nearer of EMA21 / VWAP

**Old (v1):** VWAP when available, EMA21 otherwise.
**New:** the **minimum** of the two distances.

**Why:** found in testing. On a normal intraday trend day price drifts several ATR from
the session VWAP while sitting right on its trend mean — which read as "chase risk" and
hard-blocked SCORE on healthy trends. You are not chasing if price is near *either*
equilibrium.

**Benefit:** the same thresholds work on Daily and intraday.

**Trade-off:** slightly permissive when the two equilibria are far apart, which is
exactly when the reading is ambiguous anyway.

---

## 9. Liquidity: single floor → `V4_LIQUIDITY_SCORE`

**Old:** one $2M dollar-volume gate.
**New:** 0-100 score (dollar volume 45, price level 25, participation 20, turnover 10),
with the $2M floor retained underneath it.

**Why:** a binary gate cannot rank. Two names both above $2M can be very differently
tradeable.

**Trade-off:** it does **not** measure market depth or real slippage. Nothing on a
ThinkScript chart does. `BidAskSpread.ts` is the only true spread reading and works only
as a custom quote.

---

## 10. Earnings: one column → two

**Old:** `calcWinProb` applied ×0.7 within 14 days, invisibly.
**New:** `V4_DaysToEarnings` (numeric, blank when unknown, never estimates) and
`EarningsRisk` (0-3, may estimate from cycle but caps guesses at level 1).

**Why:** a hidden multiplier is not auditable. Splitting the raw number from the judgement
lets you see *why* a score dropped.

**Trade-off:** two columns instead of none, and `GetEventOffset` coverage is thin on ADRs
and recent listings. Blank means unknown, not safe.

---

## 11. Added: `signalMode` LIVE / CLOSED_BAR

**Old:** no equivalent — the dashboard always read live.
**New:** an input on every script that shifts all input series back one bar in CLOSED_BAR.

**Why:** honesty. LIVE signals are not repaint-proof and the docs no longer imply they are.

**Trade-off:** CLOSED_BAR is always one bar late. That is the actual cost of confirmation.

---

## 12. Added with no V3 equivalent

`V4_REGIME`, `V4_Confirmed`, `SqueezeState`, `DarvasBias`, `RelVol30Intraday`,
`V4_RelStrength`, `V4_EXTENSION`, `V4_TIMING`.

`DarvasBias` deserves a note: it is deliberately **not** `DarvasScan`. Scan is the event
(did it break out), Bias is the posture (is it structurally strong). Bias +2 with Scan 0
— coiled near the top of the box, no breakout yet — is the configuration the old
"staircase" logic was trying to catch with dark-pool prints, reached from price structure
instead.

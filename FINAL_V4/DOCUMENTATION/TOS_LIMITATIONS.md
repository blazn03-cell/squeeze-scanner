# ThinkorSwim compatibility, and what I cannot guarantee

## Compatibility matrix — what each context allows

| | Watchlist custom quote | Stock Hacker study filter | Chart study |
|---|---|---|---|
| Number of plots | exactly 1 | exactly 1, named `scan` | any |
| `AssignBackgroundColor` | yes | **no** | no |
| `AddLabel` | **no** | **no** | yes |
| `AddChartBubble` | no | **no** | yes |
| Secondary aggregation | avoid | **no** | yes |
| Second symbol (`close("SPY")`) | yes, slow | yes | yes |
| `bid` / `ask` | **yes — only here** | no | no |
| `vwap` | intraday only | intraday only | intraday only |
| Earnings events | daily aggregation | daily aggregation | daily aggregation |

Every file in `SCANNERS/` was machine-checked for exactly one plot named `scan`, and for
the absence of labels, bubbles, background colours, and aggregation tokens. Every file in
`WATCHLIST_COLUMNS/` was checked for exactly one plot and no `AddLabel`. The same pass
checked all 36 files for duplicate declarations, undeclared identifiers, unbalanced
parentheses, unterminated statements, and PineScript-isms (`ta.*`, `request.security`,
`varip`, `nz()`, `bar_index`, …). Zero findings.

## Things the brief asked for that ThinkScript cannot do

**Institutional / dark-pool order flow.** There is no such data in ThinkScript stock
scripts. No dark-pool prints, no block-trade tape, no gamma exposure, no short interest,
no days-to-cover, no borrow rate. `SmartFlow.ts` is a price/volume **pressure proxy** and
says so in its own header. The real flow data in this project comes from the Unusual
Whales API and lives in the dashboard, not in ThinkorSwim.

**True time-of-day volume profile.** ThinkScript has no intraday volume-profile function
and no secondary aggregation inside a watchlist column. `RelVol30Intraday.ts` implements
the strongest available alternative: today's cumulative session volume compared against
the cumulative volume at the *identical bar-of-day* on each of the previous N sessions,
using `GetValue` offsets of `barsPerDay`. It is real time-of-day normalisation, but it is
**structurally dependent on a constant bar count per session** — so extended hours must
be off, and half-days will read high. Both are stated in the file header.

**Text output that still sorts.** A custom quote cannot render a word and remain
sortable. `V4_REGIME.ts` emits a number; `STUDIES/V4_Dashboard.ts` prints the word on the
chart. That split is the reason both files exist.

**Knowing how long you have held a position.** ThinkScript has no idea you are in a
trade. The existing dashboard's trade-day decay (×0.85 → ×0.65 → ×0.45) has no
equivalent. `V4_TIMING` uses extension from the nearer equilibrium as the proxy for
"how late is this move" — a different question from "how long have I held it". That
gap is unavoidable, not an oversight.

## Validation status

> **STATICALLY VALIDATED — REQUIRES TOS COMPILE TEST**

That label is precise. Do not read it as "compile test passed", because no script here
has been run through the ThinkorSwim compiler.

### Acceptance checklist — what was actually checked

| # | Check | Result |
|---|---|---|
| 1 | Valid ThinkScript syntax (statement termination, balanced parens) | ✅ machine-checked, all files |
| 2 | Exactly one plot where required (columns, scans) | ✅ machine-checked |
| 3 | No PineScript syntax (`ta.*`, `request.security`, `varip`, `nz()`, `bar_index`, `study()`) | ✅ machine-checked |
| 4 | No fake imports / module system | ✅ none exist — ThinkScript has none |
| 5 | No secondary aggregation in Stock Hacker filters | ✅ machine-checked |
| 6 | Numerically sortable output where required | ✅ every column plots a number |
| 7 | Divide-by-zero protection | ✅ every quotient guarded |
| 8 | NaN protection | ✅ every optional input `IsNaN`-guarded |
| 9 | No future references (positive offsets) | ✅ none, except the documented earnings lookup |
| 10 | Active-bar behaviour documented | ✅ `signalMode` input + stated plainly |
| 11 | Correlation overlap controlled | ✅ see `V4_DEPENDENCY_MATRIX.md` |
| 12 | Quality / direction / confidence / timing separated | ✅ four distinct columns |
| 13 | Extreme-extension penalty | ✅ hard block above 3.0 ATR |
| 14 | Liquidity gate | ✅ hard floor + score, blocks SCORE below 35 |
| 15 | False-breakout handling | ✅ `failedBO` in StableScore, SCORE and the breakout scan |
| 16 | Event-risk handling | ✅ two earnings columns |
| 17 | Reasonable computational cost | ⚠️ **not measured** — see `Inertia` note below |
| 18 | Duplicate declarations | ✅ machine-checked |
| 19 | Shared modules byte-identical across files | ✅ build fails otherwise |
| 20 | Arithmetic correctness of the scoring model | ✅ verified by executing an identical JS port against synthetic data — see `SCORING_MODEL.md` |

Items 17 and everything in the next section are the open ones.

### Compile-test these first

In this order — they are ranked by how likely they are to reject:

1. `RelVol30Intraday.ts` — the `fold` + `GetValue` construct
2. `V4_DaysToEarnings.ts` and `EarningsRisk.ts` — the `GetEventOffset` sign convention
3. `BidAskSpread.ts` — must be pasted as a **custom quote**, not a study
4. `V4_SCORE.ts` — the largest file; if anything hits a size or complexity limit it is this
5. Any one scan, e.g. `V4_MASTER_SCAN.ts` — confirms the one-plot form is accepted
6. `V4_Core.ts` — only if you intend to use the `reference` approach

If 1-5 compile, the rest almost certainly will: they are built from the same modules.

## What I cannot guarantee without compiling inside ThinkorSwim

I have not pasted these into a live ThinkorSwim instance. Static analysis found zero
errors and the model's arithmetic was verified by executing an identical JavaScript port
— but neither of those is a ThinkScript compiler. The constructs below are the ones to
check first; if something fails to compile, it is almost certainly on this list.

**1. `GetEventOffset(Events.EARNINGS, 0)` sign convention** — `EarningsRisk.ts`.
The script assumes a **negative** return means "n bars in the future." If your earnings
column reads 0 for everything, invert the sign test on the `hasNext` / `barsToNext`
lines. The fallback path (bars since last confirmed report) is independent and will keep
working either way.

**2. `fold` with `GetValue(series, i * barsPerDay)`** — `RelVol30Intraday.ts`.
Dynamic offsets inside a `fold` are documented as supported, but this specific
combination is the least conventional construct in the whole set. If it rejects, unroll
it into explicit `GetValue(cumVol, barsPerDay)`, `GetValue(cumVol, barsPerDay*2)`, … terms.

**3. `bid` / `ask` in a custom quote** — `BidAskSpread.ts`.
Correct per Schwab's own custom-quote example, but it will show blank outside market
hours and on symbols with no live quote. That is expected, not a bug.

**4. `vwap` on daily aggregation.** Guarded with `IsNaN` everywhere it is used, so it
degrades to a 0 contribution rather than poisoning a score. If it errors rather than
returning NaN on your build, set the VWAP-dependent columns to an intraday aggregation.

**5. `Inertia(...)` inside a watchlist column at scale.** Linear regression over 20 bars
per row is the heaviest single call in the set. On a 1000+ symbol watchlist expect slow
refresh. If it is unusable, replace `sqzMom` with `c - Average(c, sqzLength)` — cruder,
much cheaper, and the direction sign is what most of the model actually consumes.

**6. `V4_RelStrength.ts` at scale.** Loading `close(symbol = "SPY")` per row roughly
doubles per-row cost. It is optional and excluded from `V4_Confirmed`'s category count
for exactly this reason.

**7. `signalMode` enum input.** `input signalMode = {default LIVE, CLOSED_BAR};` is
standard ThinkScript, but if your build rejects the enum form, replace it with
`input useClosedBar = no;` and change `def closedBar = signalMode == signalMode.CLOSED_BAR;`
to `def closedBar = useClosedBar;`. Nothing else needs to change.

**8. `StDev` sample vs population.** The Bollinger term assumes ThinkScript's `StDev` is
population (÷n). If your build uses the sample form (÷n−1), squeeze detection shifts very
slightly — the direction of every signal is unaffected, but `SqueezeHit%` values will not
match the dashboard to the point.

## Performance

`Average`, `ExpAverage`, `WildersAverage`, ATR, `Highest` and `Lowest` are each computed
**once** per script and reused. `TrueRange` is computed once and feeds ATR, the ADX
smoothing, and the Keltner channel. Each shared module appears at most once per file, in
dependency order.

Light columns pull only the modules they need — `RelVol30` does not compute ADX, and
`V3_ModelATRpct` computes nothing but ATR. The heaviest files are `V4_SCORE` and
`V4_MASTER_SCAN`, which pull nearly every module.

## Modularity — the honest trade-off

ThinkScript has no `#include`. There are exactly two options:

**What was shipped:** every file is self-contained, and the shared blocks are
**byte-identical** across all 36 files (machine-verified — the audit fails if any two
copies drift). Nothing to install in order, nothing to break by renaming a study.

**The alternative:** `STUDIES/V4_Core.ts` is that same single source, exported as hidden
plots. Save it under exactly that name and other scripts can do
`def s = reference V4_Core()._StableScore;`. One place to tune, but every column and scan
then depends on a study that must not be renamed or edited.

Self-contained is the recommended install. `V4_Core.ts` is there if you would rather tune
in one place and accept the coupling.

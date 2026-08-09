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
checked all 32 files for duplicate declarations, undeclared identifiers, unbalanced
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
equivalent. `V4_EarlyEntry` uses extension-from-EMA as the proxy for "how late am I."

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

**7. `StDev` sample vs population.** The Bollinger term assumes ThinkScript's `StDev` is
population (÷n). If your build uses the sample form (÷n−1), squeeze detection shifts very
slightly — the direction of every signal is unaffected, but `SqueezeHit%` values will not
match the dashboard to the point.

## Performance

`Average`, `ExpAverage`, `WildersAverage`, ATR, `Highest` and `Lowest` are each computed
**once** per script and reused. `TrueRange` is computed once and feeds ATR, the ADX
smoothing, and the Keltner channel. Each shared module appears at most once per file, in
dependency order.

Heaviest to lightest: `V4_MASTER_SCAN` (341 lines) → `V4_APEX_SCORE` (290) → …
→ `V3_ModelATRpct` (36). Light columns pull only the modules they need — `RelVol30`
does not compute ADX, and `V3_ModelATRpct` computes nothing but ATR.

## Modularity — the honest trade-off

ThinkScript has no `#include`. There are exactly two options:

**What was shipped:** every file is self-contained, and the shared blocks are
**byte-identical** across all 32 files (machine-verified — the audit fails if any two
copies drift). Nothing to install in order, nothing to break by renaming a study.

**The alternative:** `STUDIES/V4_Core.ts` is that same single source, exported as hidden
plots. Save it under exactly that name and other scripts can do
`def s = reference V4_Core()._StableScore;`. One place to tune, but every column and scan
then depends on a study that must not be renamed or edited.

Self-contained is the recommended install. `V4_Core.ts` is there if you would rather tune
in one place and accept the coupling.

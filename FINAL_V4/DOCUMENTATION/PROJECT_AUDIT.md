# Project audit — what was actually here before FINAL_V4

## The headline finding

**This repository contained zero ThinkScript.** No `.ts`, `.thinkscript`, or `.tsc`
files. No custom quotes, no study filters, no Stock Hacker exports. Nothing to
reverse-engineer in ThinkScript terms.

The brief said "do not destroy the scanner I already built — first reverse-engineer it,
then improve it." That instruction was followed, but the thing that existed to be
reverse-engineered was a **JavaScript options-flow engine**, not a ThinkorSwim study.
Every scoring decision in FINAL_V4 traces back to it. Where the JS engine's logic was
better than the spec, the JS engine won — those cases are listed at the bottom.

## Full inventory

| File | Lines | What it is | Verdict |
|---|---|---|---|
| `index.html` | 1644 | Single-file React dashboard (React 18 + Babel standalone via CDN). The real product. Deployed to Vercel. | **Kept, extended** |
| `scanner.js` | 127 | Node cron scanner. Calls Claude with the Unusual Whales MCP server, parses a JSON array of candidates. | Kept as-is |
| `sheets.js` | 147 | Google Sheets logging via the Replit connectors SDK. | Kept as-is |
| `setup-sheet.js` | 254 | One-time Sheets tab/header bootstrap. | Kept as-is |
| `index.js` | 29 | Cron entrypoint; wraps `runScan` + `logToSheet`. | Kept as-is |
| `config.js` | 20 | `WATCHLIST` (SPY/QQQ/IWM), `SCAN_PARAMS`, model config. | Kept as-is |
| `serve.py` / `main.py` | 25 | Local static server for `index.html`. | Kept as-is |
| `vercel.json` | 5 | Static deploy of `index.html` only. | **Updated** |
| `attached_assets/*.zip` × 3 | — | Three copies of the same `index.html` + `CHANGES.md`, dated 2026-04-24. Two are byte-identical duplicates. | Obsolete, left untouched |
| `SETUP-GUIDE.md` | 443 | Deployment/runbook doc. | Kept as-is |

**Duplicated logic found:** `parseArr` / `stripFences` exist in both `scanner.js` and
`index.html`. The two `files_(3)_*.zip` archives are identical. Neither was touched —
they are outside the scope of this branch.

**Broken or incomplete scripts found:** none. The existing code is coherent.

## The scoring logic that was already here

Four engines, all in `index.html`:

**1. `calcWinProb(p)` — 0-95 conviction score.** Reads options-flow fields: sweep+dark-pool
confirmation (0-28), staircase accumulation days (0-20), repeat sweep count (0-10),
size-vs-open-interest (0-12), short interest / days-to-cover / borrow rate (0-20),
GEX bias (0-8), net premium trend (0-8), put/call ratio (0-6), ask-fill quality (0-4).
Then **multiplicative decay penalties**: ×0.7 near earnings, ×0.85 / ×0.65 / ×0.45 as
the trade ages.

**2. `computeIchimoku(bars)` — technical bias.** Real Ichimoku on 5m OHLC: Tenkan(9),
Kijun(26), Span A/B(52), Chikou(26-back), TK cross, cloud colour, price zone. Emits
`BULLISH / BEARISH / NEUTRAL` × `STRONG / MODERATE / WEAK / TRANSITION`.

**3. `getTechnicalRead(p, macroBias)` — the verdict engine.** Combines Ichimoku bias with
macro tide:

```
tech BULL + macro BULL → CALLS      (full size)
tech BEAR + macro BEAR → PUTS       (full size)
tech BULL + macro BEAR → COIN FLIP  (conflict, no edge)
tech BEAR + macro BULL → COIN FLIP  (conflict, no edge)
either NEUTRAL         → CASH
no Ichimoku data       → PENDING
```

**4. `getHoldStatus` / `getGuidance` — position lifecycle.** ENTER → HOLD → MONITOR →
TRIM → EXIT against a per-setup-type max hold.

## How that mapped into FINAL_V4

The verdict engine is the most valuable thing in this repo and it already solved the
exact problem the brief describes — "a 74 doesn't tell you bullish or bearish." It
solved it by keeping **quality, direction, and agreement as three separate outputs**.
FINAL_V4 keeps that separation rather than inventing a new one:

| Existing JS | FINAL_V4 ThinkScript | Note |
|---|---|---|
| `calcWinProb` | `V3_StableScore` | Same shape: additive buckets, then multiplicative penalties. |
| Ichimoku `bias` | `V4_DIRECTION` | Ichimoku needs no secondary aggregation, but 6 lenses beat 1 in a single-timeframe column. |
| Ichimoku `strength` | Feeds `V4_CONFIDENCE` | Strength = how much of the structure agrees — same idea, generalised. |
| COIN FLIP on conflict | `direction == 0` → confidence capped at 45 | Same rule, expressed numerically so it sorts. |
| PENDING on no data | NaN-guarded blanks | Same: never fabricate a read. |
| Earnings ×0.7 | `EarningsRisk.ts` + penalty | Split into its own column so you can see *why*. |
| Trade-day decay ×0.85→×0.45 | `V4_EarlyEntry` | ThinkScript cannot know your entry date, so extension-from-EMA is the proxy for "how late am I." |

## Where the existing implementation beat the spec, and won

**1. Multiplicative penalties, not subtractive.** The brief asked for a penalty list.
`calcWinProb` uses `pts = Math.round(pts * 0.7)`. Multiplicative is correct — it scales
with the score instead of flattening every weak setup to the same floor. FINAL_V4's
anti-false-positive engine is multiplicative for this reason, with a `0.40` floor so no
stack of penalties can zero out a genuinely good setup.

**2. Separating conviction from direction from agreement.** The brief proposed adding
`V4_DIRECTION` and `V4_CONFIDENCE` as new ideas. They already existed as `verdict` and
`verdictConf`. Kept, formalised, made sortable.

**3. Refusing to guess when data is missing.** `getTechnicalRead` returns `PENDING`
rather than defaulting to neutral. Every FINAL_V4 column returns `Double.NaN` (a blank
cell) rather than `0` when its inputs are absent — a blank is honest, a `0` is a lie
that sorts.

**4. `parseFloat(x || 0)` guarding everywhere.** Mirrored as explicit `IsNaN` and
divide-by-zero guards on every quotient in every script.

## What could not be carried over, and why

`calcWinProb`'s single highest-weighted inputs — sweep + dark-pool confirmation,
staircase accumulation, size-vs-OI, short interest, GEX bias — are **Unusual Whales API
data**. ThinkScript stock scripts cannot reach any of it. That is roughly 68 of the 100
points in the existing engine with no ThinkScript equivalent.

`SmartFlow.ts` is the honest substitute: a pressure proxy from close-location-value ×
volume, VWAP displacement, and relative-volume confirmation. It is labelled a proxy in
its own header, in this document, and in the README. It is not presented as order flow,
because it is not order flow.

**The consequence:** ThinkorSwim FINAL_V4 and the Unusual Whales dashboard are
complementary, not redundant. TOS sees price structure the API cannot; the API sees
positioning TOS cannot. Use both.

## What changed in the existing code

`index.html` gained, and nothing was removed:

- `computeV4()` — a JS port of the FINAL_V4 model, run on the same 5m bars
  `computeIchimoku()` already consumes. Wrapped in try/catch so one bad symbol cannot
  break a scan.
- `V4Grid` — a toggleable panel (🧮 V4 in the toolbar) rendering the FINAL_V4 watchlist
  from those numbers.
- An `SCORE nn · ±n` chip on every signal card, with a `⚠LATE` marker when SCORE ≥ 65 and
  EarlyEntry < 40 — the extended-setup case.

`calcWinProb`, `computeIchimoku`, `getTechnicalRead`, `getHoldStatus` and `getGuidance`
are untouched. The V4 numbers sit **beside** the existing verdict engine, not on top of
it: the verdict tells you what the options flow says, V4 tells you what the price
structure says, and the two disagreeing is information.

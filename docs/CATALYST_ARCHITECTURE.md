# Catalyst engine — what runs where, and what is honest

Companion to `V5_PRODUCT_SPEC.md`. This one is about the gap between the specified
architecture and what a static page can actually deliver, because that gap is where
products start lying to their users.

## The honest capability table

| Capability | Static page (today) | Needs a backend |
|---|---|---|
| Normalise, classify, map tickers | ✅ | |
| Deduplicate N reports into one event | ✅ | |
| Score impact / direction / confidence | ✅ | |
| Per-category time decay | ✅ | |
| Cross-asset propagation | ✅ seed map | ⬜ full entity resolution |
| Fuse with the technical read | ✅ | |
| Danger Zones from the day's calendar | ✅ | |
| Market Brain | ✅ | |
| Safe/Pro gating | ✅ | |
| Rule-derivable calendar (claims, NFP, opex) | ✅ | |
| Published calendar (CPI, PPI, PCE, FOMC, GDP) | ⬜ | ⬜ authoritative feed |
| Event database + measured reactions | 🟡 localStorage, this browser only | ⬜ shared store |
| Reaction statistics | 🟡 small samples | ⬜ meaningful n |
| Continuous ingestion while closed | ❌ | ⬜ |
| Many wires in parallel | ❌ one endpoint | ⬜ |
| Push notifications | ❌ | ⬜ |

Nothing marked ❌ is faked in the UI. Where a capability is missing the interface says so
in place — the calendar tab explains that `MACRO_SEED` ships empty, and the stats tab
explains the database is local to the browser.

## Why `MACRO_SEED` ships empty

CPI, PPI, PCE, FOMC and GDP release dates are **published, not derivable**. Guessing them
would produce a countdown timer that is confidently wrong, which is worse than no timer —
a trader who trusts a fabricated "CPI in 2 hours" makes a real decision on it.

What *is* derivable is generated: weekly jobless claims (Thursday 08:30 ET), nonfarm
payrolls (first Friday 08:30 ET), monthly opex and triple witching (third Friday). Each
is tagged `derived: true` so the UI can label its provenance.

To add real dates, fill `MACRO_SEED`:

```js
const MACRO_SEED = [
  { date:"2026-08-12", timeET:"08:30", name:"CPI", importance:"CRITICAL", consensus:3.1 },
];
```

Entries are tagged `derived: false` and shown as "seeded".

## Why direction is a keyword classifier, and why that is disclosed

`scoreDirection()` is regex sentiment over a curated lexicon, with three refinements:
explicit surprise data overrides keywords entirely; inflation-family releases invert
(a hot print is bearish for equities); and conflicting terms damp by `1/√hits`.

It is not language understanding. It will misread sarcasm, complex conditionals, and
headlines whose meaning depends on context it cannot see. That is precisely why
`NEWS_CONFIDENCE` is a separate dimension rather than being folded into direction, and
why an ambiguous headline resolves to **0** instead of a small non-zero guess.

A backend running a proper model would replace this function and nothing else.

## Why nothing is subtracted from APEX

The intuitive move is `final = technical − newsRisk`. It destroys information.

```
Technical 91 · Direction +2 · News impact 94 · News direction −78
  → subtraction gives "65", which reads as a mediocre setup
  → the truth is "excellent setup, major opposing catalyst — do not trade this normally"
```

Those are different instructions. The first invites a position; the second forbids one.
So the dimensions stay separate and `fuseState()` emits `CONFLICT`. The invariant is
enforced by test, including a source-level check that no subtraction expression exists
inside the fusion function.

## Why statistics show `n` or nothing

The engine stores what it observed — reference prices at event time, then measured
reactions at 5/15/30/60 minutes — and computes median, mean, max, continuation and
reversal frequency from that sample. Below `minSample` (default 8) it returns
`insufficient` rather than a number.

This is why no figure like "70% of first CPI moves reverse" appears anywhere in the
codebase. There is a test asserting that string patterns like it are absent. When the
database has real samples, the number it reports will be the number it measured, with
the sample size next to it.

## Testing

- `test_intel.js` — 50+ assertions: source tiering, rumour handling, dedup, impact/
  direction independence, inverted macro, propagation, decay half-lives, all nine fusion
  states, the no-mutation and no-subtraction invariants, rule-derived calendar, generated
  danger zones, Safe/Pro gating and rejection reasons, and the statistics floor.
- `ui_test2.js` — the real page in Chromium: Market Brain, Danger Zones, Safe/Pro
  switching, Intel tab, calendar honesty notes, statistics provenance, and zero runtime
  errors across the whole flow.

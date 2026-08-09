# FRONTLINE APEX V5 — Market Intelligence OS
## Product specification (source of truth)

Everything downstream — UI, onboarding, docs, and eventually any commercial material —
should be generated from this document rather than written independently.

**Scope note.** This spec deliberately contains **no pricing, no competitor comparison,
and no marketing claims.** Those need benchmarking before they can be written down, and
writing them here would make an unvalidated claim look like a requirement. Statements
like "first in the world", "top 0.1%", or a fixed "CPI reverses 70% of the time" are
excluded on purpose. Where the product needs a statistic, it comes from the measured
event database with its sample size attached, or it is not shown.

**Status legend:** ✅ built in this repo · 🟡 partial · ⬜ needs backend

---

## 0. The architectural boundary

This is the rule everything else hangs off.

```
┌──────────────────────────┐        ┌──────────────────────────────────────┐
│  THINKORSWIM             │        │  FRONTLINE APEX WEB / BACKEND        │
│  technical signal engine │        │  intelligence engine                 │
├──────────────────────────┤        ├──────────────────────────────────────┤
│ ATR, EMA, ADX, RSI       │        │ news ingestion & normalisation       │
│ RelVol, Darvas, Squeeze  │        │ macro calendar                       │
│ SmartFlow proxy          │        │ source verification & dedup          │
│ StableScore              │        │ catalyst scoring                     │
│ APEX / Direction / Conf  │        │ event database & reaction stats      │
│ Timing / Extension       │        │ cross-asset propagation              │
│ Liquidity score          │        │ Market Brain, Danger Zones           │
│ 10 Stock Hacker scans    │        │ alerts, playbooks, Copilot           │
└──────────────────────────┘        └──────────────────────────────────────┘
              └──────────── merged in the APEX UI ────────────┘
```

**No news, calendar, or catalyst logic is ever implemented in ThinkScript.** ThinkScript
cannot reach a news feed, and attempting it produces fabricated data. The one boundary
case is `EarningsRisk.ts` / `V4_DaysToEarnings.ts`, which read ThinkorSwim's own event
calendar — a *scheduled corporate event*, not news.

**No catalyst score ever mutates a technical score.** Not by subtraction, not by
multiplication, not by re-ranking. `fuseState()` takes the technical read as a read-only
input and emits a *state*. This is enforced by test (`test_intel.js`).

---

## 1. The five layers

| Layer | Question it answers | Status |
|---|---|---|
| **1. Market Brain** | What kind of market am I walking into? | ✅ |
| **2. Opportunity Engine** | What is setting up right now? | ✅ |
| **3. Catalyst Intelligence** | What just happened, and who is exposed? | ✅ client-side / ⬜ continuous |
| **4. Risk & Timing** | When does the risk profile change? | ✅ |
| **5. Trader Experience** | Safe/Pro, alerts, playbooks, explanations | 🟡 |

Surfaced to users as six products: **Market Brain · APEX Scanner · Live Intelligence ·
Danger Zones · Catalyst Playbooks · APEX Copilot.** Internal modules sit underneath;
users never see the module count.

---

## 2. Scoring contracts

The eleven dimensions are **independent and never collapsed into one number**.

| Dimension | Range | Owner | Contract |
|---|---|---|---|
| `TECHNICAL_QUALITY` (APEX) | 0–100 | TOS + web | Direction-agnostic. Capped at 72 without 4/6 gates; hard-blocked at 55 on no direction, liquidity <35, or extension >3 ATR. |
| `TECHNICAL_DIRECTION` | −2…+2 | TOS + web | ±2 needs a net of 4 of 6 independent lenses. |
| `TECHNICAL_CONFIDENCE` | 0–100 | TOS + web | Agreement between lenses. Capped at 45 when direction is 0. **Not** bullishness. |
| `TIMING` | −2…+2 | TOS + web | Entry maturity. −2 exhausted … +2 prime. |
| `CATALYST_IMPACT` | 0–100 | web | Market relevance. Decays on a per-category half-life. |
| `CATALYST_DIRECTION` | −100…+100 | web | **Independent of impact.** 0 = ambiguous or pre-release. |
| `CATALYST_CONFIDENCE` | 0–100 | web | Source quality × corroboration × mapping certainty. **Not** bullishness. |
| `EVENT_PROXIMITY` / `MACRO_RISK` | 0–100 | web | Importance × proximity of the nearest scheduled event. |
| `LIQUIDITY_RISK` | 0–100 | TOS + web | Tradeability. **Not** market depth. |
| `VOLATILITY_STATE` | enum | TOS + web | COMPRESSED / NORMAL / ELEVATED / EXTREME, from ATR%. |
| `ALIGNMENT` | enum | web | The fusion state below. |

### Invariants (test-enforced)

1. Impact and direction are separable — a pre-release FOMC scores impact ≥70, direction 0.
2. Fusion never mutates its technical input.
3. No subtraction of news from APEX anywhere in the codebase.
4. A rumour never renders as CONFIRMED.
5. No statistic is displayed below its minimum sample.
6. No calendar date is generated unless it is rule-derivable or explicitly seeded.

---

## 3. Fusion state machine

```
WAITING_FOR_RELEASE      scheduled event ≤60 min out — direction unknown by definition
HIGH_EVENT_RISK          impact ≥80, |direction| <25 — large, undirected
ALIGNED_BULLISH          technical +, catalyst +, catalyst confidence ≥50
ALIGNED_BEARISH          technical −, catalyst −, catalyst confidence ≥50
CONFLICT                 technical and catalyst oppose — do NOT read APEX as normal
POST_EVENT_CONFIRMATION  catalyst landed ≤120 min ago, no qualifying technical setup
CATALYST_ONLY            catalyst present, technical does not qualify
TECHNICAL_ONLY           no material catalyst
NORMAL                   nothing material either side
```

`WAITING_FOR_RELEASE` and `HIGH_EVENT_RISK` are evaluated **first** and dominate: an
imminent release makes every directional read provisional.

---

## 4. Market Brain schema

```ts
MarketBrain {
  marketState: "NORMAL CONDITIONS" | "ELEVATED RISK WINDOW" | "HIGH VOLATILITY"
             | "BREAKING-NEWS DRIVEN" | "HIGH EVENT-RISK ENVIRONMENT" | "CRITICAL EVENT WINDOW"
  apexMode:    "NORMAL OPERATION" | "REDUCED SIZE" | "EVENT PREPARATION"
             | "POST-EVENT PRICE DISCOVERY" | "STAND ASIDE"
  spy | qqq | iwm : { label, value: -2..2 | null, confidence, color }
  confidence:   0-100 | null          // median across scanned tickers
  volatility:   "COMPRESSED"|"NORMAL"|"ELEVATED"|"EXTREME"|"NO READ"
  liquidity:    "NORMAL"|"THIN"|"POOR"|"NO READ"
  newsPressure: -100..100             // impact-weighted mean catalyst direction
  macroRisk:    0-100
  nextCatalyst: CalendarEvent | null
  zone:         { severity: 0-3, labels: string[] }
  zones:        DangerZone[]
  topBreaking:  CatalystEvent[]       // impactNow >= 70
  conflicts:    { ticker, tech, ev, note }[]
  best:         TechnicalRow[]        // apex >= 55, direction != 0
  message:      string                // assembled from what is measurably true
  sampleSize:   number                // ALWAYS shown — a 1-ticker read is not a market read
}
```

`null` and `"NO READ"` are first-class. When SPY is not in the scan, the Brain says so
rather than inventing a bias.

---

## 5. Danger Zone engine

Windows are **generated**, never hardcoded to clock times.

| Kind | Generated from | Severity |
|---|---|---|
| `STRUCTURAL` | Opening 09:30–10:00 ET, close 15:30–16:00 ET | 2 / 1 |
| `PRE_EVENT` | `event.ts − 15min` → `event.ts` | 2 if CRITICAL else 1 |
| `EVENT` | `event.ts` → `+15min` | 3 if CRITICAL else 2 |
| `DISCOVERY` | `event.ts + 15min` → `+45min` | 2 if CRITICAL else 1 |
| `BREAKING` | live catalyst with `impactNow ≥ 70`, 30-min window | 3 if ≥85 else 2 |

The two structural windows are microstructure facts (opening-auction imbalances, the
closing cross), not folklore. Everything else exists only because a specific event exists.
With an empty calendar and no live catalysts, exactly two zones are generated — verified
by test.

---

## 6. Safe / Pro modes

Safe Mode changes **which opportunities are surfaced**, not merely which columns are
visible.

| Gate | SAFE | PRO |
|---|---|---|
| APEX ≥ | 80 | 55 |
| Confidence ≥ | 75 | 0 |
| Liquidity ≥ | 70 | 35 |
| Extension ≤ | 1.25 ATR | — |
| RVOL ≥ | 1.2 | 0 |
| Timing ≥ | 0 | −2 |
| Direction required | yes | no |
| Stands down within | 60 min of a CRITICAL event | never |
| Blocks unverified high-impact headlines | yes | no |

Every rejection carries a machine-readable reason (`_rejectedFor: string[]`), so PRO can
show *why* a setup was hidden in SAFE. Pro is a strict superset — test-enforced.

---

## 7. Catalyst ingestion pipeline

```
SOURCE → INGEST → NORMALIZE → ENTITIES → TICKERS → CATEGORY → DEDUPE
       → VERIFY → IMPACT → DIRECTION → CONFIDENCE → RELEVANCE → ALERT → OVERLAY
```

**Source tiers** — 1 PRIMARY (SEC/Fed/BLS/BEA/Treasury/FDA/exchange/IR) · 2 WIRE ·
3 SECONDARY · 4 SOCIAL · 5 UNVERIFIED. An unknown named source resolves to tier 3, never
tier 1. Rumour *wording* forces tier 5 regardless of outlet.

**Confirmation status** — CONFIRMED / REPORTED / DEVELOPING / RUMOR / UNVERIFIED.

**Dedup** — N outlets reporting one story produce **one** `CatalystEvent` carrying
`sourceCount`, `firstSeen`, `latest`, and every constituent headline. Five outlets never
produce five alerts.

**Categories** — 19, each with a `base` impact ceiling and a `halfLifeMin` decay
constant, from 60 min (market structure) to 4320 min (Fed policy).

**Direction** — explicit surprise data beats keywords. Inflation-family releases invert:
a hot CPI reads bearish for equities. Conflicting keywords damp by `1/√hits`. Forward-
looking phrasing ("ahead of", "due today") forces direction 0.

⬜ **Needs a backend:** continuous polling, more than one wire, entity resolution beyond
the seed map, and cross-device event history.

---

## 8. Alert priority

| Level | Condition |
|---|---|
| **P0 CRITICAL** | `impactNow ≥ 85` and `confidence ≥ 60` |
| **P1 HIGH** | `impactNow ≥ 70`, or watchlist ticker with `≥ 55` |
| **P2 MEDIUM** | `impactNow ≥ 45`, or watchlist ticker with `≥ 30` |
| **P3 INFO** | everything else |

Watchlist and active scanner candidates are scored one band richer than unrelated
symbols. Scheduled events alert on an importance-dependent ladder
(CRITICAL: T-7d, T-1d, T-60m, T-15m, T-0) rather than at every stage.

---

## 9. Event database schema

Implemented against `localStorage` today; the schema is the migration target for a real
store.

```ts
EventRecord {
  key, ts, recorded, category, headline, sourceTier, status
  impact, direction, confidence, tickers[]
  surprise: { actual, consensus, previous, revision } | null
  ref:       { SPY, QQQ, IWM }          // snapshot at event time
  reactions: { m5?, m15?, m30?, m60? }  // % move per symbol, measured
}
```

`reactionStats()` returns `{ n, insufficient: true, minSample }` below the threshold
rather than a number. Continuation/reversal frequencies are computed from the sample and
always reported with `n`. **Nothing is hardcoded.**

⬜ Backend adds: shared history, close-of-day reaction, volatility regime at event time,
technical state before/after, and a sample large enough for per-category playbooks.

---

## 10. API contracts (backend, not yet built)

```
GET  /api/catalysts?since=<ts>&minImpact=<n>   → CatalystEvent[]
GET  /api/calendar?from=<d>&to=<d>             → CalendarEvent[]   (authoritative dates)
GET  /api/brain                                → MarketBrain
GET  /api/stats/reaction?category=&symbol=&mark= → ReactionStats
POST /api/watchlist                            → { tickers[] }
WS   /ws/alerts                                → { priority, event, state }
```

The client already consumes these shapes; wiring a backend is a source swap, not a
rewrite.

---

## 11. What the product must never claim

- It does **not** predict news, or know the outcome of a scheduled release.
- It does **not** detect institutional positioning, dealer gamma, or dark-pool activity
  from price alone. Where this repo shows GEX/dark-pool, that is licensed API data, and
  the ThinkScript layer has no equivalent — `SmartFlow` is a documented proxy.
- It does **not** guarantee outcomes.

The defensible statement is narrower and stronger:

> APEX detects technical setups, identifies the catalysts around them, measures whether
> price action and news agree, and warns when a scheduled or breaking event materially
> changes the setup — before, during, and after.

---

## 12. Build order

1. ✅ Technical engine (FINAL_V4 + JS port)
2. ✅ Catalyst engine, fusion, Market Brain, Danger Zones, Safe/Pro
3. ⬜ Backend: continuous ingestion, authoritative calendar, shared event DB
4. ⬜ Alert delivery (push/email) and watchlist persistence
5. ⬜ Catalyst Playbooks, once the event DB has real sample sizes
6. ⬜ APEX Copilot explanations grounded in stored events

Steps 5 and 6 are **blocked on data volume**, not on engineering. Building playbooks
before the database has samples would mean inventing the statistics, which is the one
thing this architecture is designed to prevent.

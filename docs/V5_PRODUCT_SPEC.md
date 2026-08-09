# FRONTLINE APEX V5 — Market Intelligence OS
## Product specification (source of truth)

Everything downstream — UI, onboarding, docs, and eventually any commercial material —
should be generated from this document rather than written independently.

**Scope note.** This spec contains the commercial structure — tiers, entitlements and
the Stripe mapping — because the application cannot be built without knowing exactly what
each tier unlocks. Prices here are a **launch decision, not a benchmarked claim**.

It deliberately contains **no competitor comparison and no marketing copy.** Those need
benchmarking before they can be written down, and putting them here would make an
unvalidated claim look like a requirement. Statements like "first in the world",
"top 0.1%", or a fixed "CPI reverses 70% of the time" are excluded on purpose. Where the
product needs a statistic, it comes from the measured event database with its sample size
attached, or it is not shown. §13 lists the terminology rules; §19 gives the method for
building a credible competitive table without asserting anything untested.

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

Surfaced to users as seven products: **Market Brain · APEX Scanner · Live Intelligence ·
Danger Zones · Catalyst Playbooks · APEX Copilot · Poly Intelligence.** Internal modules
sit underneath; users never see the module count.

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

---

## 13. Terminology rules

Terms carry claims. These are binding on the UI, the docs and any future copy.

| Do not say | Say instead | Why |
|---|---|---|
| "T-1 predictive alerts" | **event-preparation alerts** | Nothing predicts the release. The alert prepares you for a *scheduled* event. |
| "dark pool proxy" | *(nothing)* — or name the actual inputs | The ThinkScript layer has no dark-pool data. `SmartFlow` is defined as close-location-value × volume, VWAP displacement and relative-volume confirmation, and is labelled a pressure proxy at every appearance. Where genuine dark-pool prints appear in this repo, they are licensed API data. |
| "institutional gamma pressure" | **options / gamma context** — only with a licensed feed | See `license_gated` in `entitlements.json`: disabled in every tier until licensed. |
| "Bloomberg-lite", "institutional intelligence" | describe the capability | Comparative claims need benchmarking. |
| "AI risk overlay", "60 engines" | the six capability names | Users buy capabilities, not module counts. |
| "24-hour delayed signals" (free tier) | **limited, real-time** | Deliberately stale data makes the free tier feel broken instead of promising. Free is capped on breadth (5 symbols, 5 results, 5 alerts), not on freshness. |
| "downgrade protection" | **scheduled downgrade at period end** | That is what Stripe actually does. §18. |
| "guarantees", "predicts the market" | *(nothing)* | §11. |

**Positioning line** (working, still untested):

> **Know the setup. Know the catalyst. Know when the risk changes.**
>
> Frontline APEX combines technical scanning, market-moving events, breaking catalysts,
> volatility, liquidity and historical reaction data so you can understand *why* a setup
> matters — not just that an indicator fired.

---

## 14. The six capabilities

The only product taxonomy that appears in the interface. Every internal module maps into
exactly one of these.

| Capability | The user's question | Backed by |
|---|---|---|
| **Market Brain** | What kind of market am I trading today? | §4 |
| **APEX Scanner** | What is setting up right now? | §2, FINAL_V4 |
| **Live Intelligence** | What just happened and what does it affect? | §7 |
| **Danger Zones** | When is market risk about to change? | §5 |
| **Catalyst Playbooks** | How has the market historically behaved around this event? | §9 |
| **APEX Copilot** | Why is this signal being surfaced? | §2 factor values |
| **APEX Poly Intelligence** | Where is there a modelled edge in prediction markets? | §21 |

---

## 15. Tiers and entitlements

### Billing is OFF during launch

`entitlements.json` carries `billing.mode: "free_launch"`. While that holds, **every user
receives Pro-level entitlements and no Stripe object is required.** The tier matrix below
is fully specified so it can be switched on without redesign — flip `billing.mode` to
`"subscriptions"` once the product has proven itself.

Pro is granted rather than Black on purpose: Pro is the tier whose value has to be proven
(catalyst intelligence, technical/catalyst alignment, Poly). Black carries API access and
export, which have real cost and no demonstration value during a free launch.

**No Stripe objects have been created.** `billing.stripe_objects_created` is `false`, and
it should stay false until the launch decision is made.

Four tiers. Not five — a fifth advanced tier only makes sense once customers demonstrably
split into two advanced segments, and inventing that split before it exists forces
artificial feature gating.

| Plan | Monthly | Annual | Position |
|---|---:|---:|---|
| **Free** | $0 | — | Discover APEX |
| **APEX Core** | $39 | $390 | Technical intelligence |
| **APEX Pro** | $89 | $890 | Full catalyst + market intelligence |
| **APEX Black** | $199 | $1,990 | Advanced analytics + AI |

**Annual is priced at two months free (~17% off).** That convention is near-universal in
subscription software, so it needs no explanation at the point of sale, and it lands on
round numbers — $390 / $890 / $1,990 read better on a pricing card than the $374 / $854 /
$1,910 a flat 20% would produce. It is a launch decision, not a benchmarked one; no
competitor price is asserted anywhere in this repo (§19).

Annual prices are defined in `entitlements.json` and are **inert** while
`billing.mode == "free_launch"`.

### Capability matrix

| | Free | Core | Pro | Black |
|---|---|---|---|---|
| Market Brain | lite | full | full | personalized |
| APEX Scanner | limited | full | full | full |
| Live Intelligence | — | — | full | full |
| Danger Zones | summary | full | full | full |
| Catalyst Playbooks | — | — | full | advanced |
| APEX Copilot | — | — | basic | full |
| Safe / Pro modes | — | ✓ | ✓ | ✓ |
| Macro calendar | ✓ | ✓ | ✓ | ✓ |
| Technical / catalyst alignment | — | — | ✓ | ✓ |
| Event-preparation alerts | — | — | ✓ | ✓ |
| Custom scanner filters | — | — | ✓ | ✓ |
| Poly Intelligence | — | — | full | advanced |
| Portfolio exposure analysis | — | — | — | ✓ |
| Advanced event studies | — | — | — | ✓ |
| Scenario analysis | — | — | — | ✓ |
| API access | — | — | — | ✓ |
| Export | — | — | CSV | CSV + API |

### Limits

| | Free | Core | Pro | Black |
|---|---|---|---|---|
| Data latency | **real-time** | real-time | real-time | real-time |
| Watchlist symbols | 5 | 50 | unlimited | unlimited |
| Scanner results shown | 5 | all | all | all |
| Alerts / day | 5 | 50 | unlimited | unlimited |
| Alert channels | in-app | + email | + push | + webhook |
| Event history | 7d | 30d | 365d | full |
| Brain refresh | 5 min | 60s | 30s | 15s |

**Free is limited, never stale.** It is capped on breadth so a free user still sees the
real product working on live data — which is the only way they learn why it is different.

Machine-readable source of truth: **`docs/entitlements.json`**. The application, the
Stripe configuration and this table all read from it, so they cannot drift.

### Licence-gated features

`options_gamma_context` and `realtime_level2` are defined in `entitlements.json` with
`enabled_anywhere: false`. They stay off in every tier until the underlying data is
licensed. Selling an entitlement that does not run is the fastest way to lose a customer.

---

## 16. Alert logic per tier

Priority is computed by the engine (§8) and then filtered by entitlement.

| Priority | Free | Core | Pro | Black |
|---|---|---|---|---|
| **P0 CRITICAL** | in-app, counts against the 5/day cap | in-app + email | all channels, uncapped | all channels + webhook |
| **P1 HIGH** | watchlist only | in-app + email | all channels | all channels + webhook |
| **P2 MEDIUM** | — | in-app | in-app + email | all channels |
| **P3 INFO** | — | — | in-app | in-app |
| **Event-preparation ladder** | — | — | T-1d, T-60m, T-15m, T-0 | + T-7d and custom rungs |

Anti-spam rules apply at every tier: one alert per deduplicated catalyst event regardless
of how many outlets carried it; one alert per ladder rung, not per stage; and no alert for
an event that only repeats information already delivered.

---

## 17. Backend data requirements

Everything below is what the static client cannot do (see `CATALYST_ARCHITECTURE.md`).

| Requirement | Why | Blocks |
|---|---|---|
| **Authoritative macro calendar** | CPI/PPI/PCE/FOMC/GDP dates are published, not derivable. `MACRO_SEED` ships empty rather than guessing. | Event-preparation alerts, accurate `MACRO_RISK` |
| **Continuous news ingestion** | A browser tab cannot poll while closed. | Live Intelligence as a paid capability |
| **Multi-wire ingestion** | One endpoint cannot corroborate. Confirmation status depends on independent sources. | Source-tier confidence |
| **Shared event database** | localStorage is per-browser; statistics need pooled samples. | Catalyst Playbooks |
| **Reaction capture at close** | The client only measures while open. | Full event studies |
| **Entity resolution** | The seed ticker map is deliberately incomplete. | Coverage beyond large caps |
| **Push delivery** | No service worker / no server. | Pro and Black alert channels |
| **Auth + subscription state** | Entitlements need a server-side check; a client-side flag is not a paywall. | Every paid tier |

**Data licences to settle before the matching entitlement ships:** options/greeks feed
(gamma context), depth feed (level 2), and redistribution terms for any news wire whose
headlines are shown verbatim.

---

## 18. Stripe mapping

Uses Stripe's actual mechanisms and names. No invented product terms.

**Account.** APEX requires its **own Stripe account**, separate from any other business.
Do not build the catalog into an account that already carries an unrelated live product
line — shared accounts mean shared Radar rules, shared payout schedules, shared dispute
history, and a Customer Portal that lists products the customer never bought. Build and
verify in that account's **sandbox** first; only then mirror to live.

**Catalog.** One Product per tier, one recurring monthly Price and one annual Price each,
addressed by `lookup_key` (`apex_core_monthly` / `apex_core_annual`, and the same pattern
for pro and black) so the application never hardcodes a price ID. Free has a Product for
entitlement symmetry and no Price.

**Entitlements.** Use Stripe's Entitlements: define a **Feature** per capability
(`market_brain`, `live_intelligence`, `danger_zones`, `catalyst_playbooks`,
`apex_copilot`, `custom_scanner_filters`, `api_access`, …), attach them to Products as
**Product Features**, and read a customer's **Active Entitlements** at session start.
Feature IDs mirror the keys in `entitlements.json` exactly.

**Upgrades.** Update the subscription item to the new Price with a proration behaviour —
`create_prorations` for immediate access with a prorated charge. Access changes as soon as
the webhook lands.

**Downgrades.** Do **not** apply immediately. Schedule the change for the end of the
current billing period using a Subscription Schedule, so the customer keeps what they paid
for. This is a *scheduled downgrade at period end*, not a product feature with a name.

**Cancellation.** `cancel_at_period_end`, with entitlements remaining active until the
period actually ends.

**Self-serve.** The Stripe Customer Portal handles payment method updates, invoices,
plan changes and cancellation. Configure which Prices the portal may switch between so it
matches this matrix.

**Discounts.** Coupons with Promotion Codes for launch and referral offers. Restrict by
first-time-customer and redemption count where appropriate.

**Trials.** Not applicable during the free launch — the whole product is the trial. When
billing is switched on, a trial on the Pro Price is the correct shape, because the Free
tier alone never demonstrates the catalyst layer. Prefer a length that spans at least one
scheduled macro event; a trial that expires before a single CPI or FOMC print has not
shown the buyer the thing they would be paying for.

### Switching billing on later

1. Create a dedicated APEX Stripe account. Verify the catalog in its **sandbox**.
2. Create Products + monthly/annual Prices with the `lookup_key`s above.
3. Create one Feature per capability, IDs mirroring `entitlements.json`; attach as Product
   Features.
4. Set `billing.stripe_objects_created: true` and record the account id in
   `billing.stripe_account`.
5. Flip `billing.mode` to `"subscriptions"`. Existing free users must be migrated
   deliberately — decide grandfathering **before** the flip, not after.
6. Configure the Customer Portal to switch only between the Prices in this matrix.

**Webhooks to handle:** `customer.subscription.created|updated|deleted`,
`invoice.payment_failed`, `entitlements.active_entitlement_summary.updated`. Entitlement
state is derived from Stripe and cached server-side; the client is never the authority.

**Failed payment.** Dunning through Smart Retries, then downgrade to Free rather than hard
lockout — a user who loses access entirely does not come back.

---

## 19. Competitive positioning method

Do not publish a ✔/✖ table. Score each capability on a scale that admits uncertainty, and
only assert what has been tested:

```
                          APEX      Competitor A   Competitor B
Technical scanning        Strong    Strong         Strong
Real-time news            Strong    Varies         Strong
Macro calendar            Strong    Available      Available
Catalyst/signal fusion    Core      Limited        Limited
Event reaction stats      Core      Varies         Varies
Danger windows            Core      Limited        Limited
Beginner risk mode        Core      Varies         Varies
Signal explanation        Core      Varies         Varies
```

**Strong / Available / Partial / Limited / Varies / Not verified.** "Core" marks a
capability the product is built around. Use "Not verified" wherever the competitor has not
actually been tested — never a bare "no". Competitor pricing is deliberately absent from
this repo: it changes frequently, and a stale number in a spec becomes a stale number in
a sales deck.

The defensible claim is the integration, not per-feature superiority:

> APEX is not trying to beat every competitor at every individual feature. Its
> differentiation is combining technical scanning, catalyst intelligence, event timing and
> risk interpretation into one decision workflow.

---

## 20. Evidence rules

**No testimonial is published until a real customer says it and gives written permission.**
No composite quotes, no illustrative quotes, no "representative of typical feedback".

**No performance claim is published without the underlying sample**, and the sample size
is shown next to the number.

**Alpha before beta.** 20–30 active traders, instrumented on: daily active users, signals
opened per session, Market Brain open rate, alert click-through, watchlist additions,
time-to-first-useful-signal, Safe vs Pro usage, 7- and 30-day retention, free→paid
conversion, cancellation reasons, alert mute rate, false-positive complaints. Then
100–250 public beta. Spend on distribution only after retention holds.

Screenshots of good signals attract users. Retention is the only evidence that the product
created value.

---

## 21. APEX Poly Intelligence

The prediction-market leg. Full detail in `docs/POLY_INTELLIGENCE.md`; the contracts and
invariants are here.

### Hard boundary — V1 is read-only

No private keys, no wallet signing, no order submission, no custody. There is no
execution path in the module and none may be added to it; a test greps for that surface
and fails the build if it appears. Execution, if ever built, is a separate independently
audited subsystem. `entitlements.json` carries `poly_execution` with
`enabled_anywhere: false` — this is architecture, not configuration.

### Scoring contract — eight more independent dimensions

| Dimension | Range | Better | Contract |
|---|---|---|---|
| `POLY_EDGE` | 0–100 | high | Net edge after **all** modelled costs, scaled 0–3¢ |
| `POLY_LIQUIDITY` | 0–100 | high | Book depth at target size + 24h volume |
| `EXECUTION_QUALITY` | 0–100 | high | Spread tightness; passive-fill viability |
| `PAIR_CONFIDENCE` | 0–100 | high | Both legs completable at size; penalised when depth was estimated |
| `INVENTORY_RISK` | 0–100 | **low** | One-sided exposure carried toward resolution |
| `SETTLEMENT_RISK` | 0–100 | **low** | Resolution clarity. **Unknown scores 55, never low.** |
| `CATALYST_RISK` | 0–100 | **low** | Live catalyst on this topic, from §7 |
| `WALLET_QUALITY` | 0–100 | high | Provenance-weighted; unverified claims **reduce** it |

Same rule as everywhere else: kept separate, never collapsed into one number.

### Invariants (test-enforced)

7. No execution, key-handling or signing surface exists in the module.
8. Net edge is always strictly less than raw edge; a thin raw edge resolves NEGATIVE.
9. Realized P&L comes only from pairs that are both **matched and resolved**. Open
   inventory is exposure at cost and is never added to profit.
10. Unverified third-party wallet claims are labelled, never promoted, and never enter a
    score.
11. Unknown resolution terms are never scored optimistically.
12. Probability-vs-catalyst comparison reports CONFIRMS / CONTRADICTS / NEUTRAL and never
    asserts which side is right.

### Cost model

Three scenarios (zero / **conservative, default** / stress), all editable, none quoting a
fee schedule as fact. Every displayed edge names the scenario it used and reports
`survivalPct` — the fraction of raw edge that survived costs.

### Entitlements

Free — none · Core — none · **Pro — full** (pair scanner, temporal pairing, wallet
intelligence) · **Black — advanced** (Paper Lab on supplied fill history, cohort studies,
export).

### Backend requirements

Live market and order-book polling, wallet history with caching, resolution terms, and
historical fills. Until those exist the scanner shows **no markets** rather than
placeholder odds — the engine is complete and unit-tested against injected data, and the
ingest contract is published so an external analysis package can feed it.

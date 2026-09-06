# Low-Float Momentum Ignition V2

A research-only WallStreetHustler engine for detecting developing low-float momentum before a move becomes obviously extended, then ranking the candidates so the strongest *current explosive-potential* setup appears first.

## State machine

`DORMANT -> BUILDING -> ARMED -> IGNITION -> EXTENDED`

- **DORMANT**: insufficient verified participation / scarcity.
- **BUILDING**: abnormal participation is developing.
- **ARMED**: multiple conditions align; watch closely, not a buy command.
- **IGNITION**: high score plus price confirmation above VWAP / opening-range high when available.
- **EXTENDED**: anti-chase gate. A vertical move is not presented as a fresh setup.

## Most-potential-first scanner

The primary low-float list should use `rankMostPotentialFirst()` from `lib/low-float-workday.js`. This creates an `explosivePotentialScore` and sorts the scanner so the name with the strongest combination of fresh ignition state, proximity, float scarcity, RVOL, float turnover, 5-minute acceleration, pre-market turnover, catalyst evidence, option confirmation and squeeze pressure appears first.

The score deliberately penalizes dilution/offering flags, low confidence, wide-risk conditions and especially `EXTENDED_DO_NOT_CHASE`. A name that is already vertical cannot win the list simply because its raw volume is enormous.

`selectMostPotentialCandidate()` returns the single #1 candidate. Every result exposes `potentialIsProbability:false`; this is an ordering score, not a statistical chance of profit.

The existing `priorityScore`, `proximityScore`, core `score`, `confidence`, and empirical probability-calibration rules remain in force. A percentage may be labeled probability only after enough timestamped forward outcomes exist for the relevant score bucket and the outcome definition/sample size are shown.

## Low-float universe

- Nano float: <= 5M shares
- Core low float: <= 10M
- Primary low float: <= 20M
- Extended research universe: <= 50M

For the optionable lane, $5-$20 receives a small ranking preference. `optionableOnly:true` excludes unknown/non-optionable names rather than guessing.

## Evidence inputs

Core: verified public float, price, current volume and 20-day average volume.

Intraday: 5-minute volume and prior 5-minute volume, change, VWAP, opening-range high and day high.

Pre-market: pre-market volume, change and high. The engine derives pre-market float turnover and pre-market-high confirmation.

Catalyst: confirmed catalyst plus age. Price action never invents a catalyst.

Squeeze: sourced short-interest percentage, borrow fee and shortable status when available.

Option/gamma confirmation: verified optionability, option/call/put volume, near-OTM call volume and open interest, option spread, strike distance, DTE and IV when available. Options evidence confirms the stock setup; it does not manufacture ignition by itself.

Risk: offering, dilution, reverse split, spread and halt flags. Offering/dilution flags should be backed by SEC/corporate-action evidence.

## Core calculations

- RVOL = current cumulative volume / 20-day average volume.
- Float turnover = current cumulative volume / public float.
- Pre-market turnover = pre-market volume / public float.
- 5m acceleration = current 5m volume / previous 5m volume.
- VWAP displacement = price / VWAP - 1.
- ORB break = price / opening-range high - 1.
- Near-OTM call volume/OI uses verified near-OTM call volume and prior open interest.

## 9-to-5 / workday text alerts

`buildWorkdayTextAlert()` creates a concise SMS payload for traders who cannot keep the scanner open during work. The text identifies the #1 ranked symbol, state, explosive-potential score, RVOL, float turnover and the next confirmation to watch. It always says the message is a research alert, not a buy signal.

`shouldSendWorkdayText()` is the anti-spam gate. A text is eligible only for **ARMED** or **IGNITION**, not LOW-confidence or EXTENDED setups. After the first text, another message is sent only when the top symbol changes, the state changes, or the explosive-potential score improves materially (currently 8+ points).

Example:

```
WSH 9-TO-5 | #1 ABCD ARMED | Potential 91/100 | RVOL 4.9x | Turnover 0.74x | Next: clear and hold ORH. Research alert, not a buy signal.
```

Actual SMS delivery should be connected only in the canonical production source after production-source recovery and with a configured messaging provider; the current feature branch supplies ranking, gating and message payloads without touching the existing live production backend.

## Recommended scanner display

Show one dominant card first, then the ranked queue:

```
#1 MOST POTENTIAL NOW
Ticker: ABCD
State: ARMED
Explosive Potential: 91/100
Ignition Priority: 88/100
Proximity: 96/100
Core Score: 68/100
Float: 7.8M
RVOL: 4.9x
Float Turnover: 0.74x
5m Acceleration: 2.6x
Catalyst: CONFIRMED
Options: VERIFIED if available
Data Confidence: HIGH
Next proof: clear and hold ORH / VWAP with volume
```

## Production safety

GitHub `main` still does not contain the complete source used by the current CLI-deployed Vercel production application. Production was built from 214 deployment files with a much larger build cache than the GitHub preview. Do not promote this branch over the production domains until that canonical source is recovered/synchronized and parity-tested.

The current repository also lacks complete verified public float, intraday/pre-market bars, borrow/short data, SEC dilution flags and option-chain fields. Missing fields remain missing; the engine does not fabricate them.

## Alert policy

Only meaningful ARMED/IGNITION changes should notify. EXTENDED is explicitly anti-chase. Alerts use **review**, **watch**, **armed**, **ignition**, or **setup changed** language and never guarantee an outcome or tell a user to buy.
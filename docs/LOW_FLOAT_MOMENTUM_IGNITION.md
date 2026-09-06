# Low-Float Momentum Ignition V2

A research-only WallStreetHustler engine for detecting *developing* low-float momentum before a move becomes obviously extended, then ranking the candidates so the closest/highest-quality setup appears first.

## State machine

`DORMANT -> BUILDING -> ARMED -> IGNITION -> EXTENDED`

- **DORMANT**: insufficient verified participation / scarcity.
- **BUILDING**: low-float candidate with improving abnormal participation.
- **ARMED**: multiple conditions align; watch closely, not a buy command.
- **IGNITION**: high score plus price confirmation above VWAP / opening-range high when those inputs are available.
- **EXTENDED**: anti-chase gate. A vertical move can have a high raw score but should not be presented as a fresh setup.

## One-scanner ranking

`rankLowFloatCandidates()` sorts by a dedicated **Ignition Priority Score**, then proximity, then core score and float turnover. `selectTopLowFloatCandidate()` returns the single first result.

Each row exposes:

- `rank`
- `topPick`
- `priorityScore` — 0-100 ordering score
- `proximityScore` — how close the candidate is to its next valid state
- `score` — core low-float ignition evidence score
- `confidence` — HIGH / MEDIUM / LOW based on missing inputs
- `probabilityStatus: UNTRAINED_NOT_A_PROBABILITY`

The priority score is deliberately **not** called a win probability. A statistical probability should only be published after enough timestamped forward observations exist to calibrate score buckets against actual outcomes.

## Low-float universe

- Nano float: <= 5M shares
- Core low float: <= 10M
- Primary low float: <= 20M
- Extended research universe: <= 50M

For the optionable lane, $5-$20 receives a small ranking preference because that range often balances share scarcity with usable option markets. It is a preference, not a hard rule.

## Required / preferred inputs

### Core evidence
- `price`
- `floatShares` — verified public float, never estimated from volume
- `volume`
- `avgVolume20`

### Intraday ignition
- `volume5m`, `priorVolume5m`
- `changePct`, `change5mPct`
- `vwap`
- `openingRangeHigh`
- `dayHigh`

### Pre-market
- `preMarketVolume`
- `preMarketChangePct`
- `preMarketHigh`

The engine calculates pre-market float turnover and whether price has cleared the pre-market high.

### Catalyst
- `catalystConfirmed`
- `catalystAgeMinutes`

Do not infer a catalyst from price action. If news/filing data is unavailable, leave it false/unknown.

### Squeeze pressure
- `shortInterestPct`
- `borrowFeePct`
- `shortable`

These must be sourced. They are optional and add no points when unavailable.

### Optionable / gamma-confirmation lane
- `optionable`
- `optionVolume`
- `callVolume`, `putVolume`
- `nearOtmCallVolume`
- `nearOtmCallOpenInterest`
- `optionSpreadPct`
- `nearestOtmStrikePct`
- `daysToExpiry`
- `impliedVolatilityPct`

Options activity is a **confirmation layer**, not the source of the stock ignition score. The engine looks for verified near-OTM call-volume concentration, volume/OI expansion, nearby strikes and short DTE, while penalizing unusable option spreads. It never assumes that call volume equals bullish opening flow.

`rankLowFloatCandidates(rows, { optionableOnly:true })` restricts the list to names explicitly verified as optionable. Unknown optionability is excluded rather than guessed.

### Dilution / execution risk
- `offeringRisk`
- `dilutionRisk`
- `reverseSplitRisk`
- `spreadPct`
- `haltCount`

Offering/dilution flags should be backed by SEC filing/corporate-action data rather than keyword guesses alone.

## Core calculations

- **RVOL** = current cumulative volume / 20-day average volume.
- **Float turnover** = current cumulative volume / public float.
- **Pre-market turnover** = pre-market volume / public float.
- **5m volume acceleration** = current 5m volume / previous 5m volume.
- **VWAP displacement** = price / VWAP - 1.
- **ORB break** = price / opening-range high - 1.
- **Near-OTM call volume/OI** = near-OTM call volume / prior open interest when both are verified.

## Core ignition score

100-point pre-penalty stock model:
- Float scarcity: 20
- RVOL: 20
- Float turnover: 15
- 5m volume acceleration: 10
- Price/VWAP/ORB structure: 15
- Fresh verified catalyst: 10
- Verified short/borrow pressure: 10

Pre-market evidence and option/gamma evidence influence the separate **priority ranking**, so weak or missing options data cannot manufacture an ignition state.

Penalties apply for offering/dilution/reverse-split risk, wide stock spreads, repeated halts, sub-$0.50 names, wide option spreads, and anti-chase extension.

## Recommended scanner display

Show one dominant card first, then the ranked queue:

```
#1 TOP IGNITION CANDIDATE
Ticker: ABCD
State: ARMED
Ignition Priority: 91/100
Core Score: 68/100
Proximity: 96/100
Float: 7.8M
RVOL: 4.9x
Float Turnover: 0.74x
5m Volume Acceleration: 2.6x
VWAP: +1.8%
ORB: 0.3% below trigger
Catalyst: CONFIRMED
Options: VERIFIED / near-OTM call activity elevated
Dilution Risk: LOW / VERIFIED
Data Confidence: HIGH
Next proof: hold above ORH with volume
```

This answers the product question directly: **which low-float name is highest quality and closest to ignition right now?**

## Data integration requirement

The GitHub `main` repository currently exposes `api/bars.js`, which supplies daily OHLCV and does **not** supply verified public float, intraday VWAP/5m bars, borrow data, SEC dilution flags, or complete option-chain metrics. The engine therefore reports missing fields rather than inventing them.

The current Vercel production deployment is a materially newer CLI-deployed application than GitHub `main`: production built from **214 deployment files** and a roughly **22.43 MB build cache**, while the current GitHub preview build is roughly **1.20 MB**. Do not promote a GitHub preview over production until the CLI-deployed production source is recovered/synchronized into version control.

To activate the full engine in the production scanner, the canonical production source must first be synchronized, then connect verified providers for:
1. reference/fundamental data (public float / shares outstanding / market cap),
2. intraday 1m or 5m bars/trades and pre-market volume,
3. news + SEC filings/corporate actions,
4. short interest / borrow availability when licensed,
5. optionability and option-chain volume/OI/spread/expiry data when licensed.

The UI should display source timestamps and degrade confidence when fields are unavailable.

## Alert policy

Only `ARMED` and `IGNITION` are alert eligible. `EXTENDED` is explicitly anti-chase. Alerts should say **review**, **watch**, or **setup changed**, never guarantee an outcome or say a user should buy.
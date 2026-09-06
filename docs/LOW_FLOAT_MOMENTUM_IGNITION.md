# Low-Float Momentum Ignition V1

A research-only WallStreetHustler engine for detecting *developing* low-float momentum before a move becomes obviously extended.

## State machine

`DORMANT -> BUILDING -> ARMED -> IGNITION -> EXTENDED`

- **DORMANT**: insufficient verified participation / scarcity.
- **BUILDING**: low-float candidate with improving abnormal participation.
- **ARMED**: multiple conditions align; watch closely, not a buy command.
- **IGNITION**: high score plus price confirmation above VWAP / opening-range high when those inputs are available.
- **EXTENDED**: anti-chase gate. A vertical move can have a high raw score but should not be presented as a fresh entry.

## Inputs

### Required for high confidence
- `price`
- `floatShares` — verified public float, never estimated from volume
- `volume`
- `avgVolume20`

### Intraday confirmation
- `volume5m`, `priorVolume5m`
- `changePct`, `change5mPct`
- `vwap`
- `openingRangeHigh`
- `dayHigh`

### Catalyst
- `catalystConfirmed`
- `catalystAgeMinutes`

Do not infer a catalyst from price action. If news/filing data is unavailable, leave it false/unknown.

### Supply / squeeze pressure
- `shortInterestPct`
- `borrowFeePct`
- `shortable`

These must be sourced. They are optional and add no points when unavailable.

### Dilution / execution risk
- `offeringRisk`
- `dilutionRisk`
- `reverseSplitRisk`
- `spreadPct`
- `haltCount`

Offering/dilution flags should eventually be backed by SEC filing/corporate-action data rather than keyword guesses alone.

## Core calculations

- **RVOL** = current cumulative volume / 20-day average volume.
- **Float turnover** = current cumulative volume / public float.
- **5m volume acceleration** = current 5m volume / previous 5m volume.
- **VWAP displacement** = price / VWAP - 1.
- **ORB break** = price / opening-range high - 1.

## Score

100-point pre-penalty model:
- Float scarcity: 20
- RVOL: 20
- Float turnover: 15
- 5m volume acceleration: 10
- Price/VWAP/ORB structure: 15
- Fresh verified catalyst: 10
- Verified short/borrow pressure: 10

Penalties are applied for offering/dilution/reverse-split risk, wide spreads, repeated halts, sub-$0.50 names, and anti-chase extension.

## Low-float bands

- Nano float: <= 5M shares
- Primary low float: <= 20M
- Extended candidate universe: <= 50M

These are research bands, not claims that a small float predicts a price increase.

## Data integration requirement

The existing `api/bars.js` supplies daily OHLCV and does **not** supply verified public float, intraday VWAP/5m bars, borrow data, or SEC dilution flags. Therefore the engine deliberately reports missing fields rather than inventing them.

To activate the full engine in the production scanner, wire verified providers for:
1. reference/fundamental data (public float / shares outstanding / market cap),
2. intraday 1m or 5m bars/trades,
3. news + SEC filings/corporate actions,
4. short interest / borrow availability when licensed.

The UI should display source timestamps and degrade confidence when fields are unavailable.

## Alert policy

Only `ARMED` and `IGNITION` are alert eligible. `EXTENDED` is explicitly anti-chase. Alerts should say **review**, **watch**, or **setup changed**, never guarantee an outcome or say a user should buy.

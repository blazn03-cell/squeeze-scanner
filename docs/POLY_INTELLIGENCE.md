# Poly Intelligence

The prediction-market leg of Squeeze Scanner. Research, analytics and paper strategy — **not** a
trading client.

## The boundary, first

**V1 is read-only.** No private keys, no wallet signing, no order submission, no custody.
There is no execution path in the Poly engine and none may be added to it. A test asserts
the absence of that surface — it greps the module for private-key, signing and
order-submission patterns and fails the build if any appear.

If execution is ever built, it belongs in a separate, independently audited subsystem
with its own threat model. Mixing analytics and execution in one module is how research
tools quietly become something nobody reviewed.

```js
const POLY_NO_EXECUTION = Object.freeze({
  privateKeys: false, signing: false, orderSubmission: false, custody: false,
});
```

## Why costs are a dial and not a number

Nothing here quotes a fee schedule as fact. Fee terms change and vary by market, so the
module ships three **scenarios** and defaults to the conservative one:

| Scenario | Entry (per side) | Settlement | Safety margin |
|---|---|---|---|
| Zero fees (VERIFY) | 0 bps | 0 bps | 0.25¢ |
| **Conservative** (default) | 50 bps | 50 bps | 0.50¢ |
| Stress | 100 bps | 100 bps | 0.75¢ |

Verify against current market terms before trusting any edge computed on the zero
scenario. The default is deliberately not zero.

## Pair edge

The naive check is `YES + NO < $1.00`. That number is not tradeable.

```
NET EDGE = $1.00
         − YES acquisition cost      (walked through the book, not the top quote)
         − NO acquisition cost
         − entry fees
         − settlement fees
         − estimated slippage
         − safety margin
```

Worked example, conservative costs, 500 shares per side:

```
YES ask            $0.463
NO ask             $0.501
RAW PAIR COST      $0.964
RAW EDGE            3.60¢
− est. fees         1.00¢
− est. slippage     0.63¢
− safety buffer     0.50¢
NET EDGE            1.62¢     ← 45% of the raw edge survived
```

A 0.3¢ raw edge on the same model lands at **−1.70¢** and is reported as
`NEGATIVE AFTER COSTS`. That case is unit-tested, because it is the one the naive check
gets wrong.

**`survivalPct`** — what fraction of the raw edge survives — is shown next to every net
edge. It is the fastest way to see whether an opportunity is real or an artefact of
ignoring costs.

### Slippage

When order-book depth is supplied, the engine **walks the book** for the target size and
uses the achieved average price, reporting any shortfall. Without depth it estimates from
half the quoted spread scaled by size, and labels itself `ESTIMATED` so you know which
you are looking at. Pair confidence is penalised when the estimate is used.

## The eight dimensions

Kept separate. No single mystery number.

| Dimension | 0-100 | Reads |
|---|---|---|
| `POLY EDGE` | higher better | net edge after all modelled costs |
| `LIQUIDITY` | higher better | book depth at target size + 24h volume |
| `EXECUTION QUALITY` | higher better | spread tightness — how viable passive fills are |
| `PAIR CONFIDENCE` | higher better | can both legs actually complete at size |
| `INVENTORY RISK` | **lower better** | one-sided exposure carried toward resolution |
| `SETTLEMENT RISK` | **lower better** | resolution clarity |
| `CATALYST RISK` | **lower better** | live catalyst on this topic, from the news engine |
| `WALLET QUALITY` | higher better | provenance-weighted, for wallet analysis |

**Unknown resolution terms score 55, not low.** An unknown is not a good outcome, and
scoring it optimistically is how a settlement dispute becomes a surprise.

### States

`STRONG PAIR OPPORTUNITY` · `QUALIFIED` · `MARGINAL AFTER COSTS` ·
`NEGATIVE AFTER COSTS` · `INSUFFICIENT LIQUIDITY` · `LIVE CATALYST ON THIS MARKET` ·
`RESOLUTION TERMS UNCLEAR`

Catalyst and settlement checks are evaluated **before** edge, because a real edge on a
market that is about to reprice — or may not settle cleanly — is not an opportunity.

## Temporal pairing

The strategy class this models does **not** buy both sides at the same instant. It
accumulates each leg at different moments and completes the pair only when combined
economics work. `reconstructPair()` takes a fill list and returns:

```
10:31:14  BUY YES  0.44 × 200
10:36:02  BUY YES  0.43 × 300
10:42:18  BUY NO   0.52 × 250
10:45:09  BUY NO   0.51 × 250

Weighted YES   0.4340
Weighted NO    0.5150
Combined       0.9490
Matched        500
Completion     13m
Net per pair   +5.10¢   (zero-fee scenario)
Pair complete  YES
```

Unmatched quantity is reported with its side, so a half-built pair is never mistaken for
a finished one.

## Paper Lab — the accounting rule

**Realized P&L comes only from pairs that are both matched and resolved.** Open inventory
is reported separately as exposure at cost and is never added to profit.

This is the single most important line in the module. Counting incomplete pairs as
realized profit inflates a backtest by an arbitrary amount, and the inflation is invisible
because the equity curve still looks smooth. Four tests enforce it:

- a matched-but-unresolved pair contributes **exactly 0** to realized P&L
- …and appears in `openInventory` instead
- …and does not increment `completedPairs`
- mixing resolved and unresolved pairs does not change the realized figure

A one-sided leg is likewise exposure, never profit.

```
Realized P&L      from completed + resolved pairs only
Fees              modelled per scenario
Slippage          modelled per fill
Max drawdown      on the realized equity curve
Open inventory    legs / shares / cost basis — exposure, NOT profit
```

## Wallet intelligence — provenance over claims

Every metric carries a provenance label:

| Label | Meaning |
|---|---|
| **OBSERVED** | Read directly from public market/chain data |
| **CALCULATED** | Arithmetic on observed data. Reproducible. |
| **INFERRED** | Pattern-detected. Model-dependent — a different model may disagree. |
| **UNVERIFIED** | Third-party claim that could not be independently reproduced. Not evidence. |

Figures that circulate publicly for well-known wallets — win rate, risk/reward, Sharpe —
are shown as **UNVERIFIED** with their source named. They are never promoted to facts and
never enter any score. Presenting an unverified claim alongside observed data **reduces**
`walletQuality` rather than raising it, which is the correct incentive.

Maker/taker ratio is **INFERRED**, not observed — public data does not always mark it, and
saying otherwise would overstate what is known.

## Fusion with the catalyst engine

Markets are topic-matched (fed, inflation, crypto, election, geopolitics, equity) to live
catalyst events. A high-impact Fed headline raises `CATALYST RISK` on rate *and* crypto
markets — rate expectations demonstrably move both — and blocks a pair at ≥70.

`probabilityConfirmation()` compares a probability move against the catalyst's own
direction read:

```
BREAKING  Fed official signals slower cuts   (news direction −70, impact 88)
POLY      Next Fed Cut YES   62% → 49%       (−13 points)
VERDICT   CONFIRMS
```

`CONFIRMS` / `CONTRADICTS` / `NEUTRAL` — and it never claims which one is right. A
contradiction means one of them is wrong; the tool's job is to show you that, not to
resolve it.

This is what makes the tab more than odds: **financial markets → news → prediction
markets → technical scanner**, with the disagreements visible.

## Ingest contract

The engine is data-source agnostic and fully unit-tested against injected data. This
build ships **without** a live connection — a static page has no server to poll public
market data on a schedule — so the scanner shows *no markets* rather than placeholder
odds.

```ts
Market {
  question: string
  yesProb?: number                 // 0..1
  yes: { bid?, ask, asks?: [{price, size}] }
  no:  { bid?, ask, asks?: [{price, size}] }
  volume24h?: number
  resolvesAt?: number              // epoch ms
  resolutionClarity?: "CLEAR" | "AMBIGUOUS"   // omit for unknown → scores 55
}

Fill { ts: number, side: "YES"|"NO", price: number, size: number }

Pair { fills: Fill[], resolved: boolean, resolvedAt?: number, slippagePerShare?: number }

WalletRaw {
  address, strategy, pnl, tradeCount, marketCount, avgPositionSize,
  makerRatio, pairFrequency, avgPairCompletionMs, directionalExposure,
  inventoryRotation, drawdownEstimate,
  claimedWinRate?, claimedRR?, claimedSharpe?, claimSource?   // → UNVERIFIED
}
```

An existing Python analysis package (`wallet_analyzer.py`, `pattern_detector.py`,
`temporal_pairing.py`, backtester) can feed these shapes directly — that package is **not
in this repository**, so the contract above is the integration point.

## Backend requirements

| Needed for | Why |
|---|---|
| Live market + order book polling | A browser tab cannot poll while closed |
| Wallet history | Rate-limited, needs caching and pagination |
| Resolution terms | Drives settlement risk; unknown scores mid |
| Historical fills | Paper Lab on real data rather than sample fills |

## What this does not claim

- It does not predict resolution.
- It does not detect manipulation or insider activity.
- A modelled edge is not a guaranteed one — prediction markets can resolve against you in
  full, and the model's costs are assumptions you chose.
- It does not verify third-party performance claims. It labels them.

# Watchlist layout and interpretation

## Column order

Left to right, so the decision resolves as your eye moves:

```
Symbol │ Last │ V4_APEX │ V4_DIR │ V4_CONF │ V3_StableScore │ V4_Confirmed │ V4_Early
       │ V3_ModelATRpct │ RelVol30 │ RelVol30Intraday │ DarvasScan │ DarvasBias
       │ SqueezeHit% │ SqueezeState │ SmartFlow │ BidAskSpread │ Earnings │ V4_Regime
```

Sort on **V4_APEX** descending. Everything else is context for the top rows.

## Interpretation tables

### V4_APEX — 0-100
| Value | Meaning |
|---|---|
| 85-100 | Elite. Rare. |
| 75-84 | Very strong. |
| 65-74 | Strong. |
| 55-64 | Acceptable. |
| 40-54 | Below average. |
| 0-39 | Weak. |

Capped at 72 unless 3 of 4 gates pass, so a 73+ always has breadth behind it.

### V4_DIR — −2 … +2
`+2` strong bull · `+1` bull · `0` neutral · `−1` bear · `−2` strong bear.
`±2` requires a net of 4 of 6 lenses. **A high APEX with `−2` is a high-quality short.**

### V4_CONF — 0-100
| Value | Meaning |
|---|---|
| 85-100 | Near-unanimous. |
| 70-84 | Strong agreement. |
| 55-69 | Mixed but leaning. |
| 40-54 | Conflicted. |
| 0-39 | No read. |
Capped at 45 whenever DIR is 0 — the COIN FLIP rule. On daily aggregation the ceiling is
~96 rather than 100, because the VWAP lens is unavailable.

### V3_StableScore — 0-100
`0-39` weak · `40-54` below average · `55-64` acceptable · `65-74` strong ·
`75-84` very strong · `85-100` elite. Capped at 74 without 3 strong buckets.

### V4_Confirmed — 0-4
`0` no setup (or liquidity floor failed) · `1` watch · `2` developing · `3` confirmed ·
`4` apex. Counts *breadth* of confirmation, not magnitude.

### V4_Early — 0-100
`75-100` prime window · `60-74` building · `45-59` mid · `<45` late or nothing.
**Read against APEX**: high APEX + low Early = the move already happened.

### V3_ModelATRpct — percent
`<1.0` low movement · `1.0-2.0` moderate · `2.0-3.0` active · `3.0-5.0` strong range ·
`5.0+` extreme/risky.

### RelVol30 / RelVol30Intraday — ratio
`<0.75` weak · `0.75-1.00` normal · `1.00-1.50` elevated · `1.50-2.00` strong ·
`2.00-3.00` very strong · `3.00+` exceptional.
Use **RelVol30Intraday** during the session — plain RelVol30 understates on a bar that
is still forming.

### DarvasScan — event state
`3` confirmed breakout · `2` breakout · `1` approaching (within 1 ATR, RelVol ≥ 1) ·
`0` inside box · `−1` breakdown · `−2` confirmed breakdown.

### DarvasBias — structural posture
`+2` strong bullish · `+1` bullish · `0` neutral · `−1` bearish · `−2` strong bearish.
**Bias +2 with Scan 0** = coiled inside the box near the top. That divergence is a setup,
not a contradiction.

### SqueezeHit% / SqueezeState
Hit is 0-100 setup quality. State: `2` squeeze active · `1` firing (released ≤3 bars) ·
`−1` post-squeeze momentum (4-10 bars) · `0` none.
The tradeable combination is **State 1 with Hit ≥ 65**.

### SmartFlow — −100 … +100
`<−60` extreme selling · `−60…−25` selling · `−25…+25` neutral · `+25…+60` buying ·
`>+60` extreme buying. **Proxy, not order flow** — see `PROJECT_AUDIT.md`.

### BidAskSpread — percent of midpoint
`<0.10` excellent · `0.10-0.25` good · `0.25-0.50` acceptable · `0.50-1.00` poor ·
`>1.00` dangerous. Blank outside market hours.

### Earnings — 0-3
`0` no near-term risk · `1` approaching (≤10 trading days, or estimated from cycle) ·
`2` very close (≤3) · `3` today/imminent. Level 1 may be an estimate — verify.

### V4_Regime — 0-6
`0` CHOP · `1` TREND · `2` BREAKOUT · `3` SQUEEZE · `4` REVERSAL · `5` HIGH VOL ·
`6` LOW VOL. The word is printed by `STUDIES/V4_Dashboard.ts` on the chart, and by the
🧮 V4 grid on the web dashboard.

## Which scan for which job

| Scan | Run it when |
|---|---|
| `V4_MASTER_SCAN` | You have five minutes. Union of every path. |
| `V4_APEX_LONG_SCAN` | Looking for longs, want confirmation over earliness. |
| `V4_APEX_SHORT_SCAN` | Same, short side. |
| `V4_EARLY_ENTRY_SCAN` | Scanner lag is your problem. Accepts lower quality, rejects extension. |
| `V4_BREAKOUT_SCAN` | Working Darvas levels specifically. |
| `V4_SQUEEZE_FIRE_SCAN` | Trading compression releases. |
| `V4_HIGH_RVOL_SCAN` | Hunting unusual participation, spike-filtered. |
| `V4_MOMENTUM_SCAN` | Continuation on names already moving cleanly. |
| `V4_REVERSAL_SCAN` | Fading exhaustion. Highest false-positive family — do not loosen it. |
| `V4_STABLE_SCAN` | Plain quality filter, direction agnostic. |

## Daily workflow

1. Pre-market: `V4_MASTER_SCAN` on Daily. Note the top 10 by APEX.
2. 09:30-10:00: no entries (the existing playbook rule). Switch columns to 15m.
3. 10:00+: `V4_EARLY_ENTRY_SCAN` on 15m for names not yet extended.
4. Before sizing: check **BidAskSpread** < 0.25% and **Earnings** = 0.
5. Open the web dashboard, hit **🧮 V4**, and compare. The grid runs the same model on
   5-minute bars, next to the sweep / dark-pool / GEX columns that ThinkorSwim cannot
   see. Agreement between the two — V4 structure *and* options flow pointing the same
   way — is the highest-conviction state available in this project. Disagreement is also
   information: it usually means positioning is building before price has moved, which
   is precisely what `V4_Early` is trying to catch.

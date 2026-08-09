# Watchlist layout and interpretation

## Column order

Left to right, so the decision resolves as your eye moves:

```
Symbol │ Last │ V4_Score │ V4_DIR │ V4_CONF │ V4_TIMING │ V3_StableScore │ V4_Early
       │ V4_Confirmed │ V3_ModelATRpct │ RelVol30 │ RelVol30Intraday │ DarvasScan
       │ DarvasBias │ SqueezeHit% │ SqueezeState │ SmartFlow │ V4_EXTENSION
       │ V4_LIQUIDITY_SCORE │ BidAskSpread │ Earnings │ V4_DaysToEarnings │ V4_Regime
```

Sort on **V4_Score** descending. Everything else is context for the top rows.

## Decision hierarchy

Work down this list. Stop as soon as a row fails one — do not talk yourself past it.

1. **SCORE** — is it worth looking at?
2. **DIR** — which side? `0` means skip, whatever else the row says.
3. **CONF** — do the lenses agree?
4. **TIMING** — is the move still available?
5. **STABLE** — is the underlying setup actually good?
6. **RVOL** — is anyone there?
7. **ATR%** — is there enough range to pay for the risk?
8. **DARVAS** — where is it against structure?
9. **FLOW** — which way is pressure leaning?
10. **LIQUIDITY / SPREAD** — can you get out?
11. **EARNINGS** — is there an event about to invalidate all of the above?

## Interpretation tables

### V4_Score — 0-100
| Value | Meaning |
|---|---|
| 85-100 | Elite. Rare. |
| 75-84 | Very strong. |
| 65-74 | Strong. |
| 55-64 | Acceptable. |
| 40-54 | Below average. |
| 0-39 | Weak. |

Capped at 72 unless 4 of 6 gates pass, and hard-blocked at 55 when direction is 0, liquidity is under 35, or extension exceeds 3 ATR. A 73+ always has breadth behind it.

### V4_DIR — −2 … +2
`+2` strong bull · `+1` bull · `0` neutral · `−1` bear · `−2` strong bear.
`±2` requires a net of 4 of 6 lenses. **A high SCORE with `−2` is a high-quality short.**

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
`4` elite. Counts *breadth* of confirmation, not magnitude.

### V4_TIMING — −2 … +2
`+2` prime · `+1` early · `0` neutral · `−1` extended · `−2` exhausted.
This is the "is it still catchable" column. **A high SCORE with −1 or −2 is a setup you
have already missed.**

### V4_Early — 0-100
`75-100` strong transition · `60-74` building · `45-59` mild · `<45` nothing changing.
This scores **change**, not strength: a stock that has been strong for weeks scores near
zero here, correctly. Timing and Early answer different questions and will disagree —
Early asks "is something starting?", Timing asks "is it still available?"

### V4_EXTENSION — ATR units
`<0.50` normal · `0.50-1.00` active · `1.00-1.50` extended · `1.50-2.00` highly extended ·
`>2.00` chase risk. Measured from the nearer of the 21 EMA and session VWAP. Above
**3.00** SCORE is hard-blocked.

### V4_LIQUIDITY_SCORE — 0-100
`80+` excellent · `65-79` good · `50-64` acceptable · `35-49` marginal · `<35` blocks SCORE.
Dollar volume, price level, participation and turnover. **Not market depth.**

### V4_DaysToEarnings — trading days
Blank means the calendar had nothing — **unknown, not safe**. Run on Day aggregation only;
the value is in bars, so on 4h it counts 4h bars.

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
| `V4_LONG_SCAN` | Looking for longs, want confirmation over earliness. |
| `V4_SHORT_SCAN` | Same, short side. |
| `V4_EARLY_ENTRY_SCAN` | Scanner lag is your problem. Accepts lower quality, rejects extension. |
| `V4_BREAKOUT_SCAN` | Working Darvas levels specifically. |
| `V4_SQUEEZE_FIRE_SCAN` | Trading compression releases. |
| `V4_HIGH_RVOL_SCAN` | Hunting unusual participation, spike-filtered. |
| `V4_MOMENTUM_SCAN` | Continuation on names already moving cleanly. |
| `V4_REVERSAL_SCAN` | Fading exhaustion. Highest false-positive family — do not loosen it. |
| `V4_STABLE_SCAN` | Plain quality filter, direction agnostic. |

## Daily workflow

Daily is the default and the ceiling; the target holding period is 1-3 days, stretching
to a couple of weeks on the cleanest trends. Use 4h when you want the same system to move
faster, and accept that it gets jumpier.

1. Pre-market: `V4_MASTER_SCAN` on **Daily**. Note the top 10 by SCORE.
2. 09:30-10:00: no entries (the existing playbook rule).
3. `V4_EARLY_ENTRY_SCAN` on Daily for names not yet extended — or 4h for the faster read.
   Drop to 15m only to time an entry on a name you already chose, never to scan.
4. Before sizing: **TIMING** ≥ 0, **BidAskSpread** < 0.25%, **Earnings** = 0.
5. Open the web dashboard, hit **🧮 V4**, and compare. The grid runs the same model on
   5-minute bars, next to the sweep / dark-pool / GEX columns that ThinkorSwim cannot
   see. Agreement between the two — V4 structure *and* options flow pointing the same
   way — is the highest-conviction state available in this project. Disagreement is also
   information: it usually means positioning is building before price has moved, which
   is precisely what `V4_Early` is trying to catch.

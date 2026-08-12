# Options-trading scope and decision gate

## What the scanner actually detects

The free daily-bar path evaluates the underlying security using price, volume, volatility, trend, squeeze, Darvas, RSI, MFI, Bollinger, Ichimoku and related technical conditions. Those measurements cannot determine whether a particular option contract is liquid, fairly priced or suitable.

The optional options-flow path may add reported contract activity when a licensed feed is connected. Flow is context, not proof of future direction.

The free path may label an objective price/volume flush proxy, but it must never call that a gamma flush. In this implementation, a gamma-flush evidence label requires all three of these inputs: recent ask-side put flow, short-gamma GEX, and falling underlying price. Short gamma can amplify both rising and falling moves because dealer hedging follows the move; long gamma generally dampens moves by selling rallies and buying dips.

## Two gates, not one

### Gate A — underlying setup

1. The daily V3/V4 workflow passes.
2. Confirmation count is at least 4 of 5.
3. Model ATR is below the frozen 4% cap.
4. On a regular-hours 5-minute or 15-minute chart, the completed alert bar holds VWAP and the required Darvas break without exceeding the extension limit.
5. Earnings/event risk is checked independently.

### Gate B — option contract

Before a paper entry, record the exact contract identity: underlying, expiry, strike and call/put. Then require all of the following from a current options quote source:

- real bid and ask (not stock spread), with a non-crossed market;
- contract spread percentage within the tester's pre-registered limit;
- sufficient contract volume and open interest;
- no missing or stale quote timestamp;
- intended DTE and moneyness documented;
- premium at risk fits the account without rounding a zero-contract result up to one;
- earnings and assignment/exercise risk acknowledged.

If Gate B data are unavailable, the system has found an underlying candidate only. It has **not** produced an actionable option trade.

## Small accounts ($100–$1,000)

The current historical affordability work was based on whole shares and does not establish options affordability. A single contract controls 100 shares, while the maximum loss for a long option is normally the debit paid plus transaction costs. Do not reuse the share-sizing output as a contract count.

For the public beta, contract sizing is deliberately manual and fail-closed:

```text
contracts = floor(max_dollar_risk / (option_debit * 100 + estimated_costs))
```

If this returns zero, the correct result is **skip**. Actionable short/naked options and undefined-risk combinations are outside the current system. The beginner screen may explain cash-secured puts and bull put spreads, but it does not validate or submit either strategy.

## Alert timing (America/Chicago)

- 5-minute chart: earliest evaluation around 8:50 a.m. CT.
- 15-minute chart: earliest evaluation around 9:00 a.m. CT.
- Final eligibility boundary: 2:30 p.m. CT.
- The alert is evaluated from a completed bar; audible delivery may be later and actual receipt time must be logged.

An alert is a rules match, not confirmation that the trade is “right.” Forward outcomes, costs and adverse excursion must be measured after every eligible signal.

## Position sizing in the app

The simple view asks how much money the reader is using and how much they are
willing to lose on one trade. It converts that into a **maximum long-option
premium**, not a share count:

```text
maximum premium = option budget × maximum loss percentage
maximum displayed option ask for one contract = maximum premium / 100
```

If licensed flow reports a recent ask-side call that agrees with a bullish
underlying setup, the screen may repeat that exact strike and expiry as a
`BUY CALL RESEARCH` reference. A confirmed gamma-flush setup may similarly repeat
the exact observed put as `BUY PUT RESEARCH`. It does not choose a cheaper strike,
estimate fair value, or mark either contract actionable, because Gate B cannot be
satisfied without a live option quote source.

Rules the implementation follows:

- **No observed contract, no strike.** The screen does not invent an option
  contract from the stock price alone.
- **The premium ceiling is not a quote.** A broker ask above it means skip; an ask
  below it still requires the Gate B spread, freshness, volume, and open-interest
  checks.
- **Only defined-premium long options are budgeted.** Naked short options and
  undefined-risk combinations are not sized or recommended.
- **The amount never leaves the device.** It is kept in localStorage; there is no
  server to send it to.

## 0DTE and 1DTE

Both terms are explained in the app. Neither is offered as a pick.

**The horizon argument.** The engine reads one bar per day and
`FINAL_V4/DOCUMENTATION/V4_PARAMETER_STANDARD.md` states the intended holding
period as **1-3 days**. A 0DTE contract resolves inside a single bar the model
cannot see, so the score carries no information about its outcome. The app says
this in those words and marks 0DTE `OUTSIDE`.

1DTE is marked `EDGE`: it is the shortest expiry that overlaps the 1-3 day window
at all, and only just. Where the two are compared, the app says 1DTE is "the less
wrong one — not because it wins more", because no win-rate claim is supported.

**Expiry-day calendar.** The app checks whether the expiry day carries a
rule-derived event — Jobless Claims, Nonfarm Payrolls, monthly opex, triple
witching — and warns if so.

It cannot check FOMC or CPI. Those come from `MACRO_SEED`, which ships empty
because the dates are published rather than derivable. `expiryRisk()` therefore
returns `blind: true` unconditionally, and the app states that a quiet calendar
is **not** an all-clear and points the reader at the official schedule. Removing
that disclosure would turn a known gap into an implied safety claim.

**Contract sizing** uses the fail-closed formula above on a debit the reader
types in from their own broker screen. The app sources no quote, may only repeat
an observed flow contract as an unvalidated reference, and returns **skip** at
zero rather than rounding up.

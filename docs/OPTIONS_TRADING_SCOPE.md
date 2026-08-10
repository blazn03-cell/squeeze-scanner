# Options-trading scope and decision gate

## What the scanner actually detects

The free daily-bar path evaluates the underlying security using price, volume, volatility, trend, squeeze, Darvas, RSI, MFI, Bollinger, Ichimoku and related technical conditions. Those measurements cannot determine whether a particular option contract is liquid, fairly priced or suitable.

The optional options-flow path may add reported contract activity when a licensed feed is connected. Flow is context, not proof of future direction.

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

If this returns zero, the correct result is **skip**. Short/naked options and undefined-risk combinations are outside the current system.

## Alert timing (America/Chicago)

- 5-minute chart: earliest evaluation around 8:50 a.m. CT.
- 15-minute chart: earliest evaluation around 9:00 a.m. CT.
- Final eligibility boundary: 2:30 p.m. CT.
- The alert is evaluated from a completed bar; audible delivery may be later and actual receipt time must be logged.

An alert is a rules match, not confirmation that the trade is “right.” Forward outcomes, costs and adverse excursion must be measured after every eligible signal.

## Position sizing in the app

The simple view asks how much money the reader is using and how much they are
willing to lose on one trade, then sizes each candidate against that.

It sizes **shares of the underlying only.** It never names an option contract,
because Gate B above cannot be satisfied without a live contract quote source,
and none is connected. The scope note is shown to the reader in the app, not just
recorded here.

Rules the implementation follows:

- **A zero result is never rounded up to one.** If the budget does not cover a
  single share, the answer is zero and the screen says why.
- **Two independent limits**, and the smaller wins: what the budget can buy, and
  what the stated risk-per-trade allows.
- **The stop distance is 1.5 × ATR** — a stated convention meaning "further than
  this stock's normal daily swing", not a prediction. The app says so in plain
  words, and says that a gap through the stop loses more than the figure shown.
- **No ATR, no risk figure.** If volatility is unavailable the app sizes on the
  budget alone and reports no dollars-at-risk rather than inventing one.
- **The amount never leaves the device.** It is kept in localStorage; there is no
  server to send it to.

Ranking follows from this: a high-scoring setup the reader cannot afford is not
the best option *for them*, so affordable candidates are listed first and the
rest carry the reason they were excluded.

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
types in from their own broker screen. The app sources no quote, names no
contract, and returns **skip** at zero rather than rounding up.

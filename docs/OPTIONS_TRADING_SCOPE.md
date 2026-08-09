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

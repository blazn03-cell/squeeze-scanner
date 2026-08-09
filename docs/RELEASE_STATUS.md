# Public-release status

**Current status: BETA — PAPER TRADING ONLY**

## Combined work

This branch combines:

1. Claude's dashboard/data-provider implementation from pull request 2.
2. The Codex Thinkorswim evidence package, validators, frozen install subset and historical limitations.
3. Options-specific scope controls that prevent an underlying-stock score from being represented as a validated option contract.

Robinhood MCP setup and brokerage execution are intentionally excluded.

## Evidence currently available

- Historical V3: 48 trades across 22 symbols; mean return +0.694%; confidence interval included zero.
- Historical V4: 33 trades across 20 symbols; mean return +1.039%; confidence interval included zero.
- Corrected intraday V4.2 first-session-only replay: 22 alerts; mean return -0.345%; clustered confidence interval included zero.
- Historical ticker selection uses today's candidates and therefore has selection and survivorship bias.
- Genuine forward and Ring logs had no completed observations at the evidence checkpoint.

These results do not demonstrate a profitable edge.

## Required before a non-beta public claim

- At least 100 forward-paper observations per frozen arm.
- After-cost bootstrap and symbol-cluster confidence intervals above zero.
- No symbol contributes more than 20% of positive aggregate R.
- Acceptable slippage across multiple market regimes.
- Scanner/configuration error rate below 1%.
- Point-in-time universe data and contract-level options quotes retained.
- Live compile/render proof for every Thinkorswim script offered as installable.
- Privacy, terms, data-licensing and marketing-language review.

Until all gates pass, describe this as a technical candidate-ranking and logging tool, not a profitable system, recommendation engine or probability-of-profit calculator.

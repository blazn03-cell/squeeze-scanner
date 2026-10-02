# Standby register

Anything here is **not proven**. It stays switched off, or labelled research-only, until the listed evidence exists. Evidence means a verifiable source or forward data from the outcome loop, not a forum opinion. A forum thread can point to a source, but it is not a source.

Last reviewed: 2026-10-02.

| # | Item | Current state | Unblocks when | Where to look |
|---|---|---|---|---|
| 1 | Using APEX scores to size real-money trades | **Standby.** The v1 replay had 20 APEX claims at −0.35R, against roughly 0R for the baseline. | `/api/outcomes/track-record` → `comparisons["scan-apex-atr-v2"]` says APEX beats baseline with 50+ **forward** claims each, and drawdown is reviewed | The outcome loop only |
| 2 | Win probability or odds shown to users (`calcWinProb`, "WAIT <70%") | **Standby** on the beginner path (PR #16). The expert view still shows heuristic odds. | Calibrated against graded forward outcomes for the same rule | The outcome loop only |
| 3 | QQQ cascade performance | **Standby.** Claims are recorded, but no performance is inferred. | Intraday bars plus the provider's own observation timestamps on the snapshot | Twelve Data intraday docs, provider timestamp fields |
| 4 | Option returns (calls, short puts, spreads) | **Standby.** No historical chains. | Entitled point-in-time chains with timestamped bid/ask, open interest, multiplier, and a modelled executable cost | Cboe DataShop, ORATS, ThetaData, Polygon options; OIC education pages for definitions |
| 5 | Options flow, open interest or dealer GEX as a direction signal | **Standby.** Treated as clues, not signals. | A forward test where flow-tagged claims beat the same rule without flow | OIC FAQ (open interest does not show intent), the vendor's methodology docs |
| 6 | 179 blocked strategy variants | **Standby.** | Exact source definition plus compatible historical inputs for each variant | The original paper or vendor spec for each variant; never a parent or proxy result |
| 7 | Ask APEX answers used as learning labels | **Standby.** | Each answer is tied to a frozen claim and graded like any other claim | — |
| 8 | Prediction-market (Poly) strategies | **Research and paper only.** No execution. | Separate forward paper record | Polymarket docs, resolution rules |
| 9 | Unscheduled market closures | **Fail-closed.** The calendar refuses to grade past its coverage. | A new calendar version with an override and its source | nyse.com/trade/hours-calendars |
| 10 | Sessions after 2027-12-31 | **Fail-closed.** | A new NYSE calendar version | nyse.com/trade/hours-calendars |

## Rules

- Moving an item off standby takes a PR that cites its evidence. Do it one item at a time.
- Nothing is tuned on data that has already been looked at. A changed rule gets a new version, registered before its data arrives.
- Repeating runs on the same history is not confirmation.

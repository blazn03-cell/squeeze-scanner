# Next-session live runbook — America/Chicago

**Paper only. A Ring is rule alignment, not proof of profit. Historical confidence intervals include zero.**

## Before 08:30 CT

1. Restore/unminimize the thinkorswim Watchlist and capture a readable state. The last automated attempt could detect thinkorswim but not capture the disabled Watchlist.
2. Verify the **daily Score (0—100)** column is DAY and extended hours off. Separately verify the **confirmation count (0—5)** column; do not confuse the two.
3. Keep historical V3 queries unchanged. For the current V4 source arm, use the separately named threshold-65 install scan; never reset it to the canonical source default of 60. If retaining a threshold-60 diagnostic arm, save and log it separately. If testing V4.7, install its scan and quote under separate names and log `scan_type = V4.7`.
4. Chart: 5m or 15m, regular-hours display only. Exactly one alert-producing study may be enabled.
   - V4.2 is the last live-compiled fallback, but it lacks visible flow-sum diagnostics; treat its Rings as observation-only unless the sums are independently captured.
   - Use V4.2.2 only after it compiles/renders cleanly; then record `script_version = V4.2.2` and disable V4.1/V4.2/V4.2.1.
5. Compile the live spread quote in a copied layout. Blank means unknown, never zero. Verify five displayed bid/ask calculations during regular hours.
6. Compile the manual-entry sizing study. Prove entry=0 or spread=0 returns zero shares. With identical inputs, labels must match on 5m, 15m, and DAY.

## Fresh candidate checkpoints

At **08:35, 10:30, and 14:15 CT**:

1. Explicitly press Scan on the current threshold-65 V3 source query; record start/end, count, symbols, and load errors.
2. Run lightweight V4 confirmation/ATR against that fresh V3 result: DAY, extended off, ATR <4%, confirmations >=4/5.
3. Optional parallel V4.7: run under its own saved name; never overwrite or silently pool with V4.
4. Apply the account-affordability third stage only to fresh V4/V4.7 results. Use the chosen $100—$1,000 account and conservative minimum cost/share.
5. Record whether affordability was used, estimated shares, and pass/fail. A valid zero-result scan is evidence, not a malfunction.

Never run the combined whole-universe V4 expression; it timed out live. Scheduled ET/CT pairs are 09:35/08:35, 11:30/10:30, and 15:15/14:15.

## Alert window

- Qualification window: **08:45 through before 14:30 CT** (09:45—15:30 ET).
- Ding: current-bar VWAP warning only; no paper action.
- Ring: prior completed-bar confirmation evaluated when the next bar begins.
- Earliest evaluation boundary: **08:50 CT on 5m; 09:00 CT on 15m**.
- Final valid qualifying bar starts 14:25 CT on 5m or 14:15 CT on 15m; boundary is 14:30 CT.
- Audible receipt may be later. Record qualifying start/close, actual receipt time, and latency seconds; never rewrite receipt time to equal the expected boundary.
- Keep only the first Ring per symbol/session.

## After a Ring

1. Recheck daily V3/V4 membership, eligible common-stock/ADR identity, chart gates, and actual quote availability.
2. Record V4.2.2 `LAST RING MF+`/`MF-` labels; these are held from the completed qualifying bar. If both are zero, skip. Fallback V4.2 can falsely report 100 and lacks these labels, so it is observation-only unless the sums are independently captured.
3. Enter the actual intended/fill price and observed **dollar spread/share** in the fail-closed sizing study.
4. Record expected round-trip slippage/share and fees/share. Total cost/share must be at least spread + slippage + fees.
5. Final shares = min(risk-limited shares, capital-limited shares), whole shares only. Zero means skip; never round up.
6. For a $100 account, expect many or all candidates to fail. Archived selected-universe testing produced 0/33 affordable V4 observations under frozen rules.

## End of session

- After the 14:30 CT boundary, do not accept a newly qualifying setup. Preserve factual delayed alert receipts as latency evidence; a late receipt is not automatically executable.
- Reconcile candidates, skips, paper fills, load errors, affordability-estimate errors, and alert latency.
- Validate both forward and Ring CSVs. Do not replace the frozen multi-session exit policy with an arbitrary same-day close.
- Do not tune thresholds from one day of results.

## Promotion remains closed

Required: at least 100 forward-paper trades per arm; after-cost bootstrap and symbol-cluster 95% intervals excluding zero; no symbol >20% of positive R; acceptable slippage/regime coverage; scanner error below 1%; point-in-time, delisting-complete historical data. None is currently satisfied as a demonstrated profitable edge.


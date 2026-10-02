# Outcome loop

Records daily price-reference research outcomes. This is not an execution track record or proof of a profitable strategy.

```
scan / cascade output ─► frozen claim (claims.jsonl)
                              │  wait: horizon sessions must complete
                              ▼
         Twelve Data daily bars dated AFTER the decision day
                              │  first touch: target or stop
                              ▼
                 appended result (results.jsonl) ─► /api/outcomes/track-record
```

## Rules (`apex-v4/backend/lib/outcomeRules.js`)

| Version | Selects | Win / loss / horizon |
|---|---|---|
| `scan-apex-v1` | apexScore ≥ 70, direction ≠ 0 | +12% before −6%, 3 sessions |
| `scan-baseline-v1` | any direction ≠ 0 (control) | same |
| `scan-apex-atr-v2` | apexScore ≥ 70, direction ≠ 0 (needs ATR) | +2×ATR before −1×ATR, 5 sessions |
| `scan-baseline-atr-v2` | any direction ≠ 0 (control, needs ATR) | same |
| `cascade-qqq-v1` | GET_READY/TRIGGERED/CASCADE_ACTIVE with operator invalidation | +$5 before invalidation, 2 sessions |

v2 was registered on 2026-10-02, before any forward data existed for it. The v1 replay resolved 89% of claims by expiry, so v1 mostly measures 3-session drift. v2 scales levels to each stock's ATR. Its 2×/1×/5 parameters are a conventional 2:1 choice and were not fitted to that history. v1 keeps running unchanged so the two can be compared. `/api/outcomes/track-record` reports `comparisons` for each APEX rule against its paired baseline.

The v1 thresholds come from the replay audit in `docs/DATA_SETUP.md`. A rule version is never edited. To change a threshold, add a new version.

## Implemented behavior and boundaries

- **Bounded chronology checks.** Decision-day and incomplete calendar sessions are excluded. This does not independently prove historical source availability or absence of revised data.
- **Unknown stays unknown.** A claim with too few completed sessions stays `IMMATURE`, and bad bars return `INSUFFICIENT_DATA`. Neither is ever written as a pass.
- **Opening gaps first.** A gap through target or stop fills at the open. Otherwise both levels touched intrabar are ambiguous and conservatively graded at the stop.
- **Append-only writer.** Direct ledger ingestion records changed-ID content conflicts; the runner retains the first daily/signal claim and skips later captures. This is not full revision reconciliation or filesystem immutability.
- **Validation before append.** Invalid batches write nothing. Multi-file crash atomicity and multi-process safety are not established. Hashes are computed locally.
- **Cache reuse is conditional.** The same 1day/130-bar request can hit the scanner cache; actual additional provider usage has not been measured.
- **Reporting threshold.** NO VERDICT applies below fifty resolved claims per arm. Reaching fifty does not prove sample independence, statistical power or an edge.

## Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/api/outcomes/track-record` | public |
| GET | `/api/outcomes/claims?status=pending\|resolved&rule=&symbol=&limit=` | public |
| POST | `/api/outcomes/evaluate` | `Authorization: Bearer $OUTCOME_ADMIN_TOKEN` |
| GET | `/api/outcomes/export` (JSONL backup) | same |

Evaluation also runs automatically after each scan and every `OUTCOME_EVAL_INTERVAL_MIN` (default 360), throttled to once per hour.

## Environment

`OUTCOME_LEDGER=false` disables the loop. Other settings: `OUTCOME_STORE_DIR`, `OUTCOME_STORE_PERSISTENT`, `OUTCOME_ADMIN_TOKEN`, `OUTCOME_MAX_SYMBOLS_PER_RUN` (default 20), `OUTCOME_EVAL_INTERVAL_MIN`.

## Known limits

- **Storage isn't durable on Render's free plan.** It is wiped on every redeploy or restart. Either use a persistent disk or pull `/export` regularly.
- **Free instances sleep when idle.** Timers only run while the service is awake.
- **Survivorship bias applies.** The universe is a fixed watchlist.
- **R is per-share price R.** It does not include spread, slippage, commissions or options decay.
- **Cascade grading is coarse.** It uses daily bars, so intraday cascade timing is not captured.

## Local repair (outcome-repair/1)

This repair fixes the five additional PR15 regression findings. It remains a daily price-reference research grader, not trade execution or a model-learning service. Existing UI and engine formulas are unchanged.

Set OUTCOME_SESSION_CALENDAR_FILE to a private JSON calendar with source, version, complete:true, from, through, and strictly sorted sessions [{date,closeAt}]. closeAt must represent availability/finalization after the actual session close, including early closes. complete asserts all sessions in that coverage interval are included. The operator must verify source and completeness: validation does not independently certify exchange sessions. The bundled scheduled calendar is described below; override data must retain source/version coverage. Missing/invalid calendar means INSUFFICIENT_DATA, not guessed weekdays or a pass. Missing required elapsed session cannot be replaced by a later bar. A terminal target/stop may resolve early only after all preceding required sessions are present and complete; unused future sessions are not needed.

Opening target/stop gaps have priority over later bar extremes; otherwise both intrabar levels touched remains ambiguous/conservative. New results carry evaluatorVersion and calendar source/version/hash. Do not overwrite or silently regrade older results; compare evaluator cohorts separately.

Claims must match copied versioned rule settings, levels and horizon. Cascade capture requires positive trigger plus losing-side invalidation and a generatedAt no later than decision and within twelve minutes. This is an explicit local research availability assumption, not provider latency verification. Historical records failing stricter checks remain on disk and are counted as quarantined; capture them in backups before any operational migration.

Storage remains local JSONL. These changes do not establish crash-atomic multi-file writes, multiprocess concurrency, durable hosting, a complete immutable error/adoption ledger or live Vercel integration. Source/revision identity and actual model-claim correctness need their own contracts. Public claims/track-record routes retain PR15 access semantics; review private-data access before integration.

Verification: 40 tests passed (seven additional regression tests); static release check passed. No real feed request, broker action, Render deployment or Vercel release performed.

## NYSE scheduled calendar follow-up

Default regular US cash-equity calendar covers January 1, 2026 through December 31, 2027. Source reviewed October 2, 2026: https://www.nyse.com/trade/hours-calendars. Scheduled holidays and three early closes are explicit; timezone conversion uses America/New_York. exchangeCloseAt is the NYSE close; closeAt adds the research fifteen-minute finalization buffer, not a verified provider latency promise. OUTCOME_SESSION_CALENDAR_FILE may override the bundled calendar with separately sourced/versioned coverage.

No unscheduled future closure is predicted. Missing required bars remain unresolved. Horizon requests beyond available calendar sessions fail closed; a release test fails once calendar coverage expires. Historical/forward rule versions are unchanged. This is the first follow-up dependency; Supabase, live adapter and scheduler remain separate work in that order. Nothing on index.html is changed.
Cascade timing clarification: outcome-repair/1 uses the validated source generatedAt as decisionTime/sessionDate and records server capturedAt separately. A five-minute capture across midnight cannot shift the decision session. Source-to-capture delay is bounded by the declared twelve-minute research assumption. This does not certify provider publication time or latency.


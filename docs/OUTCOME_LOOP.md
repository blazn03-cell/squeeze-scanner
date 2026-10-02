# Outcome loop

Grades APEX calls against what the market did afterwards, so the scanner has a real track record instead of a guess.

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
| `cascade-qqq-v1` | GET_READY/TRIGGERED/CASCADE_ACTIVE with operator invalidation | +$5 before invalidation, 2 sessions |

The thresholds come from the replay audit in `docs/DATA_SETUP.md`. A rule version is never edited. To change a threshold, add a new version.

## Guarantees

- **Hindsight is impossible.** The decision-day bar and unfinished bars are excluded.
- **Unknown stays unknown.** A claim with too few completed sessions stays `IMMATURE`, and bad bars return `INSUFFICIENT_DATA`. Neither is ever written as a pass.
- **Daily-bar ambiguity is graded conservatively.** If target and stop are both hit in the same bar, it is graded as a loss. A gap through a level fills at the open.
- **Nothing is overwritten.** The ledger is append-only. If the same claim ID arrives with different content, it goes to `conflicts.jsonl` and the stored record is kept.
- **Batches are all-or-nothing.** Every record is validated before anything is written. Hashes are computed by the server, not supplied by the caller.
- **Evaluation costs little.** It requests the same 1day/130-bar series the scanner already caches, so a run after a scan usually costs 0 extra credits.
- **The verdict waits for data.** The APEX vs baseline verdict says `NO VERDICT` until both have 50+ resolved claims.

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

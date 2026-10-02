// Grades a frozen claim against bars that completed AFTER the decision day.
// Pure function: no I/O, no clock reads (pass `now`).
//
// Hard rules:
//  - Only bars dated after claim.sessionDate and fully completed count.
//    The decision-day bar is excluded because part of it was known at decision time.
//  - Unknown stays unresolved. Too few bars -> IMMATURE. Bad bars -> INSUFFICIENT_DATA.
//    Neither is ever written as a result.
//  - Target and stop touched in the same daily bar -> AMBIGUOUS, graded as the
//    stop (conservative): daily bars cannot tell which came first.
//  - Gaps through a level fill at the open, not at the level.
import { sha256 } from './claimRecorder.js';
import { validateClaim } from './claimRecorder.js';
import { requiredSessions } from './sessionCalendar.js';

export const RESULT_SCHEMA = 'result/1';

export function parseDailyBars(raw) {
  const values = Array.isArray(raw?.values) ? raw.values : Array.isArray(raw) ? raw : null;
  if (!values) return null;
  return values.map(v => ({
    date: String(v.datetime ?? '').slice(0, 10),
    open: Number(v.open), high: Number(v.high), low: Number(v.low), close: Number(v.close),
  }));
}

const validBar = b => /^\d{4}-\d{2}-\d{2}$/.test(b.date)
  && [b.open, b.high, b.low, b.close].every(n => Number.isFinite(n) && n > 0)
  && b.high >= b.low && b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close);

const r4 = n => Math.round(n * 1e4) / 1e4;

export function evaluateClaim(claim, bars, now = new Date(), source = 'twelvedata:/time_series:1day', calendar = null) {
  if (validateClaim(claim).length || !Number.isFinite(now.getTime()) || Date.parse(claim.decisionTime) > now.getTime()) return { status: 'INSUFFICIENT_DATA', reason: 'invalid or future claim' };
  if (!Array.isArray(bars)) return { status: 'INSUFFICIENT_DATA', reason: 'no bars' };
  const expected = requiredSessions(calendar, claim.sessionDate, claim.horizonSessions);
  if (!expected) return { status: 'INSUFFICIENT_DATA', reason: 'explicit complete session calendar required' };
  const window = [];
  let coverageError = null;
  for (const session of expected) {
    if (Date.parse(session.closeAt) > now.getTime()) break;
    const matches = bars.filter(b => b?.date === session.date);
    if (matches.length !== 1) { coverageError = session.date; break; }
    window.push(matches[0]);
  }

  if (window.some(b => !validBar(b))) return { status: 'INSUFFICIENT_DATA', reason: 'malformed bar in window' };
  if (new Set(window.map(b => b.date)).size !== window.length) return { status: 'INSUFFICIENT_DATA', reason: 'duplicate bar dates' };

  const { direction: d, entryPrice: entry, targetPrice: target, stopPrice: stop } = claim;
  const risk = Math.abs(entry - stop);
  const toR = px => d * (px - entry) / risk;

  let mfe = 0, mae = 0;
  for (const bar of window) {
    const fav = d === 1 ? bar.high : bar.low;
    const adv = d === 1 ? bar.low : bar.high;
    const hitTarget = d * (fav - target) >= 0;
    const hitStop = d * (stop - adv) >= 0;

    // An opening gap through a level exits at the open; the rest of that day's
    // range happened after the exit and must not count toward excursions.
    const gapTarget = d * (bar.open - target) >= 0;
    const gapStop = d * (stop - bar.open) >= 0;
    if (gapTarget || gapStop) {
      mfe = Math.max(mfe, toR(bar.open));
      mae = Math.min(mae, toR(bar.open));
      return resolved(claim, gapTarget ? 'TARGET_FIRST' : 'STOP_FIRST', bar.open, bar.date, toR(bar.open), mfe, mae,
        window.slice(0, window.indexOf(bar) + 1), now, source, calendar);
    }
    mfe = Math.max(mfe, toR(fav));
    mae = Math.min(mae, toR(adv));

    let outcome = null, exit = null;
    if (hitStop && hitTarget) {
      outcome = 'AMBIGUOUS_SAME_BAR';
      exit = d * (stop - bar.open) >= 0 ? bar.open : stop;
    } else if (hitStop) {
      outcome = 'STOP_FIRST';
      exit = d * (stop - bar.open) >= 0 ? bar.open : stop;
    } else if (hitTarget) {
      outcome = 'TARGET_FIRST';
      exit = d * (bar.open - target) >= 0 ? bar.open : target;
    }
    if (outcome) return resolved(claim, outcome, exit, bar.date, toR(exit), mfe, mae, window.slice(0, window.indexOf(bar) + 1), now, source, calendar);
  }

  if (coverageError) return { status: 'INSUFFICIENT_DATA', reason: 'missing or duplicate required session', session: coverageError };
  if (window.length < claim.horizonSessions) {
    return { status: 'IMMATURE', barsSeen: window.length, needed: claim.horizonSessions };
  }
  const last = window[window.length - 1];
  return resolved(claim, 'EXPIRED', last.close, last.date, toR(last.close), mfe, mae, window, now, source, calendar);
}

function resolved(claim, outcome, exitPrice, exitDate, r, mfe, mae, barsUsed, now, source, calendar) {
  return {
    status: 'RESOLVED',
    result: {
      schema: RESULT_SCHEMA,
      evaluatorVersion: 'outcome-repair/1',
      calendar: { source: calendar.source, version: calendar.version, hash: sha256(calendar) },
      claimId: claim.claimId,
      ruleVersion: claim.ruleVersion,
      claimContentHash: claim.contentHash,
      outcome,
      exitPrice: r4(exitPrice),
      exitDate,
      rMultiple: r4(r),
      mfeR: r4(mfe),
      maeR: r4(mae),
      barsUsed: barsUsed.map(b => b.date),
      barsHash: sha256(barsUsed),
      source,
      evaluatedAt: now.toISOString(),
    },
  };
}

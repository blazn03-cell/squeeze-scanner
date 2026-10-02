// Connects the loop: records claims from live output, grades matured claims
// with later Twelve Data bars, appends results. Never throws into callers.
import { buildScanClaims, buildCascadeClaim } from './claimRecorder.js';
import { evaluateClaim, parseDailyBars } from './outcomeEvaluator.js';
import { nyParts } from './marketTime.js';

// Same request the scanner makes, so a recent scan means a cache hit (0 credits).
const BARS_INTERVAL = '1day';
const BARS_OUTPUTSIZE = 130;

export class OutcomeRunner {
  constructor({ ledger, tdClient, sessionCalendar = null, maxSymbolsPerRun = 20, minIntervalMs = 60 * 60 * 1000, log = console }) {
    this.ledger = ledger;
    this.tdClient = tdClient;
    this.sessionCalendar = sessionCalendar;
    this.maxSymbolsPerRun = maxSymbolsPerRun;
    this.minIntervalMs = minIntervalMs;
    this.log = log;
    this.running = false;
    this.lastRunAt = 0;
    this.lastReport = null;
  }

  recordScan(results, now = new Date()) {
    try {
      const claims = buildScanClaims(results, now).filter(c => !this.ledger.hasClaim(c.claimId));
      return this.ledger.appendClaims(claims);
    } catch (e) {
      this.log.warn?.('[outcomes] recordScan failed:', e.message);
      return null;
    }
  }

  recordCascade(snapshot, now = new Date()) {
    try {
      const claim = buildCascadeClaim(snapshot, now);
      if (!claim || this.ledger.hasClaim(claim.claimId)) return null;
      return this.ledger.appendClaims([claim]);
    } catch (e) {
      this.log.warn?.('[outcomes] recordCascade failed:', e.message);
      return null;
    }
  }

  // Throttled entry point for timers and post-scan hooks.
  async maybeEvaluate(now = new Date()) {
    if (now.getTime() - this.lastRunAt < this.minIntervalMs) return { skipped: 'throttled' };
    return this.evaluate(now);
  }

  async evaluate(now = new Date()) {
    if (this.running) return { skipped: 'already_running' };
    this.running = true;
    this.lastRunAt = now.getTime();
    const report = { at: now.toISOString(), symbols: 0, resolved: 0, immature: 0, insufficientData: 0, fetchErrors: [], write: null };
    try {
      const today = nyParts(now).date;
      // A claim cannot resolve until at least one session after its decision day has started.
      const pending = this.ledger.pendingClaims().filter(c => c.sessionDate < today);
      const bySymbol = new Map();
      for (const c of pending) {
        if (!bySymbol.has(c.symbol)) bySymbol.set(c.symbol, []);
        bySymbol.get(c.symbol).push(c);
      }
      // Oldest claims first so nothing starves.
      const symbols = [...bySymbol.keys()]
        .sort((a, b) => (bySymbol.get(a)[0].sessionDate < bySymbol.get(b)[0].sessionDate ? -1 : 1))
        .slice(0, this.maxSymbolsPerRun);

      const results = [];
      for (const symbol of symbols) {
        report.symbols += 1;
        let bars;
        try {
          bars = parseDailyBars(await this.tdClient.getTimeSeries(symbol, BARS_INTERVAL, BARS_OUTPUTSIZE));
        } catch (e) {
          report.fetchErrors.push({ symbol, error: e.message });
          continue;
        }
        for (const claim of bySymbol.get(symbol)) {
          const out = evaluateClaim(claim, bars, now, 'twelvedata:/time_series:1day', this.sessionCalendar);
          if (out.status === 'RESOLVED') results.push(out.result);
          else if (out.status === 'IMMATURE') report.immature += 1;
          else report.insufficientData += 1;
        }
      }
      report.write = this.ledger.appendResults(results);
      if (report.write.rejected.length) {
        // Batch is all-or-nothing; log the bad ones and commit the rest explicitly.
        this.log.warn?.('[outcomes] results rejected:', JSON.stringify(report.write.rejected));
        const bad = new Set(report.write.rejected.map(r => r.index));
        const retry = this.ledger.appendResults(results.filter((_, i) => !bad.has(i)));
        report.write = { ...retry, rejected: report.write.rejected };
      }
      report.resolved = report.write.written;
    } catch (e) {
      report.error = e.message;
      this.log.warn?.('[outcomes] evaluate failed:', e.message);
    } finally {
      this.running = false;
      this.lastReport = report;
    }
    return report;
  }
}

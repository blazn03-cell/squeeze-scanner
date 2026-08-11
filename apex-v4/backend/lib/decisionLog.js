// Decision log — JSONL file recording every scan result for transparency + debugging.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOG_DIR  = './logs';
const LOG_FILE = join(LOG_DIR, 'decisions.jsonl');

export class DecisionLog {
  constructor(enabled = true) {
    this.enabled = enabled;
    if (enabled && !existsSync(LOG_DIR)) {
      try { mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}
    }
  }

  _write(entry) {
    if (!this.enabled) return;
    try {
      writeFileSync(LOG_FILE, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n', { flag: 'a' });
    } catch (_) { /* non-critical, never crash the scan */ }
  }

  logSymbol(result) {
    if (!result) return;
    this._write({
      event:       'symbol',
      symbol:      result.symbol,
      price:       result.price,
      apexScore:   result.apexScore,
      direction:   result.direction,
      confidence:  result.confidence,
      regime:      result.regime,
      stable:      result.stable,
      atrPct:      result.atrPct,
      relVol:      result.relVol,
      sqzState:    result.sqzState,
      flow:        result.flow,
      earlyEntry:  result.earlyEntry,
      earningsRisk: result.earningsRisk,
      spreadPct:   result.spreadPct,
    });
  }

  logScanStart(symbolCount, costEstimate) {
    this._write({ event: 'scan_start', symbolCount, ...costEstimate });
  }

  logScanEnd(resultCount, durationMs, credits) {
    this._write({ event: 'scan_end', resultCount, durationMs, credits });
  }
}

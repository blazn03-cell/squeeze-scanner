// Decision log — JSONL file recording scan results and APEX state transitions
// for transparency + debugging. Render's local filesystem is not a durable
// database, so this log is append-only for the current service instance.
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

  logCascade(snapshot, reason = 'state_change') {
    if (!snapshot) return;
    this._write({
      event: 'apex_cascade',
      reason,
      signalId: snapshot.signalId ?? null,
      symbol: snapshot.symbol,
      state: snapshot.state,
      direction: snapshot.direction,
      price: snapshot.technical?.price ?? null,
      triggerPrice: snapshot.event?.triggerPrice ?? null,
      invalidationPrice: snapshot.event?.invalidationPrice ?? null,
      catalyst: snapshot.event?.catalyst ?? null,
      pressureBuild: snapshot.pressureBuild,
      dataConfidence: snapshot.dataConfidence,
      expansionRegime: snapshot.expansionRegime,
      expansionTier: snapshot.expansion?.tier ?? null,
      confirmedInputs: snapshot.confirmations?.confirmed ?? 0,
      availableInputs: snapshot.confirmations?.available ?? 0,
      failedInputs: snapshot.confirmations?.failed ?? 0,
      generatedAt: snapshot.generatedAt,
    });
  }

  logScanStart(symbolCount, costEstimate) {
    this._write({ event: 'scan_start', symbolCount, ...costEstimate });
  }

  logScanEnd(resultCount, durationMs, credits) {
    this._write({ event: 'scan_end', resultCount, durationMs, credits });
  }
}

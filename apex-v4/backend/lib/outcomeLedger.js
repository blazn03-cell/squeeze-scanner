// Append-only outcome ledger: claims.jsonl, results.jsonl, conflicts.jsonl.
//
// Nothing is ever rewritten. Status is derived by joining claims to results.
// A batch is fully validated before any line is written, then written in one
// append, so a bad record cannot leave half a batch on disk.
//
// Durability: on Render's free plan the filesystem is wiped on every deploy or
// restart. Point OUTCOME_STORE_DIR at a persistent disk mount (paid plan), or
// pull /api/outcomes/export regularly as a backup.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateClaim, sha256 } from './claimRecorder.js';
import { RESULT_SCHEMA } from './outcomeEvaluator.js';

const OUTCOMES = new Set(['TARGET_FIRST', 'STOP_FIRST', 'AMBIGUOUS_SAME_BAR', 'EXPIRED']);

export function validateResult(r, claim) {
  const errors = [];
  if (!r || typeof r !== 'object') return ['not an object'];
  if (r.schema !== RESULT_SCHEMA) errors.push('schema');
  if (!claim) errors.push('unknown claimId');
  else {
    if (r.ruleVersion !== claim.ruleVersion) errors.push('ruleVersion mismatch');
    if (r.claimContentHash !== claim.contentHash) errors.push('claimContentHash mismatch');
    if (!(r.exitDate > claim.sessionDate)) errors.push('exitDate not after decision session');
    if (!Array.isArray(r.barsUsed) || r.barsUsed.length < 1 || r.barsUsed.length > claim.horizonSessions) errors.push('barsUsed');
    else if (r.barsUsed.some(d => !(d > claim.sessionDate))) errors.push('bar not after decision session');
  }
  if (!OUTCOMES.has(r.outcome)) errors.push('outcome');
  for (const k of ['exitPrice', 'rMultiple', 'mfeR', 'maeR']) if (!Number.isFinite(r[k])) errors.push(k);
  return errors;
}

function readJsonl(file) {
  if (!existsSync(file)) return { rows: [], corrupt: 0 };
  let corrupt = 0;
  const rows = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { corrupt += 1; }
  }
  return { rows, corrupt };
}

export class OutcomeLedger {
  constructor(dir) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.files = {
      claims: join(dir, 'claims.jsonl'),
      results: join(dir, 'results.jsonl'),
      conflicts: join(dir, 'conflicts.jsonl'),
    };
    this.claims = new Map();
    this.results = new Map();
    this.corruptLines = 0;
    this.conflictCount = 0;

    const c = readJsonl(this.files.claims);
    for (const row of c.rows) if (!this.claims.has(row.claimId)) this.claims.set(row.claimId, row);
    const r = readJsonl(this.files.results);
    for (const row of r.rows) if (!this.results.has(row.claimId)) this.results.set(row.claimId, row);
    this.corruptLines = c.corrupt + r.corrupt;
    this.conflictCount = readJsonl(this.files.conflicts).rows.length;
  }

  hasClaim(id) { return this.claims.has(id); }

  _append(file, rows) {
    if (!rows.length) return;
    appendFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  }

  _recordConflicts(conflicts) {
    if (!conflicts.length) return;
    this._append(this.files.conflicts, conflicts);
    this.conflictCount += conflicts.length;
  }

  // Returns { written, duplicates, conflicts, rejected }. Rejects the whole
  // batch on any invalid record (nothing written).
  appendClaims(claims) {
    const rejected = [];
    claims.forEach((c, i) => {
      const errors = validateClaim(c);
      if (errors.length) rejected.push({ index: i, claimId: c?.claimId ?? null, errors });
    });
    if (rejected.length) return { written: 0, duplicates: 0, conflicts: 0, rejected };

    const fresh = [], conflicts = [];
    let duplicates = 0;
    const seen = new Map();
    for (const c of claims) {
      const prior = this.claims.get(c.claimId) ?? seen.get(c.claimId);
      if (!prior) { seen.set(c.claimId, c); fresh.push(c); continue; }
      if (prior.contentHash === c.contentHash) { duplicates += 1; continue; }
      conflicts.push({ type: 'claim', claimId: c.claimId, storedHash: prior.contentHash, incomingHash: c.contentHash, incoming: c, at: new Date().toISOString() });
    }
    this._append(this.files.claims, fresh);
    for (const c of fresh) this.claims.set(c.claimId, c);
    this._recordConflicts(conflicts);
    return { written: fresh.length, duplicates, conflicts: conflicts.length, rejected };
  }

  appendResults(results) {
    const rejected = [];
    results.forEach((r, i) => {
      const errors = validateResult(r, this.claims.get(r?.claimId));
      if (errors.length) rejected.push({ index: i, claimId: r?.claimId ?? null, errors });
    });
    if (rejected.length) return { written: 0, duplicates: 0, conflicts: 0, rejected };

    const fresh = [], conflicts = [];
    let duplicates = 0;
    for (const r of results) {
      const prior = this.results.get(r.claimId) ?? fresh.find(f => f.claimId === r.claimId);
      if (!prior) { fresh.push(r); continue; }
      // Same grade re-derived (only evaluatedAt differs) is a duplicate.
      const key = x => sha256({ ...x, evaluatedAt: null });
      if (key(prior) === key(r)) { duplicates += 1; continue; }
      conflicts.push({ type: 'result', claimId: r.claimId, stored: prior, incoming: r, at: new Date().toISOString() });
    }
    this._append(this.files.results, fresh);
    for (const r of fresh) this.results.set(r.claimId, r);
    this._recordConflicts(conflicts);
    return { written: fresh.length, duplicates, conflicts: conflicts.length, rejected };
  }

  pendingClaims() {
    return [...this.claims.values()].filter(c => !this.results.has(c.claimId));
  }

  listClaims({ status, ruleVersion, symbol, limit = 100 } = {}) {
    let rows = [...this.claims.values()].map(c => ({
      ...c,
      status: this.results.has(c.claimId) ? 'RESOLVED' : 'PENDING',
      result: this.results.get(c.claimId) ?? null,
    }));
    if (status) rows = rows.filter(r => r.status === status.toUpperCase());
    if (ruleVersion) rows = rows.filter(r => r.ruleVersion === ruleVersion);
    if (symbol) rows = rows.filter(r => r.symbol === symbol.toUpperCase());
    rows.sort((a, b) => (a.decisionTime < b.decisionTime ? 1 : -1));
    return rows.slice(0, Math.max(1, Math.min(limit, 1000)));
  }

  exportJsonl() {
    const lines = [];
    for (const c of this.claims.values()) lines.push(JSON.stringify({ type: 'claim', ...c }));
    for (const r of this.results.values()) lines.push(JSON.stringify({ type: 'result', ...r }));
    return lines.join('\n') + (lines.length ? '\n' : '');
  }

  stats() {
    return {
      dir: this.dir,
      claims: this.claims.size,
      results: this.results.size,
      pending: this.claims.size - this.results.size,
      conflicts: this.conflictCount,
      corruptLines: this.corruptLines,
    };
  }
}

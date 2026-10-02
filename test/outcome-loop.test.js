import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildScanClaims, buildCascadeClaim, validateClaim, sha256 } from "../apex-v4/backend/lib/claimRecorder.js";
import { evaluateClaim as evaluateRaw } from "../apex-v4/backend/lib/outcomeEvaluator.js";
import { OutcomeLedger } from "../apex-v4/backend/lib/outcomeLedger.js";
import { OutcomeRunner } from "../apex-v4/backend/lib/outcomeRunner.js";
import { buildTrackRecord } from "../apex-v4/backend/lib/trackRecord.js";

// Thu 2026-10-01 14:00 NY = 18:00Z (EDT)
const DECISION = new Date("2026-10-01T18:00:00Z");
// Tue 2026-10-06 20:30Z = 16:30 NY, after the Oct 6 session closed
const SESSION_CALENDAR = {source:'Synthetic test fixture, not production calendar',version:'fixture-1',complete:true,from:'2026-10-01',through:'2026-10-07',sessions:[{date:'2026-10-02',closeAt:'2026-10-02T20:15:00Z'},{date:'2026-10-05',closeAt:'2026-10-05T20:15:00Z'},{date:'2026-10-06',closeAt:'2026-10-06T20:15:00Z'},{date:'2026-10-07',closeAt:'2026-10-07T20:15:00Z'}]};
const evaluateClaim = (c,b,n) => evaluateRaw(c,b,n,'test-fixture',SESSION_CALENDAR);
const LATER = new Date("2026-10-06T20:30:00Z");

const scanRow = (over = {}) => ({ symbol: "TEST", price: 100, apexScore: 80, direction: 1, relVol: 2, scannedAt: DECISION.toISOString(), ...over });
const bar = (date, open, high, low, close) => ({ date, open, high, low, close });
const apexClaim = (over = {}) => buildScanClaims([scanRow(over)], DECISION).find(c => c.ruleVersion === "scan-apex-v1");
const tmp = () => mkdtempSync(join(tmpdir(), "outcomes-"));

test("scan claims freeze levels, rule params and hashes; apex + baseline both recorded", () => {
  const claims = buildScanClaims([scanRow()], DECISION);
  assert.deepEqual(claims.map(c => c.ruleVersion).sort(), ["scan-apex-v1", "scan-baseline-v1"]);
  const c = claims.find(x => x.ruleVersion === "scan-apex-v1");
  assert.equal(c.claimId, "scan-apex-v1:TEST:2026-10-01");
  assert.equal(c.sessionDate, "2026-10-01");
  assert.equal(c.targetPrice, 112);
  assert.equal(c.stopPrice, 94);
  assert.equal(c.rule.horizonSessions, 3);
  assert.deepEqual(validateClaim(c), []);
});

test("low APEX score only produces a baseline claim; no direction produces none", () => {
  assert.deepEqual(buildScanClaims([scanRow({ apexScore: 50 })], DECISION).map(c => c.ruleVersion), ["scan-baseline-v1"]);
  assert.equal(buildScanClaims([scanRow({ direction: 0 })], DECISION).length, 0);
  assert.equal(buildScanClaims([scanRow({ price: NaN })], DECISION).length, 0);
});

test("invalid decision time, tampered fields and broken hashes are rejected", () => {
  assert.equal(buildScanClaims([scanRow()], new Date("nope")).length, 0);
  const c = apexClaim();
  assert.ok(validateClaim({ ...c, decisionTime: "not-a-date" }).length > 0);
  assert.ok(validateClaim({ ...c, targetPrice: 90 }).length > 0);
  assert.ok(validateClaim({ ...c, inputs: { ...c.inputs, apexScore: 99 } }).includes("inputsHash"));
});

test("cascade claims need an actionable state, direction and an invalidation on the losing side", () => {
  const snap = { generatedAt: DECISION.toISOString(), signalId: "QQQ-1", state: "TRIGGERED", direction: "BULLISH", technical: { price: 500 }, event: { invalidationPrice: 495, triggerPrice: 499 } };
  const c = buildCascadeClaim(snap, DECISION);
  assert.equal(c.targetPrice, 505);
  assert.deepEqual(validateClaim(c), []);
  assert.equal(buildCascadeClaim({ ...snap, state: "WATCH" }, DECISION), null);
  assert.equal(buildCascadeClaim({ ...snap, event: {} }, DECISION), null);
  assert.equal(buildCascadeClaim({ ...snap, event: { invalidationPrice: 505 } }, DECISION), null);
  assert.equal(buildCascadeClaim({ ...snap, direction: "NEUTRAL" }, DECISION), null);
});

test("decision-day bar is ignored and missing elapsed sessions stay unresolved", () => {
  const c = apexClaim();
  const bars = [bar("2026-10-01", 100, 130, 99, 120), bar("2026-10-02", 100, 101, 99, 100)];
  assert.equal(evaluateClaim(c, bars, LATER).status, "INSUFFICIENT_DATA");
  assert.equal(evaluateClaim(c, [], LATER).status, "INSUFFICIENT_DATA");
});

test("today's unfinished bar does not count", () => {
  const c = apexClaim();
  const midSession = new Date("2026-10-02T17:00:00Z");
  assert.equal(evaluateClaim(c, [bar("2026-10-02", 100, 113, 99, 112)], midSession).status, "IMMATURE");
  assert.equal(evaluateClaim(c, [bar("2026-10-02", 100, 113, 99, 112)], LATER).result.outcome, "TARGET_FIRST");
});

test("target, stop, same-bar ambiguity, gap fills and expiry grade correctly", () => {
  const c = apexClaim();
  const t = evaluateClaim(c, [bar("2026-10-02", 100, 113, 99, 112)], LATER).result;
  assert.equal(t.outcome, "TARGET_FIRST");
  assert.equal(t.rMultiple, 2);

  const s = evaluateClaim(c, [bar("2026-10-02", 100, 101, 93, 95)], LATER).result;
  assert.equal(s.outcome, "STOP_FIRST");
  assert.equal(s.rMultiple, -1);

  const a = evaluateClaim(c, [bar("2026-10-02", 100, 113, 93, 100)], LATER).result;
  assert.equal(a.outcome, "AMBIGUOUS_SAME_BAR");
  assert.equal(a.rMultiple, -1);

  const gap = evaluateClaim(c, [bar("2026-10-02", 90, 91, 88, 89)], LATER).result;
  assert.equal(gap.exitPrice, 90);
  assert.ok(gap.rMultiple < -1, "gap through stop fills at the open, worse than -1R");

  const e = evaluateClaim(c, [bar("2026-10-02", 100, 103, 98, 101), bar("2026-10-05", 101, 104, 99, 102), bar("2026-10-06", 102, 105, 100, 103)], LATER).result;
  assert.equal(e.outcome, "EXPIRED");
  assert.equal(e.rMultiple, 0.5);
  assert.deepEqual(e.barsUsed, ["2026-10-02", "2026-10-05", "2026-10-06"]);
});

test("short claims grade in the short direction", () => {
  const c = apexClaim({ direction: -1 });
  assert.equal(c.targetPrice, 88);
  assert.equal(evaluateClaim(c, [bar("2026-10-02", 100, 101, 87, 88)], LATER).result.outcome, "TARGET_FIRST");
});

test("malformed bars give INSUFFICIENT_DATA instead of a grade", () => {
  const c = apexClaim();
  assert.equal(evaluateClaim(c, [bar("2026-10-02", 100, 90, 99, 100)], LATER).status, "INSUFFICIENT_DATA");
  assert.equal(evaluateClaim(c, null, LATER).status, "INSUFFICIENT_DATA");
});

test("ledger: invalid batch writes nothing, changed same-ID claim is a conflict, not a silent skip", () => {
  const dir = tmp();
  try {
    const ledger = new OutcomeLedger(dir);
    const good = apexClaim();
    const res = ledger.appendClaims([good, { ...good, claimId: "x", decisionTime: "bad" }]);
    assert.equal(res.written, 0);
    assert.equal(res.rejected.length, 1);
    assert.equal(ledger.stats().claims, 0);

    assert.equal(ledger.appendClaims([good]).written, 1);
    assert.equal(ledger.appendClaims([good]).duplicates, 1);

    const changed = buildScanClaims([scanRow({ price: 101 })], DECISION).find(c => c.ruleVersion === "scan-apex-v1");
    assert.equal(changed.claimId, good.claimId);
    assert.equal(ledger.appendClaims([changed]).conflicts, 1);
    assert.equal(ledger.claims.get(good.claimId).entryPrice, 100, "stored claim is never overwritten");
    assert.equal(readFileSync(join(dir, "conflicts.jsonl"), "utf8").trim().split("\n").length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ledger: results must reference a known claim and post-decision bars; reload rebuilds state", () => {
  const dir = tmp();
  try {
    const ledger = new OutcomeLedger(dir);
    const c = apexClaim();
    ledger.appendClaims([c]);
    const { result } = evaluateClaim(c, [bar("2026-10-02", 100, 113, 99, 112)], LATER);

    assert.equal(ledger.appendResults([{ ...result, claimId: "ghost" }]).rejected.length, 1);
    assert.equal(ledger.appendResults([{ ...result, barsUsed: ["2026-10-01"] }]).rejected.length, 1);
    assert.equal(ledger.appendResults([result]).written, 1);
    assert.equal(ledger.appendResults([{ ...result, evaluatedAt: new Date().toISOString() }]).duplicates, 1);
    assert.equal(ledger.appendResults([{ ...result, outcome: "STOP_FIRST", exitPrice: 94, rMultiple: -1 }]).conflicts, 1);

    appendFileSync(join(dir, "claims.jsonl"), "{not json\n");
    const reloaded = new OutcomeLedger(dir);
    assert.equal(reloaded.stats().claims, 1);
    assert.equal(reloaded.stats().results, 1);
    assert.equal(reloaded.stats().corruptLines, 1);
    assert.equal(reloaded.results.get(c.claimId).outcome, "TARGET_FIRST");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("runner closes the loop end to end with later bars, and survives fetch errors", async () => {
  const dir = tmp();
  try {
    const ledger = new OutcomeLedger(dir);
    const calls = [];
    const tdClient = {
      async getTimeSeries(symbol, interval, size) {
        calls.push([symbol, interval, size]);
        if (symbol === "BAD") throw new Error("HTTP 500");
        return { values: [
          { datetime: "2026-10-01", open: "100", high: "130", low: "99", close: "120" },
          { datetime: "2026-10-02", open: "100", high: "113", low: "99", close: "112" },
          { datetime: "2026-10-05", open: "100", high: "101", low: "99", close: "100" },
          { datetime: "2026-10-06", open: "100", high: "101", low: "99", close: "100" },
        ] };
      },
    };
    const runner = new OutcomeRunner({ ledger, tdClient, sessionCalendar: SESSION_CALENDAR, log: { warn() {} } });
    runner.recordScan([scanRow(), scanRow({ symbol: "BAD" })], DECISION);
    assert.equal(ledger.stats().claims, 4);

    const sameDay = await runner.evaluate(new Date("2026-10-01T21:00:00Z"));
    assert.equal(sameDay.symbols, 0, "nothing is fetched on the decision day");

    const report = await runner.evaluate(LATER);
    assert.equal(report.resolved, 2);
    assert.equal(report.fetchErrors.length, 1);
    assert.deepEqual(calls[0].slice(1), ["1day", 130], "reuses the scanner's cached bar request");
    assert.equal(ledger.pendingClaims().length, 2);

    const tr = buildTrackRecord(ledger);
    assert.equal(tr.rules["scan-apex-v1"].resolved, 1);
    assert.equal(tr.rules["scan-apex-v1"].avgR, 2);
    assert.equal(tr.rules["scan-apex-v1"].sample, "INSUFFICIENT_SAMPLE");
    assert.equal(tr.apexVsBaseline.comparable, false);
    assert.match(tr.apexVsBaseline.verdict, /NO VERDICT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("hashing is order-independent", () => {
  assert.equal(sha256({ a: 1, b: [1, { c: 2, d: 3 }] }), sha256({ b: [1, { d: 3, c: 2 }], a: 1 }));
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildScanClaims, buildCascadeClaim, validateClaim, sha256 } from "../apex-v4/backend/lib/claimRecorder.js";
import { evaluateClaim } from "../apex-v4/backend/lib/outcomeEvaluator.js";
import { OutcomeLedger, validateResult } from "../apex-v4/backend/lib/outcomeLedger.js";
import { NYSE_CALENDAR } from "../apex-v4/backend/lib/nyseCalendar.js";
import { RULES, ruleParams } from "../apex-v4/backend/lib/outcomeRules.js";
import { buildTrackRecord } from "../apex-v4/backend/lib/trackRecord.js";

const DECISION = new Date("2026-10-01T18:00:00Z");

test("a narrow-stop cascade result passes the ledger's return check", () => {
  const claim = buildCascadeClaim({
    signalId:"Q1", state:"TRIGGERED", direction:"BULLISH",
    technical:{ price:500 }, event:{ invalidationPrice:499.9, triggerPrice:499.95 },
    generatedAt:DECISION.toISOString(),
  }, DECISION);
  const out = evaluateClaim(claim, [
    { date:"2026-10-02", open:500.03, high:500.04, low:499.97, close:500.0337 },
    { date:"2026-10-05", open:500.01, high:500.02, low:499.99, close:500.01337 },
  ], new Date("2026-10-06T21:00:00Z"), "test", NYSE_CALENDAR);
  assert.equal(out.status, "RESOLVED");
  assert.deepEqual(validateResult(out.result, claim), []);
  // A genuinely wrong R is still caught.
  assert.ok(validateResult({ ...out.result, rMultiple: out.result.rMultiple + 0.05 }, claim).includes("return mismatch"));
});

test("v1 rule parameters are frozen", () => {
  assert.equal(sha256(ruleParams("scan-apex-v1")), sha256({
    kind:"scan",
    description:"APEX directional call (apexScore >= 70, direction != 0). Win = +12% move in call direction before -6% against, within 3 completed sessions after the decision day.",
    targetPct:12, stopPct:6, horizonSessions:3,
  }));
});

test("v2 levels scale with the stock's own ATR and are pre-registered", () => {
  const claims = buildScanClaims([{ symbol:"TEST", price:100, apexScore:80, direction:1, atrPct:2.5 }], DECISION);
  assert.deepEqual(claims.map(c => c.ruleVersion).sort(),
    ["scan-apex-atr-v2", "scan-apex-v1", "scan-baseline-atr-v2", "scan-baseline-v1"]);
  const v2 = claims.find(c => c.ruleVersion === "scan-apex-atr-v2");
  assert.equal(v2.targetPrice, 105);
  assert.equal(v2.stopPrice, 97.5);
  assert.equal(v2.horizonSessions, 5);
  assert.equal(v2.rule.registeredAt, "2026-10-02");
  assert.deepEqual(validateClaim(v2), []);

  const short = buildScanClaims([{ symbol:"TEST", price:100, apexScore:80, direction:-1, atrPct:2 }], DECISION)
    .find(c => c.ruleVersion === "scan-apex-atr-v2");
  assert.equal(short.targetPrice, 96);
  assert.equal(short.stopPrice, 102);
});

test("no ATR means no v2 claim, never a guessed one; tampered v2 levels are rejected", () => {
  const noAtr = buildScanClaims([{ symbol:"TEST", price:100, apexScore:80, direction:1 }], DECISION);
  assert.ok(!noAtr.some(c => c.ruleVersion.includes("atr")));
  assert.equal(buildScanClaims([{ symbol:"TEST", price:100, apexScore:80, direction:1, atrPct:0 }], DECISION)
    .filter(c => c.ruleVersion.includes("atr")).length, 0);

  const v2 = buildScanClaims([{ symbol:"TEST", price:100, apexScore:80, direction:1, atrPct:2.5 }], DECISION)
    .find(c => c.ruleVersion === "scan-apex-atr-v2");
  const { contentHash, ...rest } = { ...v2, targetPrice:108 };
  const tampered = { ...rest, contentHash:sha256(rest) };
  assert.ok(validateClaim(tampered).includes("target contract mismatch"));
});

test("v2 grades over five sessions and the track record pairs each APEX rule with its baseline", () => {
  const dir = mkdtempSync(join(tmpdir(), "outcomes-v2-"));
  try {
    const ledger = new OutcomeLedger(dir);
    const claims = buildScanClaims([{ symbol:"TEST", price:100, apexScore:80, direction:1, atrPct:2 }], DECISION);
    assert.equal(ledger.appendClaims(claims).written, 4);
    const v2 = claims.find(c => c.ruleVersion === "scan-apex-atr-v2");
    const flat = d => ({ date:d, open:100, high:101, low:99, close:100.5 });
    const days = ["2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
    const four = evaluateClaim(v2, days.slice(0, 4).map(flat), new Date("2026-10-07T21:00:00Z"), "test", NYSE_CALENDAR);
    assert.equal(four.status, "IMMATURE");
    const five = evaluateClaim(v2, days.map(flat), new Date("2026-10-08T21:00:00Z"), "test", NYSE_CALENDAR);
    assert.equal(five.result.outcome, "EXPIRED");
    assert.equal(five.result.rMultiple, 0.25);
    assert.equal(ledger.appendResults([five.result]).written, 1);

    const tr = buildTrackRecord(ledger);
    assert.equal(tr.comparisons["scan-apex-atr-v2"].baseline, "scan-baseline-atr-v2");
    assert.equal(tr.comparisons["scan-apex-v1"].baseline, "scan-baseline-v1");
    assert.equal(tr.apexVsBaseline, tr.comparisons["scan-apex-v1"]);
    assert.match(tr.comparisons["scan-apex-atr-v2"].verdict, /NO VERDICT/);
    assert.equal(tr.rules["scan-apex-atr-v2"].resolved, 1);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test("every rule version is frozen", () => {
  for (const rule of Object.values(RULES)) assert.ok(Object.isFrozen(rule));
});

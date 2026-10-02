import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildScanClaims } from "../apex-v4/backend/lib/claimRecorder.js";
import { evaluateClaim } from "../apex-v4/backend/lib/outcomeEvaluator.js";
import { OutcomeLedger } from "../apex-v4/backend/lib/outcomeLedger.js";
import { OutcomeRunner } from "../apex-v4/backend/lib/outcomeRunner.js";
import { NYSE_CALENDAR } from "../apex-v4/backend/lib/nyseCalendar.js";
import { TwelveDataClient } from "../apex-v4/backend/lib/twelvedata.js";

const DECISION = new Date("2026-10-01T18:00:00Z");
const LATER = new Date("2026-10-06T21:00:00Z");
const apexV1 = (over = {}) => buildScanClaims([{ symbol:"TEST", price:100, apexScore:80, direction:1, ...over }], DECISION)
  .find(c => c.ruleVersion === "scan-apex-v1");

test("an opening-gap exit ignores the rest of that day's range in excursions", () => {
  const c = apexV1();   // target 112, stop 94, risk 6
  const up = evaluateClaim(c, [{ date:"2026-10-02", open:113, high:115, low:90, close:91 }], LATER, "t", NYSE_CALENDAR).result;
  assert.equal(up.outcome, "TARGET_FIRST");
  assert.equal(up.exitPrice, 113);
  assert.equal(up.maeR, 0, "the post-exit selloff to 90 is not an adverse excursion");
  assert.equal(up.mfeR, up.rMultiple);

  const down = evaluateClaim(c, [{ date:"2026-10-02", open:92, high:120, low:91, close:119 }], LATER, "t", NYSE_CALENDAR).result;
  assert.equal(down.outcome, "STOP_FIRST");
  assert.equal(down.mfeR, 0, "the post-exit rally to 120 is not a favourable excursion");
  assert.equal(down.maeR, down.rMultiple);
});

test("a symbol that keeps failing cannot starve others when runs are capped", async () => {
  const dir = mkdtempSync(join(tmpdir(), "outcomes-rot-"));
  try {
    const ledger = new OutcomeLedger(dir);
    // STUCK has the oldest claim, so the old ordering would always pick it first.
    ledger.appendClaims(buildScanClaims([{ symbol:"STUCK", price:100, apexScore:80, direction:1 }], new Date("2026-09-30T18:00:00Z")));
    ledger.appendClaims(buildScanClaims([{ symbol:"OK", price:100, apexScore:80, direction:1 }], DECISION));
    const tried = [];
    const tdClient = {
      async getTimeSeries(symbol) {
        tried.push(symbol);
        if (symbol === "STUCK") throw new Error("HTTP 500");
        return { values:[{ datetime:"2026-10-02", open:"100", high:"113", low:"99", close:"112" }] };
      },
    };
    const runner = new OutcomeRunner({ ledger, tdClient, sessionCalendar:NYSE_CALENDAR, maxSymbolsPerRun:1, log:{ warn() {} } });
    await runner.evaluate(LATER);
    await runner.evaluate(new Date(LATER.getTime() + 60_000));
    assert.deepEqual(tried, ["STUCK", "OK"]);
    assert.equal(ledger.pendingClaims().filter(c => c.symbol === "OK").length, 0, "OK got graded despite STUCK");
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test("the grader always asks for fresh bars, and fresh bypasses both caches", async () => {
  const dir = mkdtempSync(join(tmpdir(), "outcomes-fresh-"));
  try {
    const ledger = new OutcomeLedger(dir);
    ledger.appendClaims(buildScanClaims([{ symbol:"TEST", price:100, apexScore:80, direction:1 }], DECISION));
    const opts = [];
    const runner = new OutcomeRunner({ ledger, sessionCalendar:NYSE_CALENDAR, log:{ warn() {} },
      tdClient:{ async getTimeSeries(_s, _i, _n, o) { opts.push(o); return { values:[] }; } } });
    await runner.evaluate(LATER);
    assert.deepEqual(opts, [{ fresh:true }]);
  } finally { rmSync(dir, { recursive:true, force:true }); }

  const client = new TwelveDataClient("fake", 300);
  try {
    const calls = [];
    client._get = async (path, params, cost, o) => { calls.push(o); return { values:["fresh"] }; };
    client.cache.set("ts|TEST|1day|130", { values:["stale"] }, 60_000);
    assert.deepEqual(await client.getTimeSeries("TEST", "1day", 130), { values:["stale"] }, "normal reads still use the cache");
    assert.deepEqual(await client.getTimeSeries("TEST", "1day", 130, { fresh:true }), { values:["fresh"] });
    assert.deepEqual(calls, [{ noCache:true }]);
    assert.deepEqual(await client.getTimeSeries("TEST", "1day", 130), { values:["fresh"] }, "a fresh read refreshes the cache for the scanner");
  } finally { client.destroy(); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStockQuote } from "../apex-v4/backend/engine/quote.js";
import { calcApexScore } from "../apex-v4/backend/engine/apex.js";

test("APEX does not manufacture a 200 percent spread from a missing bid", () => {
  const quote = normalizeStockQuote({ close:"304.91" }, 300);
  assert.equal(quote.last, 304.91);
  assert.equal(quote.bid, null);
  assert.equal(quote.ask, null);
  assert.equal(quote.spreadPct, null);
  assert.equal(quote.spreadVerified, false);
});

test("APEX computes spread only from a positive non-crossed market", () => {
  const quote = normalizeStockQuote({ close:100.05, bid:100, ask:100.1 });
  assert.equal(quote.spreadPct, 0.1);
  assert.equal(quote.spreadVerified, true);
  assert.equal(normalizeStockQuote({ bid:100, ask:99 }).spreadPct, null);
});

test("unknown spread is neutral while a verified wide spread is penalized", () => {
  const metrics = quote => ({
    atrPct:{ score:100 },
    stableScore:{ score:100, adxPts:10 },
    relVol:{ score:100 },
    squeezeHit:{ score:100 },
    smartFlow:{ flow:100 },
    darvas:{ stateScore:100 },
    earlyEntry:{ score:100 },
    earnings:{ risk:0 },
    quote,
  });
  const unknown = calcApexScore(metrics({ spreadPct:null }));
  const tight = calcApexScore(metrics({ spreadPct:0.1 }));
  const wide = calcApexScore(metrics({ spreadPct:2 }));
  assert.equal(unknown, tight);
  assert.ok(wide < tight);
});

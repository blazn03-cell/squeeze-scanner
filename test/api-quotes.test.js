import test from "node:test";
import assert from "node:assert/strict";
import handler, { _normalizeQuote, _parseSymbols } from "../api/quotes.js";

function response() {
  return {
    statusCode:200, headers:{}, body:null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("quote normalization computes midpoint spread without rounding away risk", () => {
  const quote = _normalizeQuote({
    symbol:"AAPL", bid:200, ask:200.2, bidSize:10, askSize:12,
    timestamp:"2026-08-10T14:30:00.000Z", provider:"test", feed:"sip", nbbo:true,
  });
  assert.equal(quote.midpoint, 200.1);
  assert.ok(Math.abs(quote.spread - 0.2) < 1e-10);
  assert.ok(Math.abs(quote.spreadPct - 0.0999500249875) < 1e-10);
  assert.equal(quote.nbbo, true);
});

test("quote normalization rejects crossed and one-sided markets", () => {
  assert.equal(_normalizeQuote({ symbol:"A", bid:10, ask:9 }), null);
  assert.equal(_normalizeQuote({ symbol:"A", bid:0, ask:10 }), null);
  assert.equal(_normalizeQuote({ symbol:"A", bid:null, ask:10 }), null);
});

test("symbol parsing deduplicates and rejects malformed input", () => {
  assert.deepEqual(_parseSymbols("aapl,AAPL,BRK.B,$BAD,TOO-LONG-NAME"), ["AAPL", "BRK.B"]);
});

test("missing quote provider fails visibly", async () => {
  const names = [
    "ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY", "MASSIVE_API_KEY",
    "POLYGON_API_KEY", "TIINGO_API_KEY",
  ];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  try {
    const res = response();
    await handler({ query:{ symbols:"AAPL,MSFT" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.reason, "NO_QUOTE_PROVIDER_CONFIGURED");
  } finally {
    for (const name of names) saved[name] === undefined ? delete process.env[name] : process.env[name] = saved[name];
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import handler, { _clean, _selectProviderWindow } from "../api/bars.js";

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("clean rejects poisoned bars and sorts oldest first", () => {
  const rows = _clean([
    { t:"2026-08-02", o:2, h:3, l:1, c:2, v:"5" },
    { t:"2026-08-01", o:"1", h:"2", l:"1", c:"1.5", v:"10" },
    { t:"2026-08-03", o:2, h:1, l:2, c:2, v:5 },
    { t:"2026-08-04", o:2, h:3, l:1, c:0, v:5 },
  ]);
  assert.deepEqual(rows.map(x => x.t), ["2026-08-01", "2026-08-02"]);
  assert.equal(rows[0].v, 10);
});

test("no provider fails visibly without fabricating an empty success", async () => {
  const names = [
    "ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY", "TWELVEDATA_API_KEY",
    "POLYGON_API_KEY", "TIINGO_API_KEY", "ALPHAVANTAGE_API_KEY",
  ];
  const saved = Object.fromEntries(names.map(n => [n, process.env[n]]));
  for (const n of names) delete process.env[n];
  try {
    const res = response();
    await handler({ query:{} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.reason, "NO_PROVIDER_CONFIGURED");
    assert.ok(res.body.accepts.includes("TWELVEDATA_API_KEY"));
  } finally {
    for (const n of names) saved[n] === undefined ? delete process.env[n] : process.env[n] = saved[n];
  }
});

test("provider windows rotate through a rate-limited universe", () => {
  const provider = { adapter:{ windowDefault:8 } };
  const symbols = Array.from({ length:20 }, (_, index) => `S${index}`);
  const first = _selectProviderWindow(provider, symbols, null);
  assert.deepEqual(first.selected, symbols.slice(0, 8));
  assert.equal(first.nextCursor, 8);
  assert.equal(first.deferred.length, 12);

  const second = _selectProviderWindow(provider, symbols, "8");
  assert.deepEqual(second.selected, symbols.slice(8, 16));
  assert.equal(second.nextCursor, 16);

  const last = _selectProviderWindow(provider, symbols, "16");
  assert.deepEqual(last.selected, symbols.slice(16));
  assert.equal(last.nextCursor, null);
});

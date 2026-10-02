import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadEngine() {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const start = html.indexOf("const V4_INTRADAY_BARS_PER_DAY");
  const end = html.indexOf("const v4Color");
  const context = { console, Date, Math, Number, Object, Array, Set, String, JSON };
  vm.createContext(context);
  vm.runInContext(`${html.slice(start, end)}
globalThis.explainSetupState = explainSetupState;
globalThis.shareRiskExample = shareRiskExample;
globalThis.pickPracticeExample = pickPracticeExample;
globalThis.analyzeChartSetup = analyzeChartSetup;`, context);
  return context;
}

const DAY = 24 * 60 * 60 * 1000;
function dailyBars(count, close = 25, volume = 2_000_000) {
  const start = Date.parse("2026-01-02T21:00:00.000Z");
  return Array.from({ length:count }, (_, i) => ({
    t:new Date(start + i * DAY).toISOString(), o:close, h:close * 1.01, l:close * 0.99, c:close, v:volume,
  }));
}

test("every chart state gets a meaning, what is missing, why, and a next check", () => {
  const engine = loadEngine();
  const base = engine.analyzeChartSetup(dailyBars(60), { direction:1 });
  const variants = [
    { status:{ key:"blocked", label:"SKIP" } },
    { status:{ key:"wait", label:"NO SIDE" }, side:"none" },
    { status:{ key:"avoid", label:"LEARN ONLY" }, side:"down" },
    { status:{ key:"chase", label:"TOO FAR" } },
    { status:{ key:"watch", label:"WATCH" } },
    { status:{ key:"wait", label:"WAIT" }, side:"up" },
  ];
  const keys = variants.map(v => {
    const out = engine.explainSetupState({ ...base, ...v, status:{ color:"#fff", ...v.status } });
    for (const field of ["means", "why", "next"]) assert.ok(out[field].length > 10, `${v.status.label} ${field}`);
    assert.ok(out.missing.length >= 1);
    assert.doesNotMatch(JSON.stringify(out), /%|probab|chance|guarantee/i, "no win odds on the beginner path");
    return out.key;
  });
  assert.deepEqual(keys, ["blocked", "noside", "avoid", "chase", "watch", "wait"]);
  assert.equal(engine.explainSetupState(null), null);
});

test("weak volume is listed as missing; strong volume is not", () => {
  const engine = loadEngine();
  const base = engine.analyzeChartSetup(dailyBars(60), { direction:1 });
  const watch = { ...base, status:{ key:"watch", label:"WATCH", color:"#0f0" } };
  assert.ok(engine.explainSetupState({ ...watch, volumeRatio:0.8 }).missing.some(m => /volume/i.test(m)));
  assert.ok(!engine.explainSetupState({ ...watch, volumeRatio:1.6 }).missing.some(m => /volume/i.test(m)));
});

test("share risk is plain arithmetic on entry-to-line distance against the reader's limit", () => {
  const engine = loadEngine();
  const r = engine.shareRiskExample({ entry:50, invalidation:47.5, shares:10, budget:1000, riskPct:2 });
  assert.equal(r.perShare, 2.5);
  assert.equal(r.loss, 25);
  assert.equal(r.cost, 500);
  assert.equal(r.pctOfEntry, 5);
  assert.equal(r.cap, 20);
  assert.equal(r.overCap, true);
  assert.equal(r.sharesWithinCap, 8);

  const noLimit = engine.shareRiskExample({ entry:50, invalidation:47.5, shares:4 });
  assert.equal(noLimit.cap, null);
  assert.equal(noLimit.overCap, false);

  assert.equal(engine.shareRiskExample({ entry:50, invalidation:50, shares:10 }), null);
  assert.equal(engine.shareRiskExample({ entry:50, invalidation:null, shares:10 }), null);
  assert.equal(engine.shareRiskExample({ entry:50, invalidation:48, shares:0 }), null);
});

test("practice uses a real loaded move and only bars before it", () => {
  const engine = loadEngine();
  const history = dailyBars(90);
  history[80] = { ...history[80], o:25, h:29, l:24.8, c:28.5, v:4_000_000 };
  history[81] = { ...history[81], o:28.5, h:29.5, l:28, c:29, v:3_000_000 };
  const example = engine.pickPracticeExample({ TEST:history });
  assert.ok(example, "an example is found");
  assert.equal(example.ticker, "TEST");
  // The audit dates an event at the first session whose 3-day window holds the move.
  assert.ok(example.eventDate <= history[80].t.slice(0, 10));
  assert.ok(example.decisionDate < example.eventDate, "decision is strictly before the move");
  assert.equal(example.setup.last, 25, "the replay never sees the spike candles");
  assert.ok(example.outcome.forward.some(bar => bar.h >= 29), "the move itself is in the reveal window");
  assert.equal(example.outcome.type, "squeeze");
  assert.equal(example.outcome.forward[0].date, example.eventDate);
  assert.ok(example.state.next.length > 0);
});

test("no loaded move means no practice example rather than an invented one", () => {
  const engine = loadEngine();
  assert.equal(engine.pickPracticeExample({ FLAT:dailyBars(120) }), null);
  assert.equal(engine.pickPracticeExample({}), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadEngine() {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const start = html.indexOf("const V4_INTRADAY_BARS_PER_DAY");
  const end = html.indexOf("const v4Color");
  assert.ok(start >= 0 && end > start, "V4 engine block is present");
  const context = { console, Date, Math, Number, Object, Array, Set, String, JSON };
  vm.createContext(context);
  vm.runInContext(`${html.slice(start, end)}\nglobalThis.computeV4 = computeV4; globalThis.historicalMoveAudit = historicalMoveAudit; globalThis.historicalStockBacktest = historicalStockBacktest; globalThis.analyzeChartSetup = analyzeChartSetup; globalThis.buildOptionStrikeStudy = buildOptionStrikeStudy; globalThis.buildOptionBudgetStudy = buildOptionBudgetStudy;`, context);
  return context;
}

function bars({ count = 100, spacingMs, close = 20, volume = 1_000_000 }) {
  const start = Date.parse("2026-01-01T14:30:00.000Z");
  return Array.from({ length:count }, (_, index) => ({
    t:new Date(start + index * spacingMs).toISOString(),
    o:close, h:close * 1.01, l:close * 0.99, c:close, v:volume,
  }));
}

test("daily bars are not annualized as 78 intraday bars", () => {
  const engine = loadEngine();
  const daily = engine.computeV4(bars({ spacingMs:24 * 60 * 60 * 1000 }));
  assert.equal(daily.timeframe, "1d");
  assert.equal(daily.liquidity, 20_000_000);

  const intraday = engine.computeV4(bars({ spacingMs:5 * 60 * 1000, volume:1_000 }));
  assert.equal(intraday.timeframe, "intraday");
  assert.equal(intraday.liquidity, 1_560_000);
});

test("historical audit labels a liquid three-session squeeze from its prior price", () => {
  const engine = loadEngine();
  const history = bars({ count:90, spacingMs:24 * 60 * 60 * 1000, close:25, volume:2_000_000 });
  history[80] = { ...history[80], o:25, h:29, l:24.8, c:28.5, v:4_000_000 };
  history[81] = { ...history[81], o:28.5, h:29.5, l:28, c:29, v:3_000_000 };
  const audit = engine.historicalMoveAudit({ TEST:history });
  assert.equal(audit.coveredSymbols, 1);
  assert.equal(audit.squeeze.total, 1);
  assert.equal(audit.events[0].ticker, "TEST");
  assert.equal(audit.events[0].priorClose, 25);
  assert.ok(audit.events[0].movePct >= 12);
});

test("stock backtest enters after the signal and classifies a profitable trade", () => {
  const engine = loadEngine();
  const start = Date.parse("2026-01-01T14:30:00.000Z");
  const history = Array.from({ length:100 }, (_, index) => {
    const price = index < 65 ? 25 : 25 + (index - 65) * 0.5;
    return {
      t:new Date(start + index * 24 * 60 * 60 * 1000).toISOString(),
      o:price, h:price * 1.015, l:price * 0.99, c:price * 1.01,
      v:Math.max(2_000_000, 1_000_000 + index * 20_000),
    };
  });
  const result = engine.historicalStockBacktest({ TEST:history });
  assert.equal(result.total, 1);
  assert.equal(result.winners, 1);
  assert.equal(result.losers, 0);
  assert.equal(result.winRate, 100);
  assert.equal(result.trades[0].signalDate, "2026-03-08");
  assert.equal(result.trades[0].entryDate, "2026-03-09");
  assert.equal(result.trades[0].exitDate, "2026-03-11");
  assert.ok(result.trades[0].returnPct > 0);
});

test("chart guide recognizes a confirmed breakout and marks a study zone", () => {
  const engine = loadEngine();
  const history = bars({ count:40, spacingMs:24 * 60 * 60 * 1000, close:25, volume:2_000_000 });
  history[39] = { ...history[39], o:25.1, h:26.2, l:25, c:26, v:3_000_000 };

  const setup = engine.analyzeChartSetup(history, {
    direction:1,
    timing:1,
    regimeName:"BREAKOUT",
    quality:{ eligible:true },
  });

  assert.equal(setup.patternKey, "breakout");
  assert.equal(setup.side, "up");
  assert.ok(setup.support < setup.resistance);
  assert.ok(Number.isFinite(setup.zoneLow));
  assert.ok(Number.isFinite(setup.invalidation));
});

test("chart guide labels downside setups as learn-only for beginners", () => {
  const engine = loadEngine();
  const history = bars({ count:40, spacingMs:24 * 60 * 60 * 1000, close:25, volume:2_000_000 });
  const setup = engine.analyzeChartSetup(history, {
    direction:-1,
    timing:1,
    quality:{ eligible:true },
  });

  assert.equal(setup.side, "down");
  assert.equal(setup.status.key, "avoid");
  assert.equal(setup.status.label, "LEARN ONLY");
});

test("options lesson references a nearby observed call strike and chart support", () => {
  const engine = loadEngine();
  const history = bars({ count:40, spacingMs:24 * 60 * 60 * 1000, close:25, volume:2_000_000 });
  const study = engine.buildOptionStrikeStudy({
    last:25,
    direction:1,
    score:75,
    quality:{ eligible:true },
  }, [{
    strike:"$26c",
    expiry:"Sep 18",
    sweepOk:true,
    ask_pct:0.82,
    trade_day:1,
    premium:500_000,
  }], history);

  assert.equal(study.observedCall.label, "$26C");
  assert.equal(study.callReferenceUsable, true);
  assert.equal(study.directionalAction, "BUY CALL RESEARCH");
  assert.equal(study.directionalContract.label, "$26C");
  assert.equal(study.stance, "research");
  assert.ok(study.putReference < 25);
  assert.equal(study.estimatedCashSecuredCollateral, Math.round(study.putReference * 100));
});

test("gamma flush requires short gamma, put buying, and falling price", () => {
  const engine = loadEngine();
  const history = bars({ count:40, spacingMs:24 * 60 * 60 * 1000, close:25, volume:2_000_000 });
  const baseFlow = {
    strike:"$24p",
    expiry:"Sep 18",
    cat:"flush",
    sqType:"gamma_flush",
    sweepOk:true,
    ask_pct:0.85,
    trade_day:1,
  };
  const confirmed = engine.buildOptionStrikeStudy({ last:25, direction:-1, score:75 }, [
    { ...baseFlow, gex:{ bias:"short_gamma" } },
  ], history);
  assert.equal(confirmed.flush.key, "gamma_flush");
  assert.equal(confirmed.stance, "avoid_bullish");
  assert.equal(confirmed.directionalAction, "BUY PUT RESEARCH");
  assert.equal(confirmed.directionalContract.label, "$24P");

  const dampened = engine.buildOptionStrikeStudy({ last:25, direction:-1, score:75 }, [
    { ...baseFlow, gex:{ bias:"long_gamma" } },
  ], history);
  assert.equal(dampened.flush.key, "gamma_unconfirmed");
  assert.match(dampened.flush.label, /UNCONFIRMED/);
  assert.equal(dampened.directionalContract, null);
});

test("option budget converts a $50 limit into a one-contract ask ceiling", () => {
  const engine = loadEngine();
  const optionStudy = {
    directionalAction:"BUY CALL RESEARCH",
    directionalContract:{ label:"$65C", expiry:"Sep 18" },
  };

  const fullRisk = engine.buildOptionBudgetStudy(optionStudy, 50, 100);
  assert.equal(fullRisk.maxPremium, 50);
  assert.equal(fullRisk.maxAskPerShare, 0.5);
  assert.equal(fullRisk.ready, true);

  const dangerZone = engine.buildOptionBudgetStudy(optionStudy, 50, 30);
  assert.equal(dangerZone.maxPremium, 15);
  assert.equal(dangerZone.maxAskPerShare, 0.15);
});

test("option budget never invents a contract", () => {
  const engine = loadEngine();
  const study = engine.buildOptionBudgetStudy({}, 50, 100);
  assert.equal(study.contract, null);
  assert.equal(study.action, null);
  assert.equal(study.ready, false);
});

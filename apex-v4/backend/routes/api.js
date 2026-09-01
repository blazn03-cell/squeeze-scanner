import { Router } from 'express';
import { scanSymbol } from '../engine/scanner.js';
import { buildQqqCascadeSnapshot } from '../engine/cascade.js';

const VIEWS = {
  apex_long:    r => r.apexScore >= 70 && r.direction >= 1,
  apex_short:   r => r.apexScore >= 70 && r.direction <= -1,
  breakout:     r => r.darvasState === 'BREAKOUT' || r.regime === 'BREAKOUT',
  squeeze_fire: r => r.sqzState === 'FIRING',
  high_rvol:    r => (r.relVol ?? 0) >= 2,
  stable:       r => (r.stable ?? 0) >= 65,
  early_entry:  r => (r.earlyEntry ?? 0) >= 50 && r.apexScore >= 50,
  momentum:     r => r.regime === 'TREND' && r.direction !== 0,
  reversal:     r => r.regime === 'REVERSAL',
  master:       r => r.apexScore >= 75,
};

export function createApiRouter(tdClient, decisionLog, universeSymbols) {
  const router     = Router();
  let lastScan     = null;
  let scanRunning  = false;

  router.get('/scan', (req, res) => {
    if (!lastScan) return res.json({ results: [], meta: { status: 'not_run' } });
    res.json({ results: lastScan.results, meta: { ...lastScan.meta, cached: true } });
  });

  router.post('/scan', async (req, res) => {
    if (scanRunning) return res.status(409).json({ error: 'Scan already in progress' });
    const symbols = (req.body?.symbols?.length ? req.body.symbols : universeSymbols)
      .slice(0, Math.min(parseInt(req.query.limit) || 50, 200));
    const est = tdClient.estimateScanCost(symbols.length);
    console.log(`[scan] ${symbols.length} symbols — est ${est.total} credits`);
    decisionLog.logScanStart(symbols.length, est);
    res.json({ status: 'started', symbols: symbols.length, estimate: est });
    scanRunning = true;
    const t0    = Date.now();
    try {
      const BATCH   = 5;
      const results = [];
      for (let i = 0; i < symbols.length; i += BATCH) {
        const batch = symbols.slice(i, i + BATCH);
        const out   = await Promise.all(batch.map(s => scanSymbol(s, tdClient, { withEarnings: false }).catch(() => null)));
        results.push(...out.filter(Boolean));
      }
      results.sort((a, b) => (b.apexScore ?? 0) - (a.apexScore ?? 0));
      results.forEach(r => decisionLog.logSymbol(r));
      const meta = { scanned: symbols.length, returned: results.length, durationMs: Date.now() - t0, at: new Date().toISOString(), credits: tdClient.creditReport() };
      lastScan = { results, meta };
      decisionLog.logScanEnd(results.length, meta.durationMs, meta.credits);
    } catch (e) {
      console.error('[scan] Error:', e.message);
    } finally {
      scanRunning = false;
    }
  });

  router.get('/cascade/qqq', async (req, res) => {
    try {
      let qqq = lastScan?.results?.find(r => r.symbol === 'QQQ') ?? null;
      if (!qqq) qqq = await scanSymbol('QQQ', tdClient, { withEarnings: false });
      if (!qqq) return res.status(404).json({ error: 'QQQ data unavailable' });
      res.json(buildQqqCascadeSnapshot(qqq));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/symbol/:ticker', async (req, res) => {
    try {
      const result = await scanSymbol(req.params.ticker.toUpperCase(), tdClient, { withEarnings: true });
      if (!result) return res.status(404).json({ error: 'No data returned' });
      decisionLog.logSymbol(result);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/view/:name', (req, res) => {
    if (!lastScan) return res.json({ results: [], meta: { status: 'no_scan_yet' } });
    const filter = VIEWS[req.params.name];
    if (!filter) return res.status(404).json({ error: `Unknown view: ${req.params.name}`, available: Object.keys(VIEWS) });
    const filtered = lastScan.results.filter(filter);
    res.json({ results: filtered, meta: { ...lastScan.meta, view: req.params.name, count: filtered.length } });
  });

  router.get('/views',    (req, res) => res.json({ views: Object.keys(VIEWS) }));
  router.get('/credits',  (req, res) => res.json(tdClient.creditReport()));
  router.get('/universe', (req, res) => res.json({ symbols: universeSymbols, count: universeSymbols.length }));

  return router;
}

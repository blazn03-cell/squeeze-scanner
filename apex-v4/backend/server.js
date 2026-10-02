import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import { TwelveDataClient } from './lib/twelvedata.js';
import { DecisionLog }      from './lib/decisionLog.js';
import { createApiRouter }  from './routes/api.js';
import { OutcomeLedger }    from './lib/outcomeLedger.js';
import { OutcomeRunner }    from './lib/outcomeRunner.js';
import { buildTrackRecord } from './lib/trackRecord.js';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TD_KEY = process.env.TWELVEDATA_API_KEY;
const CREDITS_PER_MINUTE = parseInt(process.env.CREDITS_PER_MINUTE) || 8;
const PORT               = parseInt(process.env.PORT) || 3000;

const DEFAULT_UNIVERSE = [
  'AAPL','MSFT','NVDA','AMD','TSLA','META','GOOGL','AMZN','NFLX','SPY',
  'QQQ','SMCI','PLTR','MARA','COIN','RBLX','RIVN','LCID','GME','AMC',
  'SOFI','HOOD','UPST','OPEN','BYND',
];

const UNIVERSE = process.env.UNIVERSE
  ? process.env.UNIVERSE.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_UNIVERSE;

const tdClient    = TD_KEY ? new TwelveDataClient(TD_KEY, CREDITS_PER_MINUTE) : null;
const decisionLog = new DecisionLog(process.env.DECISION_LOG !== 'false');

// Outcome loop. On by default; OUTCOME_STORE_DIR should be a persistent disk mount in production.
let outcomes = null;
if (tdClient && process.env.OUTCOME_LEDGER !== 'false') {
  try {
    const ledger = new OutcomeLedger(process.env.OUTCOME_STORE_DIR || './data/outcomes');
    const sessionCalendar = process.env.OUTCOME_SESSION_CALENDAR_FILE
      ? JSON.parse(readFileSync(process.env.OUTCOME_SESSION_CALENDAR_FILE, 'utf8')) : null;
    const runner = new OutcomeRunner({ ledger, tdClient, sessionCalendar, maxSymbolsPerRun: parseInt(process.env.OUTCOME_MAX_SYMBOLS_PER_RUN) || 20 });
    outcomes = { ledger, runner, buildTrackRecord, persistent: process.env.OUTCOME_STORE_PERSISTENT === 'true' };
    const everyMin = parseInt(process.env.OUTCOME_EVAL_INTERVAL_MIN) || 360;
    setInterval(() => runner.maybeEvaluate().catch(() => {}), everyMin * 60 * 1000).unref();
    setTimeout(() => runner.maybeEvaluate().catch(() => {}), 60 * 1000).unref();
  } catch (e) {
    console.warn('[outcomes] Ledger unavailable, loop disabled:', e.message);
  }
}

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, '../frontend')));

const health = (_, res) => res.json({
  ok: true,
  service: 'apex-v4',
  dataConfigured: Boolean(tdClient),
  credits: tdClient ? tdClient.creditReport() : null,
  outcomes: outcomes ? { ...outcomes.ledger.stats(), persistent: outcomes.persistent } : null,
  time: new Date().toISOString(),
});

app.get('/api/health', health);
app.get('/health', health);

if (tdClient) {
  app.use('/api', createApiRouter(tdClient, decisionLog, UNIVERSE, outcomes));
} else {
  app.use('/api', (_, res) => res.status(503).json({
    ok: false,
    reason: 'NO_PROVIDER_CONFIGURED',
    message: 'Add TWELVEDATA_API_KEY in the Render Environment page. The server stays online while data is unavailable.',
  }));
}

app.get('*', (_, res) => res.sendFile(join(__dirname, '../frontend/index.html')));

app.listen(PORT, () => {
  console.log(`[server] APEX V4 on http://localhost:${PORT}`);
  console.log(`[server] Universe: ${UNIVERSE.length} symbols`);
  if (tdClient) {
    const est = tdClient.estimateScanCost(UNIVERSE.length);
    console.log(`[server] Credit budget: ${CREDITS_PER_MINUTE} cpm (80% safety) → ${est.ceiling} effective`);
    console.log(`[server] Scan cost estimate: ~${est.total} credits (${est.minutesNeeded.toFixed(1)} min)`);
  } else {
    console.warn('[server] Warning: TWELVEDATA_API_KEY is missing. Health and the frontend remain available; scans return setup help.');
  }
});

process.on('SIGTERM', () => { tdClient?.destroy(); process.exit(0); });
process.on('SIGINT',  () => { tdClient?.destroy(); process.exit(0); });

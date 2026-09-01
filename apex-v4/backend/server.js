import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import { TwelveDataClient } from './lib/twelvedata.js';
import { DecisionLog }      from './lib/decisionLog.js';
import { createApiRouter }  from './routes/api.js';

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

const FRONTEND = join(__dirname, '../frontend');
const LANDING  = join(FRONTEND, 'landing.html');
const APP_HTML = join(FRONTEND, 'index.html');

const app = express();
app.use(express.json());

// The marketing landing page owns '/'; the scanner lives at '/app'.
// index:false stops express.static from serving index.html as the directory index.
app.get('/', (_, res) => res.sendFile(LANDING));
app.use(express.static(FRONTEND, { index: false }));

const health = (_, res) => res.json({
  ok: true,
  service: 'apex-v4',
  dataConfigured: Boolean(tdClient),
  credits: tdClient ? tdClient.creditReport() : null,
  time: new Date().toISOString(),
});

app.get('/api/health', health);
app.get('/health', health);

if (tdClient) {
  app.use('/api', createApiRouter(tdClient, decisionLog, UNIVERSE));
} else {
  app.use('/api', (_, res) => res.status(503).json({
    ok: false,
    reason: 'NO_PROVIDER_CONFIGURED',
    message: 'Add TWELVEDATA_API_KEY in the Render Environment page. The server stays online while data is unavailable.',
  }));
}

app.get(['/app', '/app/*'], (_, res) => res.sendFile(APP_HTML));

// Anything else falls back to the landing page rather than dropping a first-time
// visitor into an empty scanner table.
app.get('*', (_, res) => res.sendFile(LANDING));

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

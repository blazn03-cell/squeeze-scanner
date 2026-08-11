import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import { TwelveDataClient } from './lib/twelvedata.js';
import { DecisionLog }      from './lib/decisionLog.js';
import { createApiRouter }  from './routes/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TD_KEY = process.env.TWELVEDATA_API_KEY;
if (!TD_KEY) {
  console.error('[server] Missing TWELVEDATA_API_KEY. Copy .env.example → .env and fill it in.');
  process.exit(1);
}

const CREDITS_PER_MINUTE = parseInt(process.env.CREDITS_PER_MINUTE) || 300;
const PORT               = parseInt(process.env.PORT) || 3000;

const DEFAULT_UNIVERSE = [
  'AAPL','MSFT','NVDA','AMD','TSLA','META','GOOGL','AMZN','NFLX','SPY',
  'QQQ','SMCI','PLTR','MARA','COIN','RBLX','RIVN','LCID','GME','AMC',
  'SOFI','HOOD','UPST','OPEN','BYND',
];

const UNIVERSE = process.env.UNIVERSE
  ? process.env.UNIVERSE.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_UNIVERSE;

const tdClient    = new TwelveDataClient(TD_KEY, CREDITS_PER_MINUTE);
const decisionLog = new DecisionLog(process.env.DECISION_LOG !== 'false');

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, '../frontend')));
app.use('/api', createApiRouter(tdClient, decisionLog, UNIVERSE));

app.get('/health', (_, res) => res.json({ ok: true, credits: tdClient.creditReport() }));
app.get('*', (_, res) => res.sendFile(join(__dirname, '../frontend/index.html')));

app.listen(PORT, () => {
  const est = tdClient.estimateScanCost(UNIVERSE.length);
  console.log(`[server] APEX V4 on http://localhost:${PORT}`);
  console.log(`[server] Universe: ${UNIVERSE.length} symbols`);
  console.log(`[server] Credit budget: ${CREDITS_PER_MINUTE} cpm (80% safety) → ${est.ceiling} effective`);
  console.log(`[server] Scan cost estimate: ~${est.total} credits (${est.minutesNeeded.toFixed(1)} min)`);
});

process.on('SIGTERM', () => { tdClient.destroy(); process.exit(0); });
process.on('SIGINT',  () => { tdClient.destroy(); process.exit(0); });

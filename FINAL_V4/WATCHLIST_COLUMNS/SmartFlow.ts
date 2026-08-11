# ==========================================================================
# SmartFlow.ts
# ==========================================================================
# PURPOSE      : Buying-vs-selling PRESSURE proxy, -100 to +100.
# AGGREGATION  : DAILY — the default and the MAXIMUM. 4h for faster 1-3 day trades.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : <-60 extreme bearish · -60..-25 bearish · -25..+25 neutral · +25..+60 bullish · >+60 extreme bullish.
# COLORS       : red shades selling · grey neutral · green shades buying.
# LIMITATIONS  : THIS IS A PROXY, NOT ORDER FLOW. ThinkScript stock scripts have no access to dark-pool prints, block trades, or institutional transaction tape. It is built from close-location-value * volume (Chaikin money flow), VWAP displacement, and relative-volume confirmation — all observable bar data. The dark-pool and GEX signals in this repo's dashboard come from the Unusual Whales API and have no ThinkScript equivalent.
# ==========================================================================

# ---- MODULE: PRICE ---------------------------------------------------------
# signalMode shifts EVERY input series by one bar, so the whole model inherits
# it without a single downstream branch. LIVE reads the forming bar (earlier,
# but the value changes until the bar closes). CLOSED_BAR reads only confirmed
# bars (one bar later, but the number is final once printed).
# LIVE is NOT repaint-proof. Nothing that reads a forming bar can be.
input signalMode = {default LIVE, CLOSED_BAR};
def closedBar = signalMode == signalMode.CLOSED_BAR;
def c = if closedBar then close[1] else close;
def h = if closedBar then high[1] else high;
def l = if closedBar then low[1] else low;
def o = if closedBar then open[1] else open;
def v = if closedBar then volume[1] else volume;

# ---- MODULE: MONEY FLOW (close-location weighted) ---------------------------
input flowLength = 20;
def barRange = h - l;
def clv    = if barRange <= 0 then 0 else (2 * c - h - l) / barRange;
def mfSum  = Sum(clv * v, flowLength);
def volSum = Sum(v, flowLength);
def cmf    = if volSum <= 0 then 0 else mfSum / volSum;

# ---- MODULE: ATR / VOLATILITY ----------------------------------------------
input atrLength = 14;
def tr     = TrueRange(h, c, l);
def atr    = WildersAverage(tr, atrLength);
def atrOK  = !IsNaN(atr) and atr > 0;
def atrPct = if c > 0 and atrOK then 100 * atr / c else Double.NaN;

# ---- MODULE: VWAP (intraday only; NaN-safe on daily+) -----------------------
def vw       = vwap;
def vwapOK   = !IsNaN(vw) and vw > 0;
def vwapEdge = if vwapOK and atrOK then Max(-1, Min(1, (c - vw) / (1.5 * atr))) else 0;
def vwapSide = if !vwapOK then 0 else if c > vw then 1 else if c < vw then -1 else 0;

# ---- MODULE: VOLUME / PARTICIPATION / LIQUIDITY -----------------------------
input rvolLength   = 30;
input minDollarVol = 2000000;
def avgVol    = Average(v, rvolLength);
def rvol      = if avgVol <= 0 then Double.NaN else v / avgVol;
def rvolSafe  = if IsNaN(rvol) then 0 else rvol;
def dollarVol = c * avgVol;
def volFast   = Average(v, 5);
def volSlow   = Average(v, 50);
def volTrend  = if volSlow <= 0 then 1 else volFast / volSlow;

# ---- MODULE: SMARTFLOW PROXY (-100..+100) -----------------------------------
# NOT institutional order flow. ThinkScript has no dark-pool / block-print feed.
# This is an observable buying-vs-selling PRESSURE proxy built from CLV*volume
# (Chaikin money flow), VWAP displacement, and relative-volume confirmation.
def cmfN     = Max(-1, Min(1, cmf / 0.25));
def cmfSign  = if cmfN > 0 then 1 else if cmfN < 0 then -1 else 0;
def rvolConf = Max(0, Min(1, (rvolSafe - 1) / 2));
def flowRaw  = 55 * cmfN + 25 * vwapEdge + 20 * cmfSign * rvolConf;
def smartFlow = Round(Max(-100, Min(100, flowRaw)), 0);

# ---- SCRIPT BODY -----------------------------------------------------------

plot Flow = smartFlow;
Flow.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if smartFlow >= 60 then CreateColor(0, 180, 95)
      else if smartFlow >= 25 then CreateColor(0, 115, 72)
      else if smartFlow <= -60 then CreateColor(190, 30, 58)
      else if smartFlow <= -25 then CreateColor(130, 40, 55)
      else CreateColor(35, 42, 52));

# ==========================================================================
# DarvasScan.ts
# ==========================================================================
# PURPOSE      : Darvas box breakout EVENT state.
# AGGREGATION  : DAILY — the default and the MAXIMUM. 4h for faster 1-3 day trades.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : -2 confirmed breakdown · -1 breakdown · 0 inside box · 1 approaching (within 1 ATR + rvol>=1) · 2 breakout · 3 confirmed breakout.
# COLORS       : red shades bearish · grey neutral · amber approaching · green breakout.
# LIMITATIONS  : Box edges use high[1]/low[1] so the CURRENT bar never redraws its own box — non-repainting. Intrabar the state can still flip until the bar closes.
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

# ---- MODULE: ATR / VOLATILITY ----------------------------------------------
input atrLength = 14;
def tr     = TrueRange(h, c, l);
def atr    = WildersAverage(tr, atrLength);
def atrOK  = !IsNaN(atr) and atr > 0;
def atrPct = if c > 0 and atrOK then 100 * atr / c else Double.NaN;

# ---- MODULE: DARVAS BOX (completed bars only -> non-repainting) -------------
input boxLength = 20;
def boxTop   = Highest(h[1], boxLength);
def boxBot   = Lowest(l[1], boxLength);
def boxRange = boxTop - boxBot;
def posInBox = if boxRange <= 0 then 0.5 else Max(0, Min(1, (c - boxBot) / boxRange));
def distTopATR = if atrOK then (boxTop - c) / atr else Double.NaN;
def distBotATR = if atrOK then (c - boxBot) / atr else Double.NaN;
def brokeOut   = c > boxTop;
def brokeDown  = c < boxBot;
def confirmUp  = brokeOut and c[1] > boxTop[1];
def confirmDn  = brokeDown and c[1] < boxBot[1];
def failedBO   = !brokeOut and (c[1] > boxTop[1] or c[2] > boxTop[2] or c[3] > boxTop[3]);
def sinceBO    = CompoundValue(1, if brokeOut and !brokeOut[1] then 0 else Min(sinceBO[1] + 1, 999), 999);
def boxRising  = if boxTop > boxTop[boxLength] then 1 else if boxTop < boxTop[boxLength] then -1 else 0;

# ---- MODULE: TREND STRUCTURE ------------------------------------------------
input trendFastLen = 8;
input trendMidLen  = 21;
input trendSlowLen = 50;
def emaF = ExpAverage(c, trendFastLen);
def emaM = ExpAverage(c, trendMidLen);
def emaS = ExpAverage(c, trendSlowLen);
def stackUp = (if emaF > emaM then 1 else 0) + (if emaM > emaS then 1 else 0) + (if c > emaF then 1 else 0);
def stackDn = (if emaF < emaM then 1 else 0) + (if emaM < emaS then 1 else 0) + (if c < emaF then 1 else 0);
def slopeATR = if atrOK then (emaM - emaM[10]) / atr else 0;

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

# ---- MODULE: DARVAS STATE + BIAS -------------------------------------------
# darvasScan = EVENT state. darvasBias = STRUCTURAL posture. Deliberately
# different: a stock can be structurally bullish (+2 bias) with no breakout (0).
def darvasScan =
      if confirmUp then 3
      else if brokeOut then 2
      else if !IsNaN(distTopATR) and distTopATR > 0 and distTopATR <= 1.0 and rvolSafe >= 1.0 then 1
      else if confirmDn then -2
      else if brokeDown then -1
      else 0;
def biasRaw = (if posInBox >= 0.80 then 2 else if posInBox >= 0.60 then 1
               else if posInBox <= 0.20 then -2 else if posInBox <= 0.40 then -1 else 0)
            + boxRising
            + (if stackUp == 3 then 1 else if stackDn == 3 then -1 else 0);
def darvasBias = if biasRaw >= 3 then 2 else if biasRaw >= 1 then 1
                 else if biasRaw <= -3 then -2 else if biasRaw <= -1 then -1 else 0;
def darvasQuality = Max(0, Min(100, 50 + 12 * darvasScan + 8 * darvasBias
      + (if !IsNaN(distTopATR) and distTopATR >= 0 and distTopATR <= 1 then 10 else 0)
      + (if failedBO then -15 else 0)));

# ---- SCRIPT BODY -----------------------------------------------------------

plot Darvas = darvasScan;
Darvas.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if darvasScan == 3 then CreateColor(0, 180, 95)
      else if darvasScan == 2 then CreateColor(0, 130, 80)
      else if darvasScan == 1 then CreateColor(150, 125, 0)
      else if darvasScan == -1 then CreateColor(130, 42, 55)
      else if darvasScan == -2 then CreateColor(185, 30, 55)
      else CreateColor(32, 38, 46));

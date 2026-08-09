# ==========================================================================
# V4_REGIME.ts
# ==========================================================================
# PURPOSE      : What KIND of setup this is, as a sortable number.
# AGGREGATION  : Same as APEX — Daily default, 4h fast variant.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : 0 CHOP · 1 TREND · 2 BREAKOUT · 3 SQUEEZE · 4 REVERSAL · 5 HIGH VOL · 6 LOW VOL.
# COLORS       : one colour per regime, matching the legend in DOCUMENTATION.
# LIMITATIONS  : Custom quotes cannot render text and stay sortable, so the number is authoritative. STUDIES/V4_Dashboard.ts prints the word on the chart.
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

# ---- MODULE: SQUEEZE (Bollinger inside Keltner) -----------------------------
input sqzLength = 20;
input bbFactor  = 2.0;
input kcFactor  = 1.5;
def basis  = Average(c, sqzLength);
def sd     = StDev(c, sqzLength);
def bbUp   = basis + bbFactor * sd;
def bbDn   = basis - bbFactor * sd;
def kcAvg  = Average(tr, sqzLength);
def kcUp   = basis + kcFactor * kcAvg;
def kcDn   = basis - kcFactor * kcAvg;
def sqzOn  = bbUp < kcUp and bbDn > kcDn;
def bbWidth = if basis <= 0 then Double.NaN else 100 * (bbUp - bbDn) / basis;
def bwLo    = Lowest(bbWidth, 100);
def bwHi    = Highest(bbWidth, 100);
def bwRank  = if IsNaN(bbWidth) or (bwHi - bwLo) <= 0 then 50 else 100 * (bbWidth - bwLo) / (bwHi - bwLo);
def sqzBars = CompoundValue(1, if sqzOn then sqzBars[1] + 1 else 0, 0);
def sqzFired = !sqzOn and sqzOn[1];
def sinceFire = CompoundValue(1, if sqzFired then 0 else Min(sinceFire[1] + 1, 999), 999);
def sqzMom = Inertia(c - ((Highest(h, sqzLength) + Lowest(l, sqzLength)) / 2 + basis) / 2, sqzLength);

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

# ---- MODULE: ADX / DI (self-contained, no study reference) ------------------
input adxLength = 14;
def upMove   = h - h[1];
def downMove = l[1] - l;
def plusDM   = if upMove > downMove and upMove > 0 then upMove else 0;
def minusDM  = if downMove > upMove and downMove > 0 then downMove else 0;
def trWil    = WildersAverage(tr, adxLength);
def plusDI   = if trWil <= 0 then 0 else 100 * WildersAverage(plusDM, adxLength) / trWil;
def minusDI  = if trWil <= 0 then 0 else 100 * WildersAverage(minusDM, adxLength) / trWil;
def diSum    = plusDI + minusDI;
def dx       = if diSum <= 0 then 0 else 100 * AbsValue(plusDI - minusDI) / diSum;
def adx      = WildersAverage(dx, adxLength);

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

# ---- MODULE: RSI (self-contained) ------------------------------------------
input rsiLength = 14;
def netChg = c - c[1];
def rsiUp  = WildersAverage(Max(netChg, 0), rsiLength);
def rsiDn  = WildersAverage(-Min(netChg, 0), rsiLength);
def rsi    = if (rsiUp + rsiDn) <= 0 then 50 else 100 * rsiUp / (rsiUp + rsiDn);

# ---- MODULE: MONEY FLOW (close-location weighted) ---------------------------
input flowLength = 20;
def barRange = h - l;
def clv    = if barRange <= 0 then 0 else (2 * c - h - l) / barRange;
def mfSum  = Sum(clv * v, flowLength);
def volSum = Sum(v, flowLength);
def cmf    = if volSum <= 0 then 0 else mfSum / volSum;

# ---- MODULE: REGIME (numeric so the column sorts) --------------------------
# 0 CHOP · 1 TREND · 2 BREAKOUT · 3 SQUEEZE · 4 REVERSAL · 5 HIGH VOL · 6 LOW VOL
def revUp = rsi < 32 and c > o and cmf > 0 and c > c[1];
def revDn = rsi > 68 and c < o and cmf < 0 and c < c[1];
def regime =
      if sqzOn then 3
      else if brokeOut or brokeDown or sinceFire <= 3 then 2
      else if revUp or revDn then 4
      else if adx >= 25 and AbsValue(slopeATR) >= 1 then 1
      else if !IsNaN(atrPct) and atrPct > 6 then 5
      else if !IsNaN(atrPct) and atrPct < 1 then 6
      else 0;

# ---- SCRIPT BODY -----------------------------------------------------------

plot Regime = regime;
Regime.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if regime == 3 then CreateColor(140, 80, 190)
      else if regime == 2 then CreateColor(0, 150, 160)
      else if regime == 1 then CreateColor(0, 140, 80)
      else if regime == 4 then CreateColor(200, 110, 30)
      else if regime == 5 then CreateColor(175, 40, 70)
      else if regime == 6 then CreateColor(50, 60, 75)
      else CreateColor(32, 38, 46));

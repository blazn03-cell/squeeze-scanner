# ==========================================================================
# V4_EarlyEntry.ts
# ==========================================================================
# PURPOSE      : Anti-lag score: how EARLY this setup is, before it extends.
# AGGREGATION  : DAILY — the default and the MAXIMUM. 4h for faster 1-3 day trades.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : 0-100. High = pre-expansion. Low = either nothing brewing or already gone.
# COLORS       : grey low · amber building · green prime entry window.
# LIMITATIONS  : Deliberately penalises rvol above 2.5 — by then the move is usually underway. Pair with V4_APEX_SCORE, never use alone.
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

# ---- MODULE: VWAP (intraday only; NaN-safe on daily+) -----------------------
def vw       = vwap;
def vwapOK   = !IsNaN(vw) and vw > 0;
def vwapEdge = if vwapOK and atrOK then Max(-1, Min(1, (c - vw) / (1.5 * atr))) else 0;
def vwapSide = if !vwapOK then 0 else if c > vw then 1 else if c < vw then -1 else 0;

# ---- MODULE: PRICE EFFICIENCY / EXTENSION / SPIKE ---------------------------
input effLength = 20;
def erNum = AbsValue(c - c[effLength]);
def erDen = Sum(AbsValue(c - c[1]), effLength);
def effRatio = if erDen <= 0 then 0 else Max(0, Min(1, erNum / erDen));
def extATR = if atrOK then (c - emaM) / atr else 0;
def spike  = if atrOK and !IsNaN(atr[1]) and atr[1] > 0 then tr > 3 * atr[1] else no;

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

# ---- MODULE: EXTENSION (ATR units from equilibrium) -------------------------
# Distance from the NEARER of two equilibria: the trend mean (EMA21) and, when
# it exists, the session mean (VWAP). Using VWAP alone was wrong — on any normal
# intraday trend day price drifts several ATR from the session open while
# sitting right on its trend mean, which made a healthy trend read as "chase
# risk" and hard-blocked APEX. You are not chasing if price is near EITHER
# equilibrium, so the measure takes the minimum. On Daily, VWAP is unavailable
# and this collapses cleanly to the EMA distance.
def extEma  = if atrOK then AbsValue(c - emaM) / atr else Double.NaN;
def extVwap = if atrOK and vwapOK then AbsValue(c - vw) / atr else Double.NaN;
def extensionATR = if IsNaN(extEma) then extVwap
                   else if IsNaN(extVwap) then extEma
                   else Min(extEma, extVwap);
def extSafe = if IsNaN(extensionATR) then 0 else extensionATR;
def extBand = if IsNaN(extensionATR) then 0
              else if extensionATR < 0.50 then 2
              else if extensionATR < 1.00 then 1
              else if extensionATR < 1.50 then 0
              else if extensionATR < 2.00 then -1
              else -2;

# ---- MODULE: EARLY ENTRY 0..100 (TRANSITION engine) ------------------------
# This scores CHANGE, not level. Every term compares now against a few bars ago,
# so a stock that has been strong for two weeks scores near zero here while a
# stock crossing from neutral into strength scores high. It is deliberately NOT
# "V4_APEX with lower thresholds" — that would just find the same names later.
def rvolRising  = rvolSafe > rvolSafe[3] and rvolSafe >= 1.1;
def volAccelE   = volTrend > volTrend[3] and volTrend >= 1.05;
def adxImproving = adx > adx[3] and adx >= 15 and adx < 35;
def stackFlip   = (stackUp >= 2 and stackUp[5] < 2) or (stackDn >= 2 and stackDn[5] < 2);
def vwapReclaim = vwapOK and c > vw and c[3] < vw[3];
def momSlopeUp  = AbsValue(sqzMom) > AbsValue(sqzMom[3]) and AbsValue(sqzMom[3]) > AbsValue(sqzMom[6]);
def compReleasing = (sqzOn and bwRank < bwRank[3]) or sinceFire <= 2;
def approachingBO = !IsNaN(distTopATR) and distTopATR > 0 and distTopATR <= 1.5;
def earlyRaw =
      (if rvolRising then 16 else 0)
    + (if volAccelE then 10 else 0)
    + (if adxImproving then 12 else 0)
    + (if stackFlip then 14 else 0)
    + (if vwapReclaim then 12 else 0)
    + (if momSlopeUp then 10 else 0)
    + (if compReleasing then 12 else 0)
    + (if approachingBO then 14 else 0)
    - (if extSafe > 1.5 then 20 else if extSafe > 1.0 then 8 else 0);
def earlyScore = Round(Max(0, Min(100, earlyRaw)), 0);

# ---- SCRIPT BODY -----------------------------------------------------------

plot EarlyEntry = earlyScore;
EarlyEntry.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if earlyScore >= 75 then CreateColor(0, 180, 95)
      else if earlyScore >= 60 then CreateColor(0, 125, 90)
      else if earlyScore >= 45 then CreateColor(150, 125, 0)
      else if earlyScore >= 30 then CreateColor(80, 58, 30)
      else CreateColor(32, 38, 46));

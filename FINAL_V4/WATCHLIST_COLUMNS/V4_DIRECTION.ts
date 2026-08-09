# ==========================================================================
# V4_DIRECTION.ts
# ==========================================================================
# PURPOSE      : Bull/bear orientation from six independent lenses.
# AGGREGATION  : Same as APEX.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : -2 strong bear · -1 bear · 0 neutral · +1 bull · +2 strong bull. +/-2 requires a net of 4 of 6 lenses.
# COLORS       : red shades bearish · grey neutral · green shades bullish.
# LIMITATIONS  : On daily aggregation the VWAP lens returns 0 (VWAP is intraday), so direction is decided by 5 lenses instead of 6. That is handled, not hidden.
# ==========================================================================

# ---- MODULE: PRICE ---------------------------------------------------------
def c = close;
def h = high;
def l = low;
def o = open;
def v = volume;

# ---- MODULE: ATR / VOLATILITY ----------------------------------------------
input atrLength = 14;
def tr     = TrueRange(h, c, l);
def atr    = WildersAverage(tr, atrLength);
def atrOK  = !IsNaN(atr) and atr > 0;
def atrPct = if c > 0 and atrOK then 100 * atr / c else Double.NaN;

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

# ---- MODULE: VWAP (intraday only; NaN-safe on daily+) -----------------------
def vw       = vwap;
def vwapOK   = !IsNaN(vw) and vw > 0;
def vwapEdge = if vwapOK and atrOK then Max(-1, Min(1, (c - vw) / (1.5 * atr))) else 0;
def vwapSide = if !vwapOK then 0 else if c > vw then 1 else if c < vw then -1 else 0;

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

# ---- MODULE: DIRECTION (-2..+2) AND CONFIDENCE (0..100) ---------------------
# Six deliberately different lenses. Confidence measures AGREEMENT between them,
# which is a different question from StableScore (setup quality).
def sigTrend  = if stackUp >= 2 and slopeATR > 0 then 1 else if stackDn >= 2 and slopeATR < 0 then -1 else 0;
def sigMom    = if rsi > 55 and sqzMom > 0 then 1 else if rsi < 45 and sqzMom < 0 then -1 else 0;
def sigFlow   = if cmf > 0.05 then 1 else if cmf < -0.05 then -1 else 0;
def sigStruct = if brokeOut or posInBox >= 0.75 then 1 else if brokeDown or posInBox <= 0.25 then -1 else 0;
def sigVwap   = vwapSide;
def sigDI     = if plusDI > minusDI then 1 else if minusDI > plusDI then -1 else 0;
def netSig    = sigTrend + sigMom + sigFlow + sigStruct + sigVwap + sigDI;
def activeSig = AbsValue(sigTrend) + AbsValue(sigMom) + AbsValue(sigFlow)
              + AbsValue(sigStruct) + AbsValue(sigVwap) + AbsValue(sigDI);
def direction = if netSig >= 4 then 2 else if netSig >= 2 then 1
                else if netSig <= -4 then -2 else if netSig <= -2 then -1 else 0;
def agreement = if activeSig <= 0 then 0 else 100 * AbsValue(netSig) / activeSig;
def confidence = Round(Max(0, Min(100,
      if direction == 0 then Min(45, agreement)
      else agreement * (0.75 + 0.25 * Min(1, activeSig / 6)))), 0);

# ---- SCRIPT BODY -----------------------------------------------------------

plot Direction = direction;
Direction.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if direction == 2 then CreateColor(0, 175, 95)
      else if direction == 1 then CreateColor(0, 110, 70)
      else if direction == -1 then CreateColor(130, 40, 55)
      else if direction == -2 then CreateColor(185, 30, 55)
      else CreateColor(35, 42, 52));

# ==========================================================================
# V4_Confirmed.ts
# ==========================================================================
# PURPOSE      : How many independent subsystems agree — breadth, not magnitude.
# AGGREGATION  : Same as StableScore — Daily default, 4h fast variant.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : 0 NO SETUP · 1 WATCH · 2 DEVELOPING · 3 CONFIRMED · 4 APEX. Anything failing the liquidity floor is forced to 0.
# COLORS       : grey 0 · dim blue 1 · amber 2 · teal 3 · bright green 4.
# LIMITATIONS  : Relative strength vs an index is NOT one of the categories — see V4_RelStrength.ts, which is kept separate because it loads a second symbol.
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

# ---- MODULE: RSI (self-contained) ------------------------------------------
input rsiLength = 14;
def netChg = c - c[1];
def rsiUp  = WildersAverage(Max(netChg, 0), rsiLength);
def rsiDn  = WildersAverage(-Min(netChg, 0), rsiLength);
def rsi    = if (rsiUp + rsiDn) <= 0 then 50 else 100 * rsiUp / (rsiUp + rsiDn);

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

# ---- MODULE: PRICE EFFICIENCY / EXTENSION / SPIKE ---------------------------
input effLength = 20;
def erNum = AbsValue(c - c[effLength]);
def erDen = Sum(AbsValue(c - c[1]), effLength);
def effRatio = if erDen <= 0 then 0 else Max(0, Min(1, erNum / erDen));
def extATR = if atrOK then (c - emaM) / atr else 0;
def spike  = if atrOK and !IsNaN(atr[1]) and atr[1] > 0 then tr > 3 * atr[1] else no;

# ---- MODULE: STABLE SCORE 0..100 (six correlation-separated buckets) --------
# Correlated indicators are pooled INSIDE a bucket and the bucket is capped, so
# EMA stack + ADX + slope (all trend proxies) cannot stack to more than 20 pts.
def trendPts = Min(20,
      (if stackUp == 3 or stackDn == 3 then 8 else if stackUp == 2 or stackDn == 2 then 5 else 0)
    + (if adx >= 30 then 7 else if adx >= 22 then 5 else if adx >= 16 then 2 else 0)
    + (if AbsValue(slopeATR) >= 2 then 5 else if AbsValue(slopeATR) >= 1 then 3 else 0));

def rsiQual = if rsi >= 55 and rsi <= 72 then 6
              else if rsi <= 45 and rsi >= 28 then 6
              else if rsi > 78 or rsi < 22 then 1
              else if rsi > 72 or rsi < 28 then 2 else 3;
def momPts = Min(15, rsiQual
    + (if effRatio >= 0.45 then 5 else if effRatio >= 0.30 then 3 else 0)
    + (if AbsValue(sqzMom) > AbsValue(sqzMom[3]) then 4 else 0));

def rvolPts = if rvolSafe >= 3 then 12 else if rvolSafe >= 2 then 10
              else if rvolSafe >= 1.5 then 8 else if rvolSafe >= 1.0 then 5
              else if rvolSafe >= 0.75 then 2 else 0;
def partPts = Min(20, rvolPts
    + (if volTrend >= 1.3 then 4 else if volTrend >= 1.1 then 2 else 0)
    + (if AbsValue(cmf) >= 0.15 then 4 else if AbsValue(cmf) >= 0.07 then 2 else 0));

def atrBand = if IsNaN(atrPct) then 0
              else if atrPct >= 1.5 and atrPct <= 5 then 10
              else if atrPct >= 1.0 and atrPct < 1.5 then 7
              else if atrPct > 5 and atrPct <= 8 then 6
              else if atrPct > 8 then 2 else 3;
def atrMean = Average(atr, 20);
def atrStable = if atrOK and atrMean > 0 then (if AbsValue(atr / atrMean - 1) <= 0.35 then 5 else 2) else 0;
def volaPts = Min(15, atrBand + atrStable);

def locPts = Min(15,
      (if posInBox >= 0.75 or posInBox <= 0.25 then 6 else 3)
    + (if !IsNaN(distTopATR) and distTopATR >= 0 and distTopATR <= 1.5 then 5
       else if brokeOut or brokeDown then 4 else 0)
    + (if AbsValue(extATR) <= 3 then 4 else 0));

def liqPts = if dollarVol >= 100000000 then 15
             else if dollarVol >= 25000000 then 12
             else if dollarVol >= 10000000 then 9
             else if dollarVol >= minDollarVol then 5 else 0;

def rawStable = trendPts + momPts + partPts + volaPts + locPts + liqPts;

# ---- ANTI-FALSE-POSITIVE ENGINE (multiplicative, floored at 0.40) ----------
def penalty =
      (if dollarVol < minDollarVol then 0.55 else 1)
    * (if rvolSafe < 0.50 then 0.80 else 1)
    * (if spike then 0.80 else 1)
    * (if AbsValue(extATR) > 4 then 0.80 else 1)
    * (if adx < 15 and !sqzOn then 0.85 else 1)
    * (if !IsNaN(atrPct) and atrPct > 12 then 0.75 else 1)
    * (if failedBO then 0.80 else 1);
def penaltyFloor = Max(0.40, penalty);

# ---- CONFIRMATION GATE: no single reading can manufacture an elite score ----
def buckets70 = (if trendPts >= 14 then 1 else 0) + (if momPts >= 10.5 then 1 else 0)
              + (if partPts >= 14 then 1 else 0) + (if volaPts >= 10.5 then 1 else 0)
              + (if locPts  >= 10.5 then 1 else 0) + (if liqPts  >= 10.5 then 1 else 0);
def stableUncapped = rawStable * penaltyFloor;
def stableScore = Round(Max(0, Min(100,
      if buckets70 >= 3 then stableUncapped else Min(74, stableUncapped))), 0);

# ---- MODULE: VWAP (intraday only; NaN-safe on daily+) -----------------------
def vw       = vwap;
def vwapOK   = !IsNaN(vw) and vw > 0;
def vwapEdge = if vwapOK and atrOK then Max(-1, Min(1, (c - vw) / (1.5 * atr))) else 0;
def vwapSide = if !vwapOK then 0 else if c > vw then 1 else if c < vw then -1 else 0;

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

# ---- MODULE: SMARTFLOW PROXY (-100..+100) -----------------------------------
# NOT institutional order flow. ThinkScript has no dark-pool / block-print feed.
# This is an observable buying-vs-selling PRESSURE proxy built from CLV*volume
# (Chaikin money flow), VWAP displacement, and relative-volume confirmation.
def cmfN     = Max(-1, Min(1, cmf / 0.25));
def cmfSign  = if cmfN > 0 then 1 else if cmfN < 0 then -1 else 0;
def rvolConf = Max(0, Min(1, (rvolSafe - 1) / 2));
def flowRaw  = 55 * cmfN + 25 * vwapEdge + 20 * cmfSign * rvolConf;
def smartFlow = Round(Max(-100, Min(100, flowRaw)), 0);

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

# ---- MODULE: V4 CONFIRMATION LEVEL 0..4 ------------------------------------
# Counts how many INDEPENDENT subsystems agree. Not a second StableScore:
# StableScore grades magnitude, this grades breadth of confirmation.
def cTrend  = (stackUp >= 2 or stackDn >= 2) and adx >= 20;
def cMom    = AbsValue(sqzMom) > AbsValue(sqzMom[3]) and ((sqzMom > 0 and rsi > 50) or (sqzMom < 0 and rsi < 50));
def cVol    = rvolSafe >= 1.25;
def cVola   = !IsNaN(atrPct) and atrPct >= 1.0 and atrPct <= 8;
def cStruct = AbsValue(darvasScan) >= 1;
def cFlow   = AbsValue(smartFlow) >= 25;
def cSqz    = sqzOn or sinceFire <= 5;
def cLiq    = dollarVol >= minDollarVol;
def confCount = (if cTrend then 1 else 0) + (if cMom then 1 else 0) + (if cVol then 1 else 0)
              + (if cVola then 1 else 0) + (if cStruct then 1 else 0) + (if cFlow then 1 else 0)
              + (if cSqz then 1 else 0);
def v4Confirmed =
      if !cLiq then 0
      else if confCount >= 6 and stableScore >= 75 and confidence >= 70 then 4
      else if confCount >= 5 and stableScore >= 65 then 3
      else if confCount >= 3 and stableScore >= 55 then 2
      else if confCount >= 2 then 1
      else 0;

# ---- SCRIPT BODY -----------------------------------------------------------

plot Confirmed = v4Confirmed;
Confirmed.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if v4Confirmed == 4 then CreateColor(0, 180, 95)
      else if v4Confirmed == 3 then CreateColor(0, 120, 130)
      else if v4Confirmed == 2 then CreateColor(150, 125, 0)
      else if v4Confirmed == 1 then CreateColor(45, 65, 90)
      else CreateColor(30, 34, 40));

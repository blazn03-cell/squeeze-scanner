# ==========================================================================
# V4_EARLY_ENTRY_SCAN.ts
# ==========================================================================
# PURPOSE      : Good setups BEFORE full confirmation — the anti-lag scan.
# AGGREGATION  : 15m intraday, or daily for swing.
# INSTALL      : Scan tab > Stock Hacker > Add Study Filter > click the wrench on the filter > thinkScript Editor > paste > OK. Leave the condition as 'plot is true'.
# OUTPUT       : true = symbol passes. High EarlyEntry, moderate rvol, not yet extended. Expect these to look less impressive than the APEX names. That is the point.
# COLORS       : n/a — scan filters have no colour output.
# LIMITATIONS  : Exactly one plot, no labels, no bubbles, no secondary aggregation. Set the scan aggregation in the Study Filter's own dropdown and keep it identical to your watchlist columns or the numbers will not match. This scan intentionally accepts a LOWER StableScore and REJECTS extended names, so it will not overlap much with V4_APEX_LONG.
# ==========================================================================

# ---- MODULE: PRICE ---------------------------------------------------------
def c = close;
def h = high;
def l = low;
def o = open;
def v = volume;

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

# ---- MODULE: EARLY ENTRY 0..100 --------------------------------------------
# Rewards the conditions that PRECEDE expansion and penalises extension. This is
# the anti-lag engine: a stock already 4 ATR above its 21 EMA scores poorly here
# no matter how strong every other column looks.
def earlyRaw =
      (if rvolSafe >= 1.2 and rvolSafe <= 2.5 then 20 else if rvolSafe > 2.5 then 8 else 0)
    + (if volTrend >= 1.15 then 12 else 0)
    + (if !IsNaN(distTopATR) and distTopATR > 0 and distTopATR <= 1.5 then 20
       else if brokeOut and sinceBO <= 1 then 12 else 0)
    + (if sqzOn and sqzBars >= 6 then 15 else if sinceFire <= 2 then 12 else 0)
    + (if (stackUp >= 2 and stackUp[5] < 2) or (stackDn >= 2 and stackDn[5] < 2) then 10 else 0)
    + (if vwapOK and c > vw and c[3] < vw[3] then 10 else 0)
    + (if AbsValue(sqzMom) > AbsValue(sqzMom[3]) then 8 else 0)
    + (if AbsValue(extATR) <= 2 then 15 else if AbsValue(extATR) <= 3 then 7 else 0);
def earlyScore = Round(Max(0, Min(100, earlyRaw)), 0);

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

# ---- MODULE: MONEY FLOW (close-location weighted) ---------------------------
input flowLength = 20;
def barRange = h - l;
def clv    = if barRange <= 0 then 0 else (2 * c - h - l) / barRange;
def mfSum  = Sum(clv * v, flowLength);
def volSum = Sum(v, flowLength);
def cmf    = if volSum <= 0 then 0 else mfSum / volSum;

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

input minEarly   = 60;
input minStable  = 50;
input maxExtATR  = 2.5;
input maxRvol    = 3.0;

plot scan = earlyScore >= minEarly
        and stableScore >= minStable
        and AbsValue(extATR) <= maxExtATR
        and rvolSafe <= maxRvol
        and rvolSafe >= 1.0
        and AbsValue(direction) >= 1
        and dollarVol >= minDollarVol;

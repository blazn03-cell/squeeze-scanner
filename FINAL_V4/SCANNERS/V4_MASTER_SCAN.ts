# ==========================================================================
# V4_MASTER_SCAN.ts
# ==========================================================================
# PURPOSE      : Best opportunities from ANY regime — one scan to run when short on time.
# AGGREGATION  : DAILY — the default and the MAXIMUM. 4h for faster 1-3 day trades.
# INSTALL      : Scan tab > Stock Hacker > Add Study Filter > click the wrench on the filter > thinkScript Editor > paste > OK. Leave the condition as 'plot is true'.
# OUTPUT       : true = symbol passes. Union of the APEX, breakout, squeeze-fire and early-entry paths, each carrying its own quality floor.
# COLORS       : n/a — scan filters have no colour output.
# LIMITATIONS  : Exactly one plot, no labels, no bubbles, no secondary aggregation. Set the scan aggregation in the Study Filter's own dropdown and keep it identical to your watchlist columns or the numbers will not match. Because it is a union it returns more names than any single scan. Sort by V4_APEX_SCORE and work top-down.
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

# ---- MODULE: SQUEEZE QUALITY 0..100 + STATE ---------------------------------
# Setup-quality score. It does NOT predict the future; it measures how well the
# current bar matches the pre-expansion template.
def compression = Max(0, Min(100, 100 - bwRank));
def durScore    = Min(100, sqzBars * 4);
def volRatio    = if volSlow <= 0 then 1 else volFast / volSlow;
def volContract = Max(0, Min(100, 100 * (1.4 - volRatio) / 0.8));
def atrSlow     = Average(atr, 50);
def atrCompress = if atrSlow <= 0 then 50 else Max(0, Min(100, 100 * (1.3 - atr / atrSlow) / 0.7));
def momBuild    = if AbsValue(sqzMom) > AbsValue(sqzMom[3]) then 100
                  else if AbsValue(sqzMom) > AbsValue(sqzMom[1]) then 60 else 20;
def sqzHitRaw = 0.30 * compression + 0.20 * durScore + 0.15 * volContract
              + 0.15 * atrCompress + 0.20 * momBuild;
def sqzHit = Round(Max(0, Min(100,
      if sqzOn then sqzHitRaw
      else if sinceFire <= 3 then Max(sqzHitRaw, 70)
      else if sinceFire <= 10 then sqzHitRaw * 0.85
      else sqzHitRaw * 0.60)), 0);
# 2 = SQUEEZE ACTIVE, 1 = FIRING (released <=3 bars), 0.5 handled as 1 too,
# -1 = POST-SQUEEZE MOMENTUM (4..10 bars out), 0 = no squeeze context
def sqzState = if sqzOn then 2 else if sinceFire <= 3 then 1 else if sinceFire <= 10 then -1 else 0;

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

# ---- MODULE: LIQUIDITY SCORE 0..100 ----------------------------------------
# Tradeability relative to the scan universe. This does NOT measure market
# depth, order-book thickness, or true slippage — ThinkScript charts expose
# none of those. It is dollar volume, price level, current participation and
# share turnover, which is what IS observable. BidAskSpread.ts is the only
# real spread reading in the set, and it exists only as a custom quote.
def liqDV = if dollarVol >= 200000000 then 45
            else if dollarVol >= 100000000 then 40
            else if dollarVol >= 50000000 then 34
            else if dollarVol >= 25000000 then 28
            else if dollarVol >= 10000000 then 20
            else if dollarVol >= 5000000 then 12
            else if dollarVol >= minDollarVol then 6
            else 0;
def liqPrice = if c >= 10 then 25 else if c >= 5 then 20 else if c >= 2 then 12 else if c >= 1 then 5 else 0;
def liqPart  = if rvolSafe >= 1.5 then 20 else if rvolSafe >= 1.0 then 16 else if rvolSafe >= 0.75 then 10 else 4;
def liqTurn  = if avgVol >= 2000000 then 10 else if avgVol >= 500000 then 7 else if avgVol >= 200000 then 4 else 0;
def liquidityScore = Round(Max(0, Min(100, liqDV + liqPrice + liqPart + liqTurn)), 0);

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

# ---- MODULE: APEX MASTER SCORE 0..100 --------------------------------------
# StableScore already carries trend / momentum / rvol / volatility / structure /
# liquidity with intra-bucket correlation control, so APEX does NOT re-add them.
# It blends StableScore with the three dimensions StableScore does not measure:
# pressure direction magnitude (SmartFlow), signal agreement (Confidence), and
# compression state (SqueezeHit). See DOCUMENTATION/SCORING_MODEL.md for the
# effective weight decomposition.
def apexRaw = 0.55 * stableScore
            + 0.20 * AbsValue(smartFlow)
            + 0.15 * confidence
            + 0.10 * sqzHit;
# QUALITY GATES. A high raw blend is necessary but never sufficient: an elite
# APEX has to clear four of six independent gates, and three conditions block
# elite status outright no matter how extreme the components are.
def apexGate = (if stableScore >= 55 then 1 else 0)
             + (if confidence >= 55 then 1 else 0)
             + (if AbsValue(smartFlow) >= 25 then 1 else 0)
             + (if AbsValue(darvasScan) >= 1 then 1 else 0)
             + (if liquidityScore >= 50 then 1 else 0)
             + (if direction != 0 then 1 else 0);
# Hard blocks: no directional read, untradeable, or already a chase.
def apexBlock = direction == 0 or liquidityScore < 35 or extSafe > 3.0;
# A one-bar spike maxes out SmartFlow and Confidence at the same time, which is
# enough to clear several gates on its own. StableScore already discounts it;
# APEX must discount it too or the spike leaks straight through the blend.
def apexPenalty = (if spike then 0.85 else 1) * (if failedBO then 0.90 else 1);
def apexScore = Round(Max(0, Min(100,
      (if apexBlock then Min(55, apexRaw)
       else if apexGate >= 4 then apexRaw
       else Min(72, apexRaw)) * apexPenalty)), 0);

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

# ---- MODULE: TIMING -2..+2 (entry maturity) --------------------------------
# -2 EXHAUSTED / VERY LATE · -1 EXTENDED · 0 NEUTRAL · +1 EARLY · +2 PRIME
# Separate from EarlyEntry: EarlyEntry scores how much TRANSITION is underway,
# Timing answers the blunter question of whether the move is still available.
def volAccel  = rvolSafe > rvolSafe[3] and rvolSafe >= 1.1;
def momAccel  = AbsValue(sqzMom) > AbsValue(sqzMom[3]);
def nearBO    = !IsNaN(distTopATR) and distTopATR > 0 and distTopATR <= 1.0;
def sqzTrans  = (sqzOn and sqzBars >= 5) or sinceFire <= 2;
def exhausted = (rsi > 78 or rsi < 22) and extSafe >= 1.5;
def timingRaw = extBand
              + (if volAccel then 1 else 0)
              + (if momAccel then 1 else 0)
              + (if nearBO then 1 else 0)
              + (if sqzTrans then 1 else 0)
              + (if exhausted then -2 else 0);
def v4Timing = if timingRaw >= 4 then 2 else if timingRaw >= 2 then 1
               else if timingRaw <= -3 then -2 else if timingRaw <= -1 then -1 else 0;

# ---- SCRIPT BODY -----------------------------------------------------------

input minApex = 68;

input minLiquidity = 45;

def liquid = dollarVol >= minDollarVol and liquidityScore >= minLiquidity;

def pathApex     = apexScore >= minApex and v4Confirmed >= 3 and AbsValue(direction) >= 1;
def pathBreakout = darvasScan >= 2 and rvolSafe >= 1.5 and stableScore >= 60 and !failedBO;
def pathSqueeze  = sinceFire <= 3 and !sqzOn and sqzHit >= 65 and rvolSafe >= 1.2;
def pathEarly    = earlyScore >= 65 and stableScore >= 55 and v4Timing >= 1;

plot scan = liquid and (pathApex or pathBreakout or pathSqueeze or pathEarly);

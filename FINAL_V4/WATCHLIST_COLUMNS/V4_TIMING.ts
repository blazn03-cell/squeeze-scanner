# ==========================================================================
# V4_TIMING.ts
# ==========================================================================
# PURPOSE      : Entry maturity — is this move still available, or already gone?
# AGGREGATION  : DAILY — the default and the MAXIMUM. 4h for faster 1-3 day trades.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : -2 exhausted/very late · -1 extended · 0 neutral · +1 early · +2 prime.
# COLORS       : red late · grey neutral · teal early · green prime.
# LIMITATIONS  : Timing and EarlyEntry answer different questions and will disagree. EarlyEntry scores how much TRANSITION is underway; Timing scores whether the move is still catchable. A stock can be +2 Timing with a low EarlyEntry (cheap, but nothing is happening yet).
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

# ---- MODULE: VWAP (intraday only; NaN-safe on daily+) -----------------------
def vw       = vwap;
def vwapOK   = !IsNaN(vw) and vw > 0;
def vwapEdge = if vwapOK and atrOK then Max(-1, Min(1, (c - vw) / (1.5 * atr))) else 0;
def vwapSide = if !vwapOK then 0 else if c > vw then 1 else if c < vw then -1 else 0;

# ---- MODULE: EXTENSION (ATR units from equilibrium) -------------------------
# Distance from the NEARER of two equilibria: the trend mean (EMA21) and, when
# it exists, the session mean (VWAP). Using VWAP alone was wrong — on any normal
# intraday trend day price drifts several ATR from the session open while
# sitting right on its trend mean, which made a healthy trend read as "chase
# risk" and hard-blocked the score. You are not chasing if price is near EITHER
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

# ---- MODULE: RSI (self-contained) ------------------------------------------
input rsiLength = 14;
def netChg = c - c[1];
def rsiUp  = WildersAverage(Max(netChg, 0), rsiLength);
def rsiDn  = WildersAverage(-Min(netChg, 0), rsiLength);
def rsi    = if (rsiUp + rsiDn) <= 0 then 50 else 100 * rsiUp / (rsiUp + rsiDn);

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

plot Timing = v4Timing;
Timing.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if v4Timing == 2 then CreateColor(0, 180, 95)
      else if v4Timing == 1 then CreateColor(0, 115, 125)
      else if v4Timing == -1 then CreateColor(150, 90, 30)
      else if v4Timing == -2 then CreateColor(185, 30, 55)
      else CreateColor(35, 42, 52));

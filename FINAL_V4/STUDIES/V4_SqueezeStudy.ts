# ==========================================================================
# V4_SqueezeStudy.ts
# ==========================================================================
# PURPOSE      : Squeeze dots and the momentum histogram the scanner reads.
# AGGREGATION  : Any.
# INSTALL      : Charts > Studies > Edit Studies > Create > paste > apply as a lower study.
# OUTPUT       : Histogram = sqzMom. Dots on the zero line = squeeze on/off.
# COLORS       : Violet dot = squeeze on, green dot = released. Bars green/red by momentum sign.
# LIMITATIONS  : This is the same math as the columns, not the built-in TTM_Squeeze. Readings will differ slightly from TTM_Squeeze by design.
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

# ---- SCRIPT BODY -----------------------------------------------------------

plot Mom = sqzMom;
Mom.SetPaintingStrategy(PaintingStrategy.HISTOGRAM);
Mom.SetLineWeight(3);
Mom.AssignValueColor(
      if sqzMom > 0 and sqzMom > sqzMom[1] then Color.GREEN
      else if sqzMom > 0 then Color.DARK_GREEN
      else if sqzMom < 0 and sqzMom < sqzMom[1] then Color.RED
      else Color.DARK_RED);

plot SqueezeDot = 0;
SqueezeDot.SetPaintingStrategy(PaintingStrategy.POINTS);
SqueezeDot.SetLineWeight(3);
SqueezeDot.AssignValueColor(if sqzOn then Color.VIOLET else Color.GREEN);

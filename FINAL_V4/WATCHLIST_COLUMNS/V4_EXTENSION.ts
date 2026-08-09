# ==========================================================================
# V4_EXTENSION.ts
# ==========================================================================
# PURPOSE      : How far price sits from equilibrium, in ATR units.
# AGGREGATION  : DAILY — the default and the MAXIMUM. 4h for faster 1-3 day trades.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : ATR units. <0.50 normal · 0.50-1.00 active · 1.00-1.50 extended · 1.50-2.00 highly extended · >2.00 chase risk.
# COLORS       : grey normal · teal active · amber extended · orange highly · red chase.
# LIMITATIONS  : Reference is VWAP intraday and the 21 EMA otherwise, so the number is comparable across aggregations but not identical. A legitimate breakout WILL read extended — that is correct, and why this column informs Timing rather than directly penalising StableScore below 4 ATR.
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

# ---- SCRIPT BODY -----------------------------------------------------------

plot Extension = if IsNaN(extensionATR) then Double.NaN else Round(extensionATR, 2);
Extension.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if IsNaN(extensionATR) then Color.DARK_GRAY
      else if extensionATR > 2.00 then CreateColor(190, 30, 58)
      else if extensionATR > 1.50 then CreateColor(180, 90, 30)
      else if extensionATR > 1.00 then CreateColor(150, 125, 0)
      else if extensionATR > 0.50 then CreateColor(0, 110, 130)
      else CreateColor(35, 42, 52));

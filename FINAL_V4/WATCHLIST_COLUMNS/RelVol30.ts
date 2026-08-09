# ==========================================================================
# RelVol30.ts
# ==========================================================================
# PURPOSE      : Current bar volume vs its own 30-bar average.
# AGGREGATION  : Daily is the honest default. See RelVol30Intraday.ts for intraday.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : <0.75 weak · 0.75-1.0 normal · 1.0-1.5 elevated · 1.5-2.0 strong · 2.0-3.0 very strong · 3.0+ exceptional.
# COLORS       : grey weak · amber elevated · teal strong · green exceptional.
# LIMITATIONS  : On an intraday aggregation the CURRENT bar is still forming, so the reading understates until the bar closes. That is exactly the distortion RelVol30Intraday.ts corrects.
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

# ---- SCRIPT BODY -----------------------------------------------------------

plot RelVol = Round(rvol, 2);
RelVol.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if IsNaN(rvol) then Color.DARK_GRAY
      else if rvol >= 3.0 then CreateColor(0, 180, 95)
      else if rvol >= 2.0 then CreateColor(0, 135, 85)
      else if rvol >= 1.5 then CreateColor(0, 110, 130)
      else if rvol >= 1.0 then CreateColor(150, 125, 0)
      else if rvol >= 0.75 then CreateColor(70, 55, 30)
      else CreateColor(32, 38, 46));

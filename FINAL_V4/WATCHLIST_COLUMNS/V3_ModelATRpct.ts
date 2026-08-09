# ==========================================================================
# V3_ModelATRpct.ts
# ==========================================================================
# PURPOSE      : ATR as a percentage of price — the tradeable-range gauge.
# AGGREGATION  : DAILY — the default and the MAXIMUM. 4h for faster 1-3 day trades. Set it on the column itself.
# INSTALL      : MarketWatch > Quotes > right-click a column header > Customize > scroll to bottom > Custom Quotes > new > paste > Apply.
# OUTPUT       : Numeric percent. <1 low · 1-2 moderate · 2-3 active · 3-5 strong · 5+ extreme.
# COLORS       : grey low · yellow moderate · cyan active · green strong · magenta extreme.
# LIMITATIONS  : ATR needs atrLength+1 bars of history; thin/new tickers show blank.
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

# ---- SCRIPT BODY -----------------------------------------------------------

plot ModelATRpct = Round(atrPct, 2);
ModelATRpct.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if IsNaN(atrPct) then Color.DARK_GRAY
      else if atrPct >= 8   then CreateColor(160, 0, 120)
      else if atrPct >= 5   then CreateColor(200, 40, 60)
      else if atrPct >= 3   then CreateColor(0, 150, 90)
      else if atrPct >= 2   then CreateColor(0, 120, 150)
      else if atrPct >= 1   then CreateColor(150, 130, 0)
      else CreateColor(30, 38, 48));

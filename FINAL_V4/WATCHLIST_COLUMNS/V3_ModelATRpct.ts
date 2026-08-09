# ==========================================================================
# V3_ModelATRpct.ts
# ==========================================================================
# PURPOSE      : ATR as a percentage of price — the tradeable-range gauge.
# AGGREGATION  : Daily for swing, 5m/15m for intraday. Set on the column itself.
# INSTALL      : MarketWatch > Quotes > right-click a column header > Customize > scroll to bottom > Custom Quotes > new > paste > Apply.
# OUTPUT       : Numeric percent. <1 low · 1-2 moderate · 2-3 active · 3-5 strong · 5+ extreme.
# COLORS       : grey low · yellow moderate · cyan active · green strong · magenta extreme.
# LIMITATIONS  : ATR needs atrLength+1 bars of history; thin/new tickers show blank.
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

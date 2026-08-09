# ==========================================================================
# V4_DaysToEarnings.ts
# ==========================================================================
# PURPOSE      : Trading days until the next earnings event, as a sortable number.
# AGGREGATION  : DAILY ONLY. Earnings events resolve at daily granularity.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste. Set the column aggregation to Day.
# OUTPUT       : Bars (= trading days on a daily chart) until the next event. BLANK when the calendar has no future event for the symbol — blank means unknown, not safe. Negative values are not emitted.
# COLORS       : red <=1 · orange <=3 · amber <=10 · teal <=21 · grey beyond.
# LIMITATIONS  : AGGREGATION CHANGES THE UNIT. GetEventOffset returns an offset in BARS, so on a daily chart the number is trading days, on 4h it is 4h bars, and on 15m it is 15m bars. Run this column on Day or the number is meaningless. Coverage is Schwab's event calendar: reliable for liquid US equities, thin for ADRs, small caps and recent listings. This column never estimates — if the calendar has nothing, it stays blank. EarningsRisk.ts is the one that falls back to a cycle estimate, and it caps such guesses at level 1.
# ==========================================================================

def nextOffset = GetEventOffset(Events.EARNINGS, 0);
# GetEventOffset returns a NEGATIVE offset for events ahead of the current bar.
# If your build reports 0 for every symbol, flip this comparison — see
# DOCUMENTATION/TOS_LIMITATIONS.md, item 1.
def hasNext = !IsNaN(nextOffset) and nextOffset < 0;

plot DaysToEarnings = if hasNext then -nextOffset else Double.NaN;
DaysToEarnings.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if IsNaN(DaysToEarnings) then Color.DARK_GRAY
      else if DaysToEarnings <= 1 then CreateColor(190, 30, 58)
      else if DaysToEarnings <= 3 then CreateColor(180, 90, 30)
      else if DaysToEarnings <= 10 then CreateColor(150, 125, 0)
      else if DaysToEarnings <= 21 then CreateColor(0, 105, 120)
      else CreateColor(32, 38, 46));

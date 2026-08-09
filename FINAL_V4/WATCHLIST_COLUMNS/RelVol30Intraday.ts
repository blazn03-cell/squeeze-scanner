# ==========================================================================
# RelVol30Intraday.ts
# ==========================================================================
# PURPOSE      : Session-cumulative volume vs the SAME time of day on prior sessions.
# AGGREGATION  : MUST match barsPerDay. 5m RTH -> 78 · 10m -> 39 · 15m -> 26 · 30m -> 13.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste, then set the column aggregation AND barsPerDay to the same timeframe.
# OUTPUT       : Ratio. 1.0 = exactly a normal day's pace at this hour. 2.0 = double pace.
# COLORS       : grey below pace · amber at pace · teal above · green exceptional.
# LIMITATIONS  : READ THIS. ThinkScript cannot fetch a true time-of-day volume profile in a watchlist column: secondary aggregation is unavailable and there is no intraday-profile function. What this DOES do is legitimate and defensible: it accumulates today's volume since the session open and compares it to the accumulated volume at the identical bar-of-day on each of the previous lookbackDays sessions, using fixed GetValue offsets of barsPerDay. Requirements: (1) the chart/column aggregation must equal barsPerDay, (2) extended-hours data must be OFF or every session will have a different bar count and the offsets will drift, (3) half sessions (early closes) will read high because their bar count is short. No part of this fabricates data.
# ==========================================================================

input barsPerDay   = 78;
input lookbackDays = 30;

def isNewDay = GetDay() != GetDay()[1];
def cumVol   = CompoundValue(1, if isNewDay then volume else cumVol[1] + volume, volume);

# Same bar-of-day cumulative volume on each of the previous N sessions.
# fold + GetValue keeps the offsets constant-free and avoids 30 hand-written lines.
# NaN must be skipped INSIDE the fold, otherwise one missing session poisons the
# whole sum and the column goes blank for the rest of the day.
def priorSum = fold i = 1 to lookbackDays + 1
               with s = 0
               do s + (if IsNaN(GetValue(cumVol, i * barsPerDay)) then 0
                       else GetValue(cumVol, i * barsPerDay));
def priorCount = fold j = 1 to lookbackDays + 1
                 with n = 0
                 do n + (if IsNaN(GetValue(cumVol, j * barsPerDay)) then 0 else 1);
def priorAvg = if priorCount <= 0 then Double.NaN else priorSum / priorCount;

plot RelVolIntraday = if IsNaN(priorAvg) or priorAvg <= 0 then Double.NaN
                      else Round(cumVol / priorAvg, 2);
RelVolIntraday.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if IsNaN(RelVolIntraday) then Color.DARK_GRAY
      else if RelVolIntraday >= 3.0 then CreateColor(0, 180, 95)
      else if RelVolIntraday >= 2.0 then CreateColor(0, 135, 85)
      else if RelVolIntraday >= 1.5 then CreateColor(0, 110, 130)
      else if RelVolIntraday >= 1.0 then CreateColor(150, 125, 0)
      else if RelVolIntraday >= 0.75 then CreateColor(70, 55, 30)
      else CreateColor(32, 38, 46));

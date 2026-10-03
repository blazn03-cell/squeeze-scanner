import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExplosivePotential,
  rankMostPotentialFirst,
  selectMostPotentialCandidate,
  buildWorkdayTextAlert,
  shouldSendWorkdayText,
} from '../lib/low-float-workday.js';

test('most explosive verified setup ranks first', () => {
  const rows = rankMostPotentialFirst([
    { symbol:'SLOW', price:8, floatShares:18_000_000, volume:2_000_000, avgVolume20:1_500_000,
      volume5m:100_000, priorVolume5m:90_000, vwap:8.1, openingRangeHigh:8.4 },
    { symbol:'GO', price:7.4, floatShares:5_000_000, volume:12_000_000, avgVolume20:1_000_000,
      volume5m:1_200_000, priorVolume5m:300_000, preMarketVolume:2_500_000,
      preMarketChangePct:15, vwap:7.0, openingRangeHigh:7.2, changePct:24,
      catalystConfirmed:true, catalystAgeMinutes:30, optionable:true,
      optionVolume:12000, nearOtmCallVolume:4000, nearOtmCallOpenInterest:700,
      optionSpreadPct:7, nearestOtmStrikePct:6, daysToExpiry:4 },
  ]);
  assert.equal(rows[0].symbol, 'GO');
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].topPick, true);
  assert.ok(rows[0].explosivePotentialScore > rows[1].explosivePotentialScore);
});

test('extended runner does not stay top merely because raw activity is huge', () => {
  const rows = rankMostPotentialFirst([
    { symbol:'CHASE', price:15, floatShares:3_000_000, volume:30_000_000, avgVolume20:1_000_000,
      volume5m:3_000_000, priorVolume5m:300_000, changePct:120, change5mPct:18,
      vwap:10, openingRangeHigh:11, dayHigh:15.1, catalystConfirmed:true },
    { symbol:'FRESH', price:7, floatShares:6_000_000, volume:9_000_000, avgVolume20:1_000_000,
      volume5m:900_000, priorVolume5m:300_000, changePct:22, vwap:6.7,
      openingRangeHigh:6.95, catalystConfirmed:true, catalystAgeMinutes:40 },
  ]);
  assert.equal(rows[0].symbol, 'FRESH');
  assert.equal(rows.find(r => r.symbol === 'CHASE').stage, 'EXTENDED');
});

test('potential score is explicitly not a probability', () => {
  const row = computeExplosivePotential({
    symbol:'TEST', price:6, floatShares:7_000_000, volume:5_000_000, avgVolume20:1_000_000,
  });
  assert.equal(row.potentialIsProbability, false);
});

test('workday text is built for armed/ignition candidate without buy language', () => {
  const top = selectMostPotentialCandidate([
    { symbol:'TXT', price:7.5, floatShares:5_000_000, volume:10_000_000, avgVolume20:1_000_000,
      volume5m:1_000_000, priorVolume5m:250_000, changePct:25, vwap:7.1,
      openingRangeHigh:7.3, catalystConfirmed:true, catalystAgeMinutes:20 },
  ]);
  const alert = buildWorkdayTextAlert(top, { url:'https://wallstreethustler.com/scanner.html' });
  assert.equal(alert.channel, 'SMS');
  assert.equal(alert.audience, 'WORKDAY_9_TO_5');
  assert.match(alert.text, /WSH 9-TO-5/);
  assert.match(alert.text, /Potential/);
  assert.match(alert.text, /Research alert, not a buy signal/);
  assert.doesNotMatch(alert.text, /buy now/i);
});

test('workday text gate only sends on meaningful armed/ignition changes', () => {
  const armed = computeExplosivePotential({
    symbol:'PING', price:8, floatShares:6_000_000, volume:7_000_000, avgVolume20:1_000_000,
    volume5m:700_000, priorVolume5m:300_000, changePct:18, vwap:7.7,
    openingRangeHigh:8.2, catalystConfirmed:true, catalystAgeMinutes:30,
  });
  assert.equal(armed.stage, 'ARMED');
  assert.equal(shouldSendWorkdayText(armed), true);
  assert.equal(shouldSendWorkdayText(armed, armed), false);

  const ignition = computeExplosivePotential({
    symbol:'PING', price:8.3, floatShares:6_000_000, volume:9_000_000, avgVolume20:1_000_000,
    volume5m:1_000_000, priorVolume5m:300_000, changePct:24, vwap:7.8,
    openingRangeHigh:8.1, catalystConfirmed:true, catalystAgeMinutes:35,
  });
  assert.equal(ignition.stage, 'IGNITION');
  assert.equal(shouldSendWorkdayText(ignition, armed), true);
});

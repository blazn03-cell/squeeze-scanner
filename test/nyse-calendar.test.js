import test from 'node:test';
import assert from 'node:assert/strict';
import {NYSE_CALENDAR as c} from '../apex-v4/backend/lib/nyseCalendar.js';
import {requiredSessions} from '../apex-v4/backend/lib/sessionCalendar.js';
test('NYSE calendar coverage has not expired: update before 2028',()=>{
  assert(new Date().toISOString().slice(0,10)<=c.through,'NYSE calendar exhausted; source and version next years before release');
});
test('NYSE scheduled holiday and early-close exceptions match sourced 2026–2027 schedule',()=>{
  const lookup=new Map(c.sessions.map(s=>[s.date,s]));
  for(const d of ['2026-01-01','2026-04-03','2026-07-03','2026-11-26','2026-12-25','2027-03-26','2027-06-18','2027-07-05','2027-12-24'])assert(!lookup.has(d),d);
  assert.equal(c.sessions.filter(s=>s.earlyClose).map(s=>s.date).join(','),'2026-11-27,2026-12-24,2027-11-26');
  assert.equal(lookup.get('2026-11-27').exchangeCloseAt,'2026-11-27T18:00:00.000Z');
  assert.equal(lookup.get('2026-11-27').closeAt,'2026-11-27T18:15:00.000Z');
  assert(lookup.has('2027-12-31'),'NYSE does not observe Saturday Jan1 2028 on Dec31 2027');
});
test('regular cash sessions honor timezone daylight transitions and finite horizon coverage',()=>{
  const lookup=new Map(c.sessions.map(s=>[s.date,s]));
  assert.equal(lookup.get('2026-03-06').openAt,'2026-03-06T14:30:00.000Z');
  assert.equal(lookup.get('2026-03-09').openAt,'2026-03-09T13:30:00.000Z');
  assert.equal(lookup.get('2026-11-02').exchangeCloseAt,'2026-11-02T21:00:00.000Z');
  assert.deepEqual(requiredSessions(c,'2026-10-01',3).map(s=>s.date),['2026-10-02','2026-10-05','2026-10-06']);
  assert.equal(requiredSessions(c,'2027-12-30',3),null);
  assert.equal(requiredSessions(c,'2028-01-01',3),null);
});

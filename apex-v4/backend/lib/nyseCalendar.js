// Regular US cash-equity schedule only, sourced October 2, 2026.
// NYSE scheduled holidays/early closes: https://www.nyse.com/trade/hours-calendars
// Unscheduled closures require a new version. Not an options/extended-hours calendar.
import { nyParts } from './marketTime.js';
const HOLIDAYS = new Set([
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25',
  '2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
  '2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31',
  '2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24',
]);
const EARLY_CLOSES = new Set(['2026-11-27','2026-12-24','2027-11-26']);
function utcAtNyHour(date, hour, minute=0) {
  const reference = new Date(date + 'T17:00:00Z');
  const offsetHours = 17 - nyParts(reference).minutes / 60;
  return new Date(date + 'T00:00:00Z').getTime() + ((hour + offsetHours) * 60 + minute) * 60000;
}
const sessions=[];
for(let time=Date.parse('2026-01-01T00:00:00Z');time<=Date.parse('2027-12-31T00:00:00Z');time+=86400000){
  const day=new Date(time),date=day.toISOString().slice(0,10);
  if(day.getUTCDay()===0||day.getUTCDay()===6||HOLIDAYS.has(date))continue;
  const hour=EARLY_CLOSES.has(date)?13:16;
  sessions.push(Object.freeze({date,openAt:new Date(utcAtNyHour(date,9,30)).toISOString(),
    exchangeCloseAt:new Date(utcAtNyHour(date,hour)).toISOString(),
    // Fifteen-minute provider finalization buffer is research policy, not an NYSE promise.
    closeAt:new Date(utcAtNyHour(date,hour,15)).toISOString(),earlyClose:EARLY_CLOSES.has(date)}));
}
export const NYSE_CALENDAR=Object.freeze({source:'https://www.nyse.com/trade/hours-calendars',
  version:'nyse-cash-2026-2027/2026-10-02',reviewedAt:'2026-10-02',complete:true,
  from:'2026-01-01',through:'2027-12-31',finalizationBufferMinutes:15,
  scheduledOnly:true,sessions:Object.freeze(sessions)});

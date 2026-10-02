import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildScanClaims,buildCascadeClaim,validateClaim,sha256} from '../apex-v4/backend/lib/claimRecorder.js';
import {evaluateClaim} from '../apex-v4/backend/lib/outcomeEvaluator.js';
import {OutcomeLedger} from '../apex-v4/backend/lib/outcomeLedger.js';
const decision=new Date('2026-10-01T18:00:00Z');
const later=new Date('2026-10-08T21:00:00Z');
const calendar={source:'Synthetic regression calendar',version:'fixture-1',complete:true,from:'2026-10-01',through:'2026-10-07',sessions:['2026-10-02','2026-10-05','2026-10-06','2026-10-07'].map(date=>({date,closeAt:date+'T20:15:00Z'}))};
const claim=(direction=1)=>buildScanClaims([{symbol:'TEST',price:100,direction,apexScore:80}],decision)[0];
const bar=(date,open,high,low,close)=>({date,open,high,low,close});
const evaluate=(c,b,now=later)=>evaluateClaim(c,b,now,'fixture',calendar);
test('missing expected session cannot shift the horizon to a later winning bar',()=>{
 const out=evaluate(claim(),[bar('2026-10-05',100,101,99,100),bar('2026-10-06',100,101,99,100),bar('2026-10-07',100,113,99,112)]);
 assert.equal(out.status,'INSUFFICIENT_DATA');assert.equal(out.session,'2026-10-02');
});
test('missing calendar is unresolved, never assumes supplied bars are consecutive sessions',()=>{
 assert.equal(evaluateClaim(claim(),[bar('2026-10-02',100,113,99,112)],later).status,'INSUFFICIENT_DATA');
});
test('calendar can declare closure and early close without invented weekday substitution',()=>{
 const declared={...calendar,sessions:[{date:'2026-10-05',closeAt:'2026-10-05T17:15:00Z'},{date:'2026-10-06',closeAt:'2026-10-06T20:15:00Z'},{date:'2026-10-07',closeAt:'2026-10-07T20:15:00Z'}]};
 const b=[bar('2026-10-05',100,113,99,112)];
 assert.equal(evaluateClaim(claim(),b,new Date('2026-10-05T17:00:00Z'),'fixture',declared).status,'IMMATURE');
 assert.equal(evaluateClaim(claim(),b,new Date('2026-10-05T17:20:00Z'),'fixture',declared).result.outcome,'TARGET_FIRST');
});
test('opening target gap has priority over subsequent opposite-side extremes, long and short',()=>{
 assert.equal(evaluate(claim(),[bar('2026-10-02',113,114,93,100)]).result.exitPrice,113);
 assert.equal(evaluate(claim(),[bar('2026-10-02',113,114,93,100)]).result.outcome,'TARGET_FIRST');
 assert.equal(evaluate(claim(-1),[bar('2026-10-02',87,107,86,100)]).result.exitPrice,87);
 assert.equal(evaluate(claim(-1),[bar('2026-10-02',87,107,86,100)]).result.outcome,'TARGET_FIRST');
});
test('recomputed hashes do not permit horizon or rule-contract substitution',()=>{
 const c={...claim(),horizonSessions:1};delete c.contentHash;c.contentHash=sha256(c);
 assert(validateClaim(c).includes('horizon contract mismatch'));
 const changed={...claim(),rule:{...claim().rule,targetPct:99}};delete changed.contentHash;changed.contentHash=sha256(changed);
 assert(validateClaim(changed).includes('rule contract mismatch'));
});
test('cascade requires a trigger and an available recent source timestamp',()=>{
 const s={signalId:'fixture',state:'TRIGGERED',direction:'BULLISH',technical:{price:500},event:{triggerPrice:499,invalidationPrice:495},generatedAt:decision.toISOString()};
 assert(buildCascadeClaim(s,decision));
 assert.equal(buildCascadeClaim({...s,generatedAt:'2099-01-01T00:00:00Z'},decision),null);
 assert.equal(buildCascadeClaim({...s,event:{invalidationPrice:495}},decision),null);
 assert.equal(buildCascadeClaim({...s,generatedAt:'2026-10-01T17:00:00Z'},decision),null);
});
test('reload quarantines semantic claim and result corruption without deleting source rows',()=>{
 const dir=mkdtempSync(join(tmpdir(),'outcome-repair-'));
 try {
  writeFileSync(join(dir,'claims.jsonl'),JSON.stringify({...claim(),entryPrice:-123})+'\n');
  writeFileSync(join(dir,'results.jsonl'),JSON.stringify({claimId:'ghost',schema:'result/1'})+'\n');
  const ledger=new OutcomeLedger(dir);
  assert.equal(ledger.claims.size,0);assert.equal(ledger.results.size,0);assert.equal(ledger.stats().quarantinedRecords,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('cascade decision session follows source time across midnight while capture remains separate',()=>{
 const source='2026-10-01T23:58:00-04:00';
 const capture=new Date('2026-10-02T04:03:00Z');
 const c=buildCascadeClaim({signalId:'midnight-fixture',state:'TRIGGERED',direction:'BULLISH',technical:{price:500},event:{triggerPrice:499,invalidationPrice:495},generatedAt:source},capture);
 assert.equal(c.decisionTime,'2026-10-02T03:58:00.000Z');
 assert.equal(c.capturedAt,capture.toISOString());
 assert.equal(c.sessionDate,'2026-10-01');
 assert.deepEqual(validateClaim(c),[]);
});

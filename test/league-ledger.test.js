'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {updateWeeklyLedger}=require('../league-ledger');
function setup(){
 const a={id:'p1',name:'Starter',owner:'m1',slot:'QB',pos:'QB',nflTeamId:'4',scoreWeek:9,points:10,liveScoreStatus:'UPDATED'};
 const b={id:'p2',name:'Opponent',owner:'m2',slot:'QB',pos:'QB',nflTeamId:'5',scoreWeek:9,points:12,liveScoreStatus:'UPDATED'};
 const s={players:[a,b],managers:[{id:'m1'},{id:'m2'}],frozenMatchupSchedule:{9:[{id:'9-m1-m2',home:'m1',away:'m2'}]},injurySwapHistory:[]};
 const games=[{id:'g',teams:[{id:'4'},{id:'5'}],kickoff:'2020-01-01T00:00:00Z',status:'in'}];
 return {s,a,b,games,accounts:[]};
}
test('first weekly snapshot captures each manager separately',()=>{
 const {s,games,accounts}=setup();updateWeeklyLedger(s,accounts,9,games,[]);
 const m=s.weeklyLedger[9].matchups['9-m1-m2'];
 assert.deepEqual(m.homeLineup.map(p=>p.id),['p1']);assert.deepEqual(m.awayLineup.map(p=>p.id),['p2']);
});
test('provisional scores update without replacing lineup identities',()=>{
 const {s,a,games,accounts}=setup();updateWeeklyLedger(s,accounts,9,games,[]);
 a.points=24;updateWeeklyLedger(s,accounts,9,games,[]);
 const m=s.weeklyLedger[9].matchups['9-m1-m2'];assert.equal(m.homeScore,24);assert.equal(m.homeLineup[0].id,'p1');
});
test('unrecorded post-kickoff starter disappearance preserves snapshot',()=>{
 const {s,a,games,accounts}=setup();updateWeeklyLedger(s,accounts,9,games,[]);
 a.slot='BENCH';updateWeeklyLedger(s,accounts,9,games,[]);
 const m=s.weeklyLedger[9].matchups['9-m1-m2'];assert.equal(m.homeLineup[0].id,'p1');
 assert.equal(m.snapshotIntegrityIssues[0].playerId,'p1');
});
test('recorded injury substitution permits replacement',()=>{
 const {s,a,games,accounts}=setup();updateWeeklyLedger(s,accounts,9,games,[]);
 a.slot='BENCH';s.players.push({id:'p3',name:'Replacement',owner:'m1',slot:'QB',pos:'QB',nflTeamId:'4',scoreWeek:9,points:7,liveScoreStatus:'UPDATED'});
 s.injurySwapHistory.push({week:9,manager:'m1',removedId:'p1',replacementId:'p3',mode:'later'});
 updateWeeklyLedger(s,accounts,9,games,[]);
 const m=s.weeklyLedger[9].matchups['9-m1-m2'];assert.deepEqual(m.homeLineup.map(p=>p.id),['p3']);
});
test('finalized matchups remain immutable',()=>{
 const {s,a,games,accounts}=setup();updateWeeklyLedger(s,accounts,9,games,[]);
 const m=s.weeklyLedger[9].matchups['9-m1-m2'];m.status='final';m.homeScore=10;a.points=99;
 updateWeeklyLedger(s,accounts,9,games,[]);assert.equal(m.homeScore,10);
});

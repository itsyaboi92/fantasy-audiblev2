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

test('pre-kickoff changes are allowed',()=>{
 const {s,a,games,accounts}=setup();games[0].kickoff='2999-01-01T00:00:00Z';
 updateWeeklyLedger(s,accounts,9,games,[]);a.slot='BENCH';
 s.players.push({id:'p3',name:'Prekickoff',owner:'m1',slot:'QB',pos:'QB',nflTeamId:'4',scoreWeek:9,points:0,liveScoreStatus:'UPCOMING'});
 updateWeeklyLedger(s,accounts,9,games,[]);
 assert.deepEqual(s.weeklyLedger[9].matchups['9-m1-m2'].homeLineup.map(p=>p.id),['p3']);
});
test('injury history cannot authorize an unrelated replacement',()=>{
 const {s,a,games,accounts}=setup();updateWeeklyLedger(s,accounts,9,games,[]);
 a.slot='BENCH';s.players.push({id:'p4',name:'Unrelated',owner:'m1',slot:'QB',pos:'QB',nflTeamId:'4',scoreWeek:9,points:0});
 s.injurySwapHistory.push({week:9,manager:'m1',removedId:'p1',replacementId:'p3',mode:'later'});
 updateWeeklyLedger(s,accounts,9,games,[]);
 const m=s.weeklyLedger[9].matchups['9-m1-m2'];
 assert.equal(m.homeLineup[0].id,'p1');
 assert.equal(m.snapshotIntegrityIssues[0].reason,'RECORDED_REPLACEMENT_NOT_IN_LINEUP');
});
test('final NFL slate does not automatically certify provisional scores',()=>{
 const {s,games,accounts}=setup();updateWeeklyLedger(s,accounts,9,games,[]);
 games[0].status='final';updateWeeklyLedger(s,accounts,9,games,[]);
 assert.equal(s.weeklyLedger[9].matchups['9-m1-m2'].status,'provisional');
});

test('multiple fixtures keep independent player lineups and scores',()=>{
 const {s,games,accounts}=setup();
 s.players.push({id:'p3',owner:'m3',slot:'QB',pos:'QB',nflTeamId:'6',scoreWeek:9,points:17,liveScoreStatus:'UPDATED'});
 s.players.push({id:'p4',owner:'m4',slot:'QB',pos:'QB',nflTeamId:'7',scoreWeek:9,points:19,liveScoreStatus:'UPDATED'});
 s.frozenMatchupSchedule[9].push({id:'9-m3-m4',home:'m3',away:'m4'});
 updateWeeklyLedger(s,accounts,9,games,[]);
 const first=s.weeklyLedger[9].matchups['9-m1-m2'],second=s.weeklyLedger[9].matchups['9-m3-m4'];
 assert.deepEqual(first.homeLineup.map(p=>p.id),['p1']);
 assert.deepEqual(second.homeLineup.map(p=>p.id),['p3']);
 assert.equal(first.homeScore,10);assert.equal(second.homeScore,17);
});
test('missing NFL game feed remains provisional',()=>{
 const {s,accounts}=setup();updateWeeklyLedger(s,accounts,9,[],['ESPN unavailable']);
 assert.equal(s.weeklyLedger[9].matchups['9-m1-m2'].status,'provisional');
});
test('incomplete player scoring remains provisional even with final games',()=>{
 const {s,games,accounts}=setup();
 s.players[0].liveScoreStatus='STALE';games[0].status='final';
 updateWeeklyLedger(s,accounts,9,games,[]);
 assert.equal(s.weeklyLedger[9].matchups['9-m1-m2'].status,'provisional');
});

test('reused matchup ID cannot silently change the saved manager pairing',()=>{
 const {s,games,accounts}=setup();
 updateWeeklyLedger(s,accounts,9,games,[]);
 const m=s.weeklyLedger[9].matchups['9-m1-m2'];
 const originalHome=m.homeLineup.map(p=>p.id);
 s.frozenMatchupSchedule[9][0].home='m3';
 updateWeeklyLedger(s,accounts,9,games,[]);
 assert.equal(m.home,'m1');
 assert.deepEqual(m.homeLineup.map(p=>p.id),originalHome);
 assert.equal(m.snapshotIntegrityIssues[0].reason,'SCHEDULE_PAIRING_MISMATCH');
});
test('reused matchup ID cannot silently reverse home and away managers',()=>{
 const {s,games,accounts}=setup();
 updateWeeklyLedger(s,accounts,9,games,[]);
 const m=s.weeklyLedger[9].matchups['9-m1-m2'];
 s.frozenMatchupSchedule[9][0].home='m2';
 s.frozenMatchupSchedule[9][0].away='m1';
 updateWeeklyLedger(s,accounts,9,games,[]);
 assert.equal(m.home,'m1');assert.equal(m.away,'m2');
 assert.equal(m.snapshotIntegrityIssues[0].reason,'SCHEDULE_PAIRING_MISMATCH');
});

test('schedule pairing mismatch is detected after NFL games are final',()=>{
 const {s,games,accounts}=setup();
 updateWeeklyLedger(s,accounts,9,games,[]);
 const m=s.weeklyLedger[9].matchups['9-m1-m2'];
 s.frozenMatchupSchedule[9][0].away='m3';
 games[0].status='final';
 updateWeeklyLedger(s,accounts,9,games,[]);
 assert.equal(m.away,'m2');
 assert.equal(m.snapshotIntegrityIssues[0].reason,'SCHEDULE_PAIRING_MISMATCH');
});

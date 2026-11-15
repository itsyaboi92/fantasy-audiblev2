'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {leagueStandings}=require('../league-ledger');
const postseason=require('../postseason');
function fixture(){
 const managers=[{id:'m1'},{id:'m2'}],accounts=managers.map(m=>({manager:m.id}));
 const match={id:'9-m1-m2',home:'m1',away:'m2',homeScore:22,awayScore:12,status:'final',homeLineup:[],awayLineup:[]};
 const s={managers,weeklyLedger:{9:{matchups:{[match.id]:match}}},frozenMatchupSchedule:{9:[{id:match.id,home:'m1',away:'m2'}]}};
 return {s,accounts,match};
}
test('valid final matchup counts in standings and postseason ranks',()=>{
 const {s,accounts}=fixture();
 assert.equal(leagueStandings(s,accounts).find(x=>x.manager==='m1').wins,1);
 assert.equal(postseason.ranks(s,accounts)[0],'m1');
});
test('final matchup with reversed managers is excluded from standings and seeding',()=>{
 const {s,accounts,match}=fixture();match.home='m2';match.away='m1';
 assert.equal(leagueStandings(s,accounts).find(x=>x.manager==='m1').wins,0);
 assert.equal(postseason.ranks(s,accounts)[0],'m1');
});
test('final matchup with integrity warning is excluded',()=>{
 const {s,accounts,match}=fixture();match.snapshotIntegrityIssues=[{reason:'DUPLICATE_PLAYER_IN_MATCHUP'}];
 assert.equal(leagueStandings(s,accounts).find(x=>x.manager==='m1').wins,0);
 assert.equal(postseason.weekFinal(s,9,true),false);
});
test('nonfinite final score is excluded',()=>{
 const {s,accounts,match}=fixture();match.homeScore=NaN;
 assert.equal(leagueStandings(s,accounts).find(x=>x.manager==='m1').wins,0);
 assert.equal(postseason.weekFinal(s,9,true),false);
});
test('postseason requires exact scheduled pairing',()=>{
 const {s}=fixture();
 assert.equal(postseason.weekFinal(s,9,true),true);
 s.frozenMatchupSchedule[9][0].away='m3';
 assert.equal(postseason.weekFinal(s,9,true),false);
});

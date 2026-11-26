'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const postseason=require('./postseason');
const {leagueStandings,updateWeeklyLedger}=require('./league-ledger');
const {matchupCommentary}=require('./audible-commentary');

const verified=()=>true;
const pairs=fixtures=>fixtures.map(({home,away})=>[home,away]);
function league(count){
 const managers=Array.from({length:count},(_,i)=>({id:String(i+1),team:'Team '+(i+1)}));
 const end=postseason.endWeek(count);
 const s={managers,players:[],frozenMatchupSchedule:{[end]:[{id:'regular',home:'1',away:'2'}]},weeklyLedger:{}};
 finish(s,end,()=>[100,50]);
 return {s,accounts:managers.map(({id})=>({manager:id}))};
}
function finish(s,week,points){
 const matches=s.frozenMatchupSchedule[week];
 s.weeklyLedger[week]={matchups:Object.fromEntries(matches.map((f,i)=>{
  const [homeScore,awayScore]=points(f,i);
  return [f.id,{...f,homeScore,awayScore,status:'final'}];
 }))};
}

for(let mask=0;mask<8;mask++){
 test('six-team bracket with opening outcomes '+mask.toString(2).padStart(3,'0'),()=>{
  let {s,accounts}=league(6);
  const standings=leagueStandings(s,accounts);
  const seeds=postseason.ranks(s,accounts);
  const opening=[[seeds[0],seeds[5]],[seeds[1],seeds[4]],[seeds[2],seeds[3]]];
  const order=ids=>ids.sort((a,b)=>seeds.indexOf(a)-seeds.indexOf(b));
  const championship=order(opening.map((pair,i)=>pair[(mask>>i)&1]));
  const consolation=order(opening.map((pair,i)=>pair[1-((mask>>i)&1)]));
  const advance=week=>{
   const before=structuredClone(s);
   assert.equal(postseason.advance(s,accounts,()=>false),false);
   assert.deepEqual(s,before);
   // Simulate a fresh state load between every scheduling transaction.
   s=JSON.parse(JSON.stringify(s));
   assert.equal(postseason.advance(s,accounts,w=>w===week),true);
   const advanced=structuredClone(s);
   assert.equal(postseason.advance(s,accounts,w=>w===week),false);
   assert.deepEqual(s,advanced);
   assert.deepEqual(leagueStandings(s,accounts),standings);
   assert.deepEqual(s.postseason.seeds,seeds);
  };
  assert.equal(postseason.start(s,accounts,()=>false),false);
  assert.equal(postseason.start(s,accounts,verified),true);
  assert.equal(postseason.start(s,accounts,verified),false);
  assert.deepEqual(pairs(s.frozenMatchupSchedule[14]),opening);
  finish(s,14,(_,i)=>mask===0&&i===0?[80,80]:((mask>>i)&1)?[80,90]:[90,80]);
  if(mask===0)assert.match(matchupCommentary(s,14)[0].line,/championship bracket.*consolation bracket.*higher seed/);
  advance(14);
  assert.equal(s.postseason.championshipBye,championship[0]);
  assert.equal(s.postseason.consolationBye,consolation[0]);
  const semis=[championship.slice(1),consolation.slice(1)];
  assert.deepEqual(pairs(s.frozenMatchupSchedule[15]),semis);
  finish(s,15,()=>[75.25,100.75]);
  advance(15);
  assert.deepEqual(pairs(s.frozenMatchupSchedule[16]),semis);
  finish(s,16,()=>[125.5,100]);
  assert.match(matchupCommentary(s,16)[0].line,/advanced to the championship.*200\.75–200\.75.*higher seed/);
  assert.match(matchupCommentary(s,16)[1].line,/advanced to the consolation final/);
  advance(16);
  const finals=[championship.slice(0,2),consolation.slice(0,2)];
  assert.deepEqual(pairs(s.frozenMatchupSchedule[17]),finals);
  finish(s,17,()=>[100,75]);
  advance(17);
  assert.deepEqual(pairs(s.frozenMatchupSchedule[18]),finals);
  finish(s,18,()=>[75,110]);
  advance(18);
  assert.deepEqual(s.postseason.finalPlacements,[
   championship[1],championship[0],championship[2],
   consolation[1],consolation[0],consolation[2]
  ].map((manager,i)=>({place:i+1,manager})));
  assert.match(matchupCommentary(s,18)[1].line,/won the consolation final and finished fourth/);
  assert.equal(s.postseason.phase,'complete');
  assert.deepEqual(s.postseason.scheduledWeeks,[14,15,16,17,18]);
 });
}

test('legacy Week 14 schedule is replaced only when no matchup has been recorded',()=>{
 const {s,accounts}=league(6);
 s.frozenMatchupSchedule[14]=[{id:'legacy',home:'1',away:'2'}];
 const migrated=structuredClone(s);
 assert.equal(postseason.start(migrated,accounts,verified),true);
 assert.ok(migrated.frozenMatchupSchedule[14].every(f=>f.kind==='opening'));
 assert.deepEqual(migrated.weeklyLedger,s.weeklyLedger);
 updateWeeklyLedger(migrated,accounts,14,[{status:'final'}],[]);
 assert.deepEqual(Object.keys(migrated.weeklyLedger[14].matchups),
  migrated.frozenMatchupSchedule[14].map(f=>f.id));

 finish(s,14,()=>[85,100]);
 s.weeklyLedger[14].matchups.legacy.status='provisional';
 const original=structuredClone(s);
 assert.equal(postseason.start(s,accounts,verified),false);
 assert.deepEqual(s,original);
 s.weeklyLedger[14].matchups.legacy.status='final';
 assert.equal(postseason.start(s,accounts,verified),true);
 assert.equal(s.postseason.regularSeasonEnd,14);
 assert.equal(s.postseason.qualifiers,4);
 assert.deepEqual(s.weeklyLedger[14].matchups.legacy,{...original.weeklyLedger[14].matchups.legacy,status:'final'});

 const locked=structuredClone(s);
 assert.equal(postseason.start(s,accounts,verified),false);
 assert.deepEqual(s,locked);
});

test('an incomplete opening round and a recorded future fixture leave state intact',()=>{
 const {s,accounts}=league(6);
 postseason.start(s,accounts,verified);
 finish(s,14,()=>[100,75]);
 const opening=s.weeklyLedger[14].matchups['post-14-opening-0'];
 opening.status='provisional';
 assert.equal(postseason.advance(s,accounts,verified),false);
 opening.status='final';
 s.weeklyLedger[15]={matchups:{other:{status:'final'}}};
 const original=structuredClone(s);
 assert.equal(postseason.advance(s,accounts,verified),false);
 assert.deepEqual(s,original);
});

for(let count=7;count<=12;count++){
 test(count+'-team league retains its existing playoff opener',()=>{
  const {s,accounts}=league(count),seeds=postseason.ranks(s,accounts);
  assert.equal(postseason.start(s,accounts,verified),true);
  const wild=count>=9,week=wild?14:15,kind=wild?'wild':'semi';
  assert.equal(s.postseason.format,undefined);
  assert.equal(s.postseason.regularSeasonEnd,wild?13:14);
  assert.equal(s.postseason.qualifiers,wild?6:4);
  assert.deepEqual(pairs(s.frozenMatchupSchedule[week].filter(f=>f.kind===kind)),
   wild?[[seeds[2],seeds[5]],[seeds[3],seeds[4]]]:[[seeds[0],seeds[3]],[seeds[1],seeds[2]]]);
 });
}

test('six-team views show qualification, earned byes, both brackets and final placements',()=>{
 const fs=require('node:fs');
 const vm=require('node:vm');
 const app=fs.readFileSync(__dirname+'/public/app.js','utf8');
 const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));
 const {s,accounts}=league(6);
 const state={
  managers:s.managers.map(m=>({...m,claimed:true})),
  matchupSchedule:s.frozenMatchupSchedule,
  weeklyLedger:s.weeklyLedger,
  standings:leagueStandings(s,accounts),
  scheduleStartWeek:13
 };
 const context=vm.createContext({
  state,esc:String,fmt:n=>n.toFixed(2),m:id=>s.managers.find(m=>m.id===id),
  card:(heading,content)=>'<section><h2>'+heading+'</h2>'+content+'</section>'
 });
 vm.runInContext(extract('const sixTeamFixtureLabels=','function matchupView()')+
  extract('function postseasonData()','function render()'),context);
 const run=code=>vm.runInContext(code,context);
 assert.match(run('postseasonView()'),/All six teams qualify.*Week 14 · Opening round.*Championship bracket.*Consolation bracket/);
 assert.equal(run("postseasonData().status.join(',')"),Array(6).fill('Clinched').join(','));
 postseason.start(s,accounts,verified);
 state.postseason=s.postseason;
 finish(s,14,()=>[100,75]);
 postseason.advance(s,accounts,verified);
 for(const week of [15,16]){
  assert.match(run('sixTeamBye('+week+',state.postseason.championshipBye)'),/Championship bye/);
  assert.match(run('sixTeamBye('+week+',state.postseason.consolationBye)'),/Consolation bye/);
 }
 assert.equal(run('sixTeamBye(17,state.postseason.championshipBye)'), '');
 for(const week of [15,16,17,18]){
  finish(s,week,()=>[100,75]);
  postseason.advance(s,accounts,verified);
 }
 const html=run('postseasonView()');
 assert.match(html,/Official Bracket.*Championship semifinal.*Consolation semifinal.*Earned byes.*Final placements/);
 for(const {place,manager} of s.postseason.finalPlacements){
  assert.ok(html.includes('<span>'+place+'</span><b>Team '+manager+'</b>'));
 }
});

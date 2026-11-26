'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const test=require('node:test');
const vm=require('node:vm');

const app=fs.readFileSync(__dirname+'/public/app.js','utf8');
const section=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));
const scoreCode=section('const score=','const total=');
const rosterCode=section('function rosterActualScore(', 'async function moveToSection(');
const player={
 id:'starter',owner:'mine',name:'Starter',pos:'QB',slot:'QB',team:'BAL',
 points:14.5,scoreWeek:12,nflGame:{status:'playing'},liveScoreStatus:'UPDATED'
};

function myTeamView(){
 const state={week:12,weeklyLedger:{},nflDirectorySync:{season:2026}};
 const context=vm.createContext({
  state,esc:String,fmt:n=>n.toFixed(1),NFL_TEAM_IDS:{BAL:'33'},
  nflPlayerMetaCache:{'2026:12':{data:{players:{starter:{weeklyProjectedPoints:19.4}}}}},
  nflMatchupCache:{},
  ensureLineupDraft:()=>{},lineupDraft:{qb:'starter'},lineupDirty:false,lineupSaving:false,
  lineupSlots:()=>[{key:'qb',position:'QB',index:0}],
  nflPlayerName:p=>p.name,injuryLabel:()=>'',draftData:()=>({status:'completed'}),
  jsAttr:JSON.stringify,card:(heading,body)=>'<h2>'+heading+'</h2>'+body
 });
 vm.runInContext(scoreCode+rosterCode,context);
 return {state,context};
}

test('My Team displays live and finished scores for starters, bench and IR',()=>{
 const {context}=myTeamView();
 const bench={...player,id:'bench',name:'Bench',slot:'BENCH',points:0,nflGame:{status:'final'}};
 const ir={...player,id:'ir',name:'IR',slot:'IR',points:-1.5,
  nflGame:{status:'final'},liveScoreStatus:'PARTIAL'};
 const html=context.lineupManager([player,bench,ir]);
 assert.match(html,/QB 1[\s\S]*?Projected PPR: 19\.4 est\.[\s\S]*?Actual: 14\.5 pts<\/b> <span class="muted">· Live/);
 assert.match(html,/Bench \(1\/7\)[\s\S]*?Actual: 0\.0 pts<\/b> <span class="muted">· Final/);
 assert.match(html,/IR \(1\/1\)[\s\S]*?Actual: -1\.5 pts<\/b> <span class="muted">· Provisional/);
});

test('My Team excludes stale scores and scores that have not been synced',()=>{
 const {context}=myTeamView();
 for(const p of [
  {...player,scoreWeek:11},
  {...player,nflGame:{status:'upcoming'}},
  {...player,nflGame:{status:'final'},liveScoreStatus:'UPCOMING',points:0},
  {...player,points:null}
 ]){
  assert.match(context.rosterMatchupDetails(p),/Actual: —/);
 }
});

test('My Team prefers a final ledger score and shows credited injury-swap points',()=>{
 const {state,context}=myTeamView();
 const replacement={...player,credited:3.5,scoringMode:'handcuff'};
 assert.match(context.rosterMatchupDetails(replacement),/Actual: 3\.5 pts<\/b> <span class="muted">· Provisional · Credited/);
 state.weeklyLedger[12]={matchups:{game:{status:'final',home:'opponent',away:'mine',awayLineup:[
  {id:player.id,points:5.5,scoringMode:'handcuff'}
 ]}}};
 assert.match(context.rosterMatchupDetails(replacement),/Actual: 5\.5 pts<\/b> <span class="muted">· Final · Credited/);
 assert.match(context.rosterMatchupDetails({...replacement,owner:'new-team'}),/Actual: 3\.5 pts/);
});

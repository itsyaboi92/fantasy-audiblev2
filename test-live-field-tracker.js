'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const test=require('node:test');
const vm=require('node:vm');
const {gameTracker,TEAM_IDS}=require('./live-nfl');

const teams={home:{id:'6',abbreviation:'DAL'},away:{id:'21',abbreviation:'PHI'}};
const summary={
 header:{competitions:[{
  // Team order in the feed must not determine the orientation.
  competitors:[{homeAway:'away',team:teams.away},{homeAway:'home',team:teams.home}],
  status:{type:{state:'in'},displayClock:'6:02',period:2}
 }]},
 drives:{current:{team:teams.away,plays:[
  {id:'1',start:{yardLine:55},end:{yardLine:41}},
  {id:'2',start:{yardLine:41},end:{yardLine:null},text:'Timeout'}
 ]}}
};
const source=fs.readFileSync(__dirname+'/public/app.js','utf8');
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const context=vm.createContext({NFL_TEAM_IDS:TEAM_IDS});
vm.runInContext(extract('const esc=','const fmt=')+extract('function nflClubBadge(','function nflPlayerName(')+
 extract('function renderLiveFieldTracker(','async function refreshLiveFieldTracker('),context);

test('tracker places both teams using ESPN home and away designations',()=>{
 const data=gameTracker(summary,'123456');
 assert.deepEqual(data.teams,teams);
 assert.equal(data.possession,'PHI');
 assert.deepEqual(data.driveTrail,[55,41,41]);
 assert.equal(data.location,41);

 const html=context.renderLiveFieldTracker(data);
 const numbers=[...html.matchAll(/<text x="\d+" y="25">(\d+)<\/text>/g)].map(match=>Number(match[1]));
 assert.deepEqual(numbers,[10,20,30,40,50,40,30,20,10]);
 assert.match(html,/scoreboard\/dal\.png[\s\S]*scoreboard\/phi\.png/);
 assert.match(html,/<circle cx="153" cy="60"/);
 assert.match(html,/<b>PHI<\/b> · DAL 41 · Q2 · 6:02/);
 assert.doesNotMatch(html,/>OWN<|>OPP</);
});

test('a change of possession keeps end zones fixed and labels spots on both sides',()=>{
 const homeDrive={...summary,drives:{current:{team:teams.home,plays:[{id:'3',end:{yardLine:59}}]}}};
 const data=gameTracker(homeDrive,'123456');
 for(const [location,spot] of [[59,'PHI 41'],[50,'Midfield'],[0,'DAL Goal line'],[100,'PHI Goal line']]){
  const html=context.renderLiveFieldTracker({...data,location});
  assert.match(html,/scoreboard\/dal\.png[\s\S]*scoreboard\/phi\.png/);
  assert.ok(html.includes('<b>DAL</b> · '+spot));
 }
});

test('unknown field position leaves the ball hidden and keeps both emblems',()=>{
 const emptyDrive={...summary,drives:{current:{team:teams.away,plays:[{id:'1',end:{yardLine:null}}]}}};
 const data=gameTracker(emptyDrive,'123456');
 assert.equal(data.location,null);
 const html=context.renderLiveFieldTracker(data);
 assert.match(html,/Field position unavailable/);
 assert.match(html,/scoreboard\/dal\.png[\s\S]*scoreboard\/phi\.png/);
 assert.doesNotMatch(html,/<circle/);
});

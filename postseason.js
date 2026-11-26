'use strict';
// Postseason state is independent of the regular-season standings ledger.
const SIX_TEAM_FORMAT='six-team-reseeded';
const endWeek=n=>n!==6&&n<=8?14:13;
const qualifiers=n=>n===6||n>8?6:4;
const hasRecordedWeek=(s,week)=>Object.keys(s.weeklyLedger?.[week]?.matchups||{}).length>0;
function regularSeasonEnd(s,n){
 if(s.postseason?.locked)return s.postseason.regularSeasonEnd;
 // Preserve the regular-season cutoff for legacy six-team leagues already playing Week 14.
 if(n===6&&Object.keys(s.weeklyLedger?.[14]?.matchups||{}).some(id=>!id.startsWith('post-')))return 14;
 return endWeek(n);
}
const pairs=(ids,week,kind)=>ids.reduce((a,_,i)=>{if(i%2===0&&ids[i+1])a.push({id:`post-${week}-${kind}-${i/2}`,home:ids[i],away:ids[i+1],kind});return a;},[]);
function ranks(s,accounts){
 const ids=new Set(accounts.map(a=>a.manager));
 const rows=Object.fromEntries(s.managers.filter(m=>ids.has(m.id)).map(m=>[m.id,{id:m.id,w:0,l:0,t:0,pf:0,pa:0}]));
 const end=regularSeasonEnd(s,Object.keys(rows).length);
 for(let w=1;w<=end;w++)for(const x of Object.values(s.weeklyLedger?.[w]?.matchups||{})){
  if(x.status!=='final'||x.id?.startsWith('post-')||!rows[x.home]||!rows[x.away])continue;
  const a=rows[x.home],b=rows[x.away];a.pf+=x.homeScore;b.pf+=x.awayScore;a.pa+=x.awayScore;b.pa+=x.homeScore;
  if(x.homeScore===x.awayScore){a.t++;b.t++;}else if(x.homeScore>x.awayScore){a.w++;b.l++;}else{a.l++;b.w++;}
 }
 return Object.values(rows).sort((a,b)=>(b.w+b.t/2)/(b.w+b.l+b.t||1)-(a.w+a.t/2)/(a.w+a.l+a.t||1)||b.pf-a.pf||a.id.localeCompare(b.id)).map(x=>x.id);
}
function weekFinal(s,week,verifiedNFLWeek){
 if(!verifiedNFLWeek)return false;
 const matches=s.frozenMatchupSchedule?.[week]||[];
 if(!matches.length)return false;
 return matches.every(m=>s.weeklyLedger?.[week]?.matchups?.[m.id]?.status==='final');
}
function score(s,week,id){const m=s.weeklyLedger?.[week]?.matchups?.[id];return m&&m.status==='final'?m:null;}
function winner(m,seed){if(!m)return null;if(m.homeScore!==m.awayScore)return m.homeScore>m.awayScore?m.home:m.away;
 return seed.indexOf(m.home)<seed.indexOf(m.away)?m.home:m.away;}
function aggregateScore(fixture,first,second){
 const scoreFor=(match,id)=>match.home===id?match.homeScore:match.awayScore;
 const total=id=>(Math.round(scoreFor(first,id)*100)+Math.round(scoreFor(second,id)*100))/100;
 return {...fixture,homeScore:total(fixture.home),awayScore:total(fixture.away)};
}
function losers(matches,seed){return matches.map(m=>{const w=winner(m,seed);return w===m.home?m.away:m.home;});}
function winners(matches,seed){return matches.map(m=>winner(m,seed));}
function consolationFixtures(s,p,week){
 // Active entrants compete for consolation title. Highest seeds receive byes.
 const entrants=[...p.consolationActive].sort((a,b)=>p.seeds.indexOf(a)-p.seeds.indexOf(b));
 if(entrants.length<=1)return [];
 const power=2**Math.floor(Math.log2(entrants.length));
 const playing=entrants.length===power?entrants:entrants.slice(power-(entrants.length-power));
 const fixtures=pairs(playing.slice().sort((a,b)=>p.seeds.indexOf(a)-p.seeds.indexOf(b)).reduce((a,_,i,arr)=>{if(i<Math.ceil(arr.length/2)){a.push(arr[i],arr[arr.length-i-1]);}return a;},[]),week,'consolation');
 return fixtures;
}
function addPlacement(s,p,week,fixtures){
 const used=new Set(fixtures.flatMap(m=>[m.home,m.away]));
 const byes=p.consolationByes?.[week]||[];
 const idle=p.seeds.filter(id=>!used.has(id)&&!byes.includes(id));
 // Do not pair a championship team playing its second aggregate leg elsewhere.
 const groups=[];for(let i=0;i+1<idle.length;i+=2)groups.push({id:`post-${week}-placement-${i/2}`,home:idle[i],away:idle[i+1],kind:'placement'});
 return [...fixtures,...groups];
}
function install(s,p,week,fixtures){
 if(s.frozenMatchupSchedule?.[week]?.length||hasRecordedWeek(s,week))return false;
 s.frozenMatchupSchedule||={};
 s.frozenMatchupSchedule[week]=addPlacement(s,p,week,fixtures);
 p.scheduledWeeks.push(week);return true;
}
function installSixTeamWeek(s,p,week,fixtures){
 if(hasRecordedWeek(s,week))return false;
 const existing=s.frozenMatchupSchedule[week]||[];
 if(existing.length&&(week!==14||existing.some(f=>f.kind||f.id.startsWith('post-'))))return false;
 s.frozenMatchupSchedule[week]=fixtures;
 p.scheduledWeeks.push(week);
 return true;
}
function startSixTeam(s,seeds){
 const opening=pairs(seeds.slice(0,3).flatMap((id,i)=>[id,seeds[5-i]]),14,'opening');
 const p={format:SIX_TEAM_FORMAT,locked:true,lockedAt:new Date().toISOString(),
  regularSeasonEnd:13,seeds,qualifiers:6,phase:'opening',scheduledWeeks:[],
  opening,championshipFinal:null,consolationChampion:null,finalPlacements:null};
 if(!installSixTeamWeek(s,p,14,opening))return false;
 s.postseason=p;
 return true;
}
function nextLeg(fixture,week){
 return {...fixture,id:fixture.id.replace(/^post-\d+-/,`post-${week}-`)};
}
function fixtureScore(s,week,fixture){
 const result=score(s,week,fixture.id);
 return result?.home===fixture.home&&result.away===fixture.away&&
  Number.isFinite(result.homeScore)&&Number.isFinite(result.awayScore)?result:null;
}
function advanceSixTeam(s,p,verified){
 const seeds=p.seeds;
 const completed=week=>weekFinal(s,week,verified(week));
 if(p.phase==='opening'&&completed(14)){
  const results=p.opening.map(f=>fixtureScore(s,14,f));
  if(results.some(x=>!x))return false;
  const ordered=ids=>ids.sort((a,b)=>seeds.indexOf(a)-seeds.indexOf(b));
  const championship=ordered(winners(results,seeds));
  const consolation=ordered(losers(results,seeds));
  const semis=[
   ...pairs(championship.slice(1),15,'championship-semi'),
   ...pairs(consolation.slice(1),15,'consolation-semi')
  ];
  if(!installSixTeamWeek(s,p,15,semis))return false;
  Object.assign(p,{championshipBye:championship[0],consolationBye:consolation[0],semifinals:semis,phase:'semis'});
  return true;
 }
 const semis=p.phase==='semis';
 if(!semis&&p.phase!=='finals')return false;
 const firstWeek=semis?15:17,secondWeek=firstWeek+1;
 const fixtures=semis?p.semifinals:p.finals;
 if(!p.scheduledWeeks.includes(secondWeek)){
  return completed(firstWeek)&&installSixTeamWeek(s,p,secondWeek,fixtures.map(f=>nextLeg(f,secondWeek)));
 }
 if(!completed(secondWeek))return false;
 const results=fixtures.map(f=>{
  const first=fixtureScore(s,firstWeek,f),second=fixtureScore(s,secondWeek,nextLeg(f,secondWeek));
  return first&&second?aggregateScore(f,first,second):null;
 });
 if(results.some(x=>!x))return false;
 const [championshipWinner,consolationWinner]=winners(results,seeds);
 const [championshipLoser,consolationLoser]=losers(results,seeds);
 if(semis){
  const finals=[
   ...pairs([p.championshipBye,championshipWinner],17,'championship-final'),
   ...pairs([p.consolationBye,consolationWinner],17,'consolation-final')
  ];
  if(!installSixTeamWeek(s,p,17,finals))return false;
  Object.assign(p,{thirdPlace:championshipLoser,sixthPlace:consolationLoser,finals,phase:'finals'});
 }else{
  p.championshipFinal={champion:championshipWinner,runnerUp:championshipLoser,third:p.thirdPlace};
  p.consolationChampion=consolationWinner;
  p.finalPlacements=[championshipWinner,championshipLoser,p.thirdPlace,
   consolationWinner,consolationLoser,p.sixthPlace].map((manager,i)=>({place:i+1,manager}));
  p.phase='complete';
  p.completedAt=new Date().toISOString();
 }
 return true;
}
function scheduleConsolation(s,p,week){
 if(!p.consolationAggregate)return consolationFixtures(s,p,week);
 if(week===18)return (s.frozenMatchupSchedule[17]||[])
  .filter(f=>f.kind==='consolation-final').map(f=>nextLeg(f,week));
 if(week===16&&p.seeds.length<=10){
  p.consolationByes[16]=p.consolationByes[15]||[];
  return (s.frozenMatchupSchedule[15]||[])
   .filter(f=>f.kind==='consolation-semi').map(f=>nextLeg(f,week));
 }
 const fixtures=consolationFixtures(s,p,week);
 const playing=new Set(fixtures.flatMap(f=>[f.home,f.away]));
 p.consolationByes[week]=p.consolationActive.filter(id=>!playing.has(id));
 const kind=week===17?'consolation-final':week===15&&p.seeds.length<=10?'consolation-semi':'consolation';
 return fixtures.map((f,i)=>({...f,id:`post-${week}-${kind}-${i}`,kind}));
}
function start(s,accounts,verified){
 if(s.postseason?.locked)return false;
 const seed=ranks(s,accounts),n=seed.length;if(n<6||n>12)return false;
 const end=regularSeasonEnd(s,n);
 if(!weekFinal(s,end,verified(end)))return false;
 if(n===6&&end===13)return startSixTeam(s,seed);
 const q=n===6?4:qualifiers(n);
 const p={locked:true,lockedAt:new Date().toISOString(),regularSeasonEnd:end,seeds:seed,qualifiers:q,phase:'opening',scheduledWeeks:[],consolationActive:seed.slice(q),consolationEliminated:[],championshipFinal:null,consolationChampion:null};
 if(n>=7)Object.assign(p,{consolationAggregate:true,consolationByes:{}});
 // Existing deployments may have a legacy Week 14 regular-season fixture.
 // Never replace a recorded Week 14 result.
 if(q===6 && !Object.keys(s.weeklyLedger?.[14]?.matchups||{}).length)delete s.frozenMatchupSchedule[14];
 if(q===6){
  const opening=[{id:'post-14-wild-0',home:seed[2],away:seed[5],kind:'wild'},
    {id:'post-14-wild-1',home:seed[3],away:seed[4],kind:'wild'}];
  const con=scheduleConsolation(s,p,14);if(!install(s,p,14,[...opening,...con]))return false;
 }else{
  const semis=[{id:'post-15-semi-0',home:seed[0],away:seed[3],kind:'semi'},
    {id:'post-15-semi-1',home:seed[1],away:seed[2],kind:'semi'}];
  if(!install(s,p,15,[...semis,...scheduleConsolation(s,p,15)]))return false;
  p.phase='semis';p.semifinals=semis;
 }
 s.postseason=p;
 return true;
}
function advance(s,accounts,verified){
 const persisted=s.postseason;if(!persisted?.locked)return false;
 if(persisted.format===SIX_TEAM_FORMAT)return advanceSixTeam(s,persisted,verified);
 // Publish state changes only once the next week's fixtures are installed.
 const p=structuredClone(persisted);
 const seed=p.seeds;
 const completed=w=>weekFinal(s,w,verified(w));
 const results=(week,kind)=> (s.frozenMatchupSchedule?.[week]||[]).filter(m=>m.kind===kind).map(m=>score(s,week,m.id));
 const settleConsolation=week=>{
  const kind=p.consolationAggregate&&week===18?'consolation-final':
   p.consolationAggregate&&week===16&&seed.length<=10?'consolation-semi':'consolation';
  const scheduled=(s.frozenMatchupSchedule?.[week]||[]).filter(m=>m.kind===kind);
  if(!scheduled.length)return true;
  const result=scheduled.map(m=>{
   if(!p.consolationAggregate)return score(s,week,m.id);
   const second=fixtureScore(s,week,m);
   if(kind==='consolation')return second;
   const first=fixtureScore(s,week-1,nextLeg(m,week-1));
   return first&&second?aggregateScore(m,first,second):null;
  });
  if(result.some(x=>!x))return false;
  const knocked=losers(result,seed);p.consolationActive=p.consolationActive.filter(id=>!knocked.includes(id));
  p.consolationEliminated.push(...knocked);
  if(p.consolationActive.length===1)p.consolationChampion=p.consolationActive[0];
  return true;
 };
 const save=()=>{s.postseason=p;return true;};
 if(p.phase==='opening'&&completed(14)){
  if(!settleConsolation(14))return false;
  const wild=results(14,'wild');if(wild.length!==2||wild.some(x=>!x))return false;
  const win=winners(wild,seed),lost=losers(wild,seed);
  p.consolationActive.push(...lost);
  const ordered=win.sort((a,b)=>seed.indexOf(a)-seed.indexOf(b));
  p.semifinals=[{id:'post-15-semi-0',home:seed[0],away:ordered[1],kind:'semi'},
    {id:'post-15-semi-1',home:seed[1],away:ordered[0],kind:'semi'}];
  if(!install(s,p,15,[...p.semifinals,...scheduleConsolation(s,p,15)]))return false;
  p.phase='semis';return save();
 }
 if(p.phase==='semis'&&completed(15)&&!p.scheduledWeeks.includes(16)){
  if(!settleConsolation(15))return false;
  const legs=p.semifinals.map((m,i)=>({...m,id:`post-16-semi-${i}`}));
  return install(s,p,16,[...legs,...scheduleConsolation(s,p,16)])&&save();
 }
 if(p.phase==='semis'&&completed(16)){
  if(!settleConsolation(16))return false;
  const scores=p.semifinals.map((m,i)=>{
   const a=score(s,15,m.id),b=score(s,16,`post-16-semi-${i}`);if(!a||!b)return null;
   return aggregateScore(m,a,b);
  });if(scores.some(x=>!x))return false;
  const win=winners(scores,seed),lost=losers(scores,seed);
  p.finals=[{id:'post-17-final-0',home:win[0],away:win[1],kind:'final'},
    {id:'post-17-third-0',home:lost[0],away:lost[1],kind:'third'}];
  if(!install(s,p,17,[...p.finals,...scheduleConsolation(s,p,17)]))return false;
  p.phase='finals';return save();
 }
 if(p.phase==='finals'&&completed(17)&&!p.scheduledWeeks.includes(18)){
  if(!settleConsolation(17))return false;
  const legs=p.finals.map((m,i)=>({...m,id:`post-18-${m.kind}-${i}`}));
  return install(s,p,18,[...legs,...scheduleConsolation(s,p,18)])&&save();
 }
 if(p.phase==='finals'&&completed(18)){
  if(!settleConsolation(18))return false;
  const scores=p.finals.map((m,i)=>{const a=score(s,17,m.id),b=score(s,18,`post-18-${m.kind}-${i}`);
    return a&&b?aggregateScore(m,a,b):null;});
  if(scores.some(x=>!x))return false;
  p.championshipFinal={champion:winner(scores[0],seed),runnerUp:losers([scores[0]],seed)[0],third:winner(scores[1],seed)};
  p.phase='complete';p.completedAt=new Date().toISOString();return save();
 }
 return false;
}
module.exports={SIX_TEAM_FORMAT,endWeek,regularSeasonEnd,qualifiers,ranks,weekFinal,start,advance,winner,aggregateScore};

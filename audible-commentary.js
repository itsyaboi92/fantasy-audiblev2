'use strict';
const crypto=require('crypto');
function pick(key,options){const n=crypto.createHash('sha256').update(String(key)).digest().readUInt32BE(0);return options[n%options.length];}
function name(s,id){return String(s.managers.find(m=>m.id===id)?.team||'Unknown team').slice(0,80);}
function record(s,id,before=Infinity){let wins=0,losses=0;for(const [week,r] of Object.entries(s.weeklyLedger||{})){if(Number(week)>=before)continue;for(const m of Object.values(r.matchups||{})){if(m.status!=='final'||![m.home,m.away].includes(id)||!Number.isFinite(m.homeScore)||!Number.isFinite(m.awayScore))continue;const own=m.home===id?m.homeScore:m.awayScore,other=m.home===id?m.awayScore:m.homeScore;if(own>other)wins++;else if(own<other)losses++;}}return wins+losses?wins+'-'+losses:null;}
function eventText(s,e){const who=name(s,e.manager),d=String(e.details||'').slice(0,220),key=e.id||e.at||d,standing=record(s,e.manager);
switch(e.type){
case 'SUBSTITUTION':{
const m=d.match(/^(.*?) \(([\d.]+) pts forfeited\) replaced by (.*?) \((.*?)\)$/);
if(!m)return '🚑 THE AUDIBLE | INJURY SUBSTITUTION: '+who+' made a roster emergency move. '+d;
return '🚑 THE AUDIBLE | LIVE SUBSTITUTION: '+who+' pulled '+m[1]+' for '+m[3]+' ('+m[4]+'). '+Number(m[2]).toFixed(1)+' points forfeited. '+pick(key,['Those points are gone. '+m[3]+' better be worth the damn gamble.','The medical tent is running the front office now.','That is a bold move. The receipts are permanent.','Emergency surgery on the lineup. Hope the patient survives.']);}
case 'AUTO_PICK':return '🤖 THE AUDIBLE | DRAFT: '+who+' used autopick. '+pick(key,['A computer is making the football decisions. Might be an upgrade.','The algorithm did the homework. The manager will still take credit.','Nothing says preparation like delegating your entire damn draft.']);
case 'WAIVER_AWARDED':case 'FREE_AGENT_ADD':return (e.type==='WAIVER_AWARDED'?'📋 WAIVERS':'🛒 FREE AGENCY')+' | '+who+': '+d+'. '+pick(key,[(standing?'That '+standing+' record':'That roster')+' apparently needed emergency repairs.','The front office is panicking or cooking. We will find out.','The roster changed. The burden of proof did not.','This move either saves the season or gets mentioned at the funeral.']);
case 'RENAME':return '🪧 THE AUDIBLE | REBRAND: '+who+' changed the team name. '+pick(key,[(standing||'The record')+' did not change with the logo.','New name. Same damn roster.','Marketing is working harder than the football department.']);
case 'DRAFT_COMPLETE':return '🎙️ THE AUDIBLE | DRAFT COMPLETE: Everybody thinks they built a contender. The scoreboard is about to identify the liars.';
default:return null;}}
function finalPosts(s){
 const posts=[], games=[];
 for(const [week,r] of Object.entries(s.weeklyLedger||{}))for(const m of Object.values(r.matchups||{})){
 if(m.status==='final'&&Number.isFinite(m.homeScore)&&Number.isFinite(m.awayScore))games.push({...m,week:Number(week)});
 }
 games.sort((a,b)=>a.week-b.week);
 for(const m of games){
 const week=m.week,key='final:'+week+':'+m.id,diff=Math.abs(m.homeScore-m.awayScore),winner=m.homeScore===m.awayScore?null:m.homeScore>m.awayScore?m.home:m.away;
 const loser=winner===m.home?m.away:m.home,hi=Math.max(m.homeScore,m.awayScore),lo=Math.min(m.homeScore,m.awayScore);
 const candidates=[];
 const add=(ok,fact,variants)=>{if(ok)candidates.push(fact+' '+pick(key+fact,variants));};
 add(!winner,'A tied final score.',['Nobody gets bragging rights.','The scoreboard refuses to pick a side.','Both managers leave with unfinished business.','An entire week for a stalemate.','Neither roster delivered the decisive point.']);
 add(diff>50,'A '+diff.toFixed(1)+'-point blowout.',['That was a demolition.','The mercy rule is conspicuously absent.','The film room needs a warning label.','That scoreboard belongs in a museum of disasters.','The opposition never found an answer.']);
 add(diff>0&&diff<1,'Just '+diff.toFixed(2)+' points separated the teams.',['Every decimal mattered.','That is a brutal way to lose.','The box score needs a magnifying glass.','One tiny scoring change rewrites everything.','Nobody should be comfortable with that margin.']);
 add(diff>=1&&diff<5,'A '+diff.toFixed(2)+'-point margin.',['That one needed a seatbelt.','The lineup decisions will be replayed all week.','A win is a win, even with a heart attack attached.','The difference was painfully small.','The scoreboard delivered a thriller.']);
 add(lo>0&&hi>=2*lo,'The winning score was at least twice the losing score.',['Two different levels of offense showed up.','That is a serious imbalance.','The numbers are downright rude.','The losing roster needs answers.','One offense made the other look optional.']);
 if(winner){
 const previous=games.filter(g=>g.week<week&&[g.home,g.away].includes(winner));
 const won=g=>g.home===winner?g.homeScore>g.awayScore:g.awayScore>g.homeScore;
 let streak=1;for(let i=previous.length-1;i>=0&&won(previous[i]);i--)streak++;
 add(streak>=2,name(s,winner)+' has won '+streak+' straight.',['Momentum has entered the building.','The league should be paying attention.','The winning habit is getting comfortable.','The opposition needs a new plan.','That streak is becoming a storyline.']);
 add(previous.length>0&&!previous.some(won),name(s,winner)+' earned its first recorded win.',['The drought is over.','The comeback tour finally has a ticket sale.','The win column is open for business.','That is a foundation to build on.','The season finally has a positive chapter.']);
 const oldScores=previous.map(g=>g.home===winner?g.homeScore:g.awayScore);
 add(oldScores.length>0&&hi>Math.max(...oldScores),name(s,winner)+' set a new personal scoring high of '+hi.toFixed(1)+'.',['The offense raised its ceiling.','That is a new benchmark.','The roster found another gear.','The previous high is history.','The scoring department deserves its flowers.']);
 }
 const remark=candidates.slice(0,2).join(' ')||('Final margin: '+diff.toFixed(1)+' points.');
 posts.push({key,body:('🏁 THE AUDIBLE | WEEK '+week+': '+name(s,m.home)+' '+m.homeScore.toFixed(1)+' – '+name(s,m.away)+' '+m.awayScore.toFixed(1)+'. '+remark).slice(0,1000)});
 }return posts;
}
module.exports={eventText,finalPosts};

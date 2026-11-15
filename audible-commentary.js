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
function finalPosts(s){const posts=[];for(const [week,r] of Object.entries(s.weeklyLedger||{}))for(const m of Object.values(r.matchups||{})){
if(m.status!=='final'||!Number.isFinite(m.homeScore)||!Number.isFinite(m.awayScore))continue;
const diff=Math.abs(m.homeScore-m.awayScore),winner=m.homeScore===m.awayScore?null:m.homeScore>m.awayScore?m.home:m.away;
const key='final:'+week+':'+m.id;
const remark=!winner?'Neither team could finish the job. Congratulations to absolutely nobody.':diff>=40?pick(key,['That was an ass-kicking with a box score.','Somebody call the league office. This was a public execution of a playoff dream.','Less a competition, more a cautionary tale.']):diff<=3?pick(key,['The loser will be replaying every lineup decision all week.','That margin will haunt somebody until next Sunday.','One bad roster decision from rewriting the entire story.']):pick(key,['The scoreboard is not accepting excuses.','One manager gets bragging rights. The other gets a long week.','One team celebrates. The other is writing an apology to the group chat.']);
const prior=winner?record(s,winner,Number(week)):null;
posts.push({key,body:('🏁 THE AUDIBLE | WEEK '+week+': '+name(s,m.home)+' '+m.homeScore.toFixed(1)+' – '+name(s,m.away)+' '+m.awayScore.toFixed(1)+'. '+remark+(prior?' '+name(s,winner)+' entered this week '+prior+'.':'')).slice(0,1000)});
}return posts;}
module.exports={eventText,finalPosts};

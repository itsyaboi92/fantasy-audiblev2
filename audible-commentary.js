'use strict';
const crypto=require('crypto');
const {SIX_TEAM_FORMAT,winner:postseasonWinner,aggregateScore}=require('./postseason');
function pick(key,options){const n=crypto.createHash('sha256').update(String(key)).digest().readUInt32BE(0);return options[n%options.length];}
function name(s,id){return String(s.managers.find(m=>m.id===id)?.team||'Unknown team').slice(0,80);}
function record(s,id,before=Infinity){let wins=0,losses=0;for(const [week,r] of Object.entries(s.weeklyLedger||{})){if(Number(week)>=before)continue;for(const m of Object.values(r.matchups||{})){if(m.id?.startsWith('post-')||m.status!=='final'||![m.home,m.away].includes(id)||!Number.isFinite(m.homeScore)||!Number.isFinite(m.awayScore))continue;const own=m.home===id?m.homeScore:m.awayScore,other=m.home===id?m.awayScore:m.homeScore;if(own>other)wins++;else if(own<other)losses++;}}return wins+losses?wins+'-'+losses:null;}
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
function verifiedFinal(m){
  return m?.status==='final'&&Number.isFinite(m.homeScore)&&Number.isFinite(m.awayScore);
}

function finalGames(s){
  return Object.entries(s.weeklyLedger||{})
    .flatMap(([week,entry])=>Object.values(entry.matchups||{})
      .filter(verifiedFinal).map(match=>({...match,week:Number(week)})))
    .sort((a,b)=>a.week-b.week||String(a.id).localeCompare(String(b.id)));
}

function scoreFor(match,id){
  return match.home===id?match.homeScore:match.awayScore;
}

function resultFor(match,id){
  return Math.sign(scoreFor(match,id)-scoreFor(match,match.home===id?match.away:match.home));
}

function matchupCommentary(s,week,games=finalGames(s)){
  const weekly=games.filter(match=>match.week===week);
  const history=games.filter(match=>match.week<week);
  const byTeam=new Map();
  for(const match of history){
    for(const id of [match.home,match.away]){
      if(!byTeam.has(id))byTeam.set(id,[]);
      byTeam.get(id).push(match);
    }
  }
  const fixtures=s.frozenMatchupSchedule?.[week]||[];
  const ledger=s.weeklyLedger?.[week]?.matchups||{};
  const complete=fixtures.length>1&&fixtures.length===weekly.length&&
    fixtures.every(fixture=>verifiedFinal(ledger[fixture.id])&&
      ledger[fixture.id].home===fixture.home&&ledger[fixture.id].away===fixture.away);
  const weeklyHigh=complete?Math.max(...weekly.flatMap(match=>[match.homeScore,match.awayScore])):null;
  const scores=complete?weekly.flatMap(match=>[match.homeScore,match.awayScore]):[];
  const best=score=>scores.filter(other=>other>score).length;
  const fixed=points=>points.toFixed(2);

  return weekly.map(match=>{
    const {id,home,away,homeScore,awayScore}=match;
    const key='final:'+week+':'+id;
    const diff=Math.abs(Math.round(homeScore*100)-Math.round(awayScore*100))/100;
    const winner=homeScore===awayScore?null:homeScore>awayScore?home:away;
    const loser=winner===home?away:home;
    const hi=Math.max(homeScore,awayScore),lo=Math.min(homeScore,awayScore);
    const facts=[];
    const add=(condition,fact,variants)=>{
      if(condition)facts.push(fact+' '+pick(key+fact,variants));
    };

    const seeds=s.postseason?.seeds;
    const kind=fixtures.find(f=>f.id===id&&f.home===home&&f.away===away)?.kind;
    if(seeds?.includes(home)&&seeds.includes(away)){
      if(kind==='wild'){
        const advanced=postseasonWinner(match,seeds);
        add(true,name(s,advanced)+' advanced from the wild-card round.',
          ['The next round awaits.','That result keeps the title run alive.']);
      }
      if(kind==='opening'&&s.postseason.format===SIX_TEAM_FORMAT){
        const advanced=postseasonWinner(match,seeds);
        const consolation=advanced===home?away:home;
        add(true,name(s,advanced)+' advanced to the championship bracket. '+name(s,consolation)+
          ' entered the consolation bracket.'+(homeScore===awayScore?' The higher seed won the tiebreaker.':''),
          ['The opening round set both brackets.']);
      }
      const semifinal=['semi','championship-semi','consolation-semi'].includes(kind);
      const final=['final','championship-final','consolation-final'].includes(kind);
      if((semifinal&&week===16)||(final&&week===18)){
        const first=s.frozenMatchupSchedule?.[week-1]?.find(f=>f.kind===kind&&
          [f.home,f.away].includes(home)&&[f.home,f.away].includes(away));
        const leg=history.find(m=>m.week===week-1&&first&&m.id===first.id&&
          m.home===first.home&&m.away===first.away);
        if(leg){
          const aggregate=aggregateScore(match,leg,match);
          const advanced=postseasonWinner(aggregate,seeds);
          const total=fixed(aggregate.homeScore)+'–'+fixed(aggregate.awayScore);
          const outcome=kind==='consolation-final'?' won the consolation final and finished fourth':
            kind==='consolation-semi'?' advanced to the consolation final':
            final?' won the league championship':' advanced to the championship';
          add(true,name(s,advanced)+outcome+
            ' with a '+total+' aggregate score.'+
            (aggregate.homeScore===aggregate.awayScore?' The higher seed won the tiebreaker.':''),
            ['Both legs are in the books.','The full series decided it.']);
          add(resultFor(leg,advanced)<0,name(s,advanced)+' overturned a first-leg deficit of '+
            fixed(Math.abs(leg.homeScore-leg.awayScore))+' points.',
            ['The second leg changed the series.','That was a two-week comeback.']);
        }
      }
    }

    add(!winner,'A tied final score.',['Neither roster delivered the decisive point.','The scoreboard refuses to pick a side.']);
    add(diff>0&&diff<1,'Just '+fixed(diff)+' points separated the teams.',
      ['Every decimal mattered.','The box score needs a magnifying glass.']);
    add(diff>=1&&diff<5,'A '+fixed(diff)+'-point margin.',
      ['That one needed a seatbelt.','The lineup decisions will be replayed all week.']);
    add(diff>50,'A '+fixed(diff)+'-point blowout.',
      ['That was a demolition.','The opposition never found an answer.']);

    if(winner){
      const wonBy=name(s,winner),lostBy=name(s,loser);
      const previous=byTeam.get(winner)||[],opponentHistory=byTeam.get(loser)||[];
      const wins=previous.filter(m=>resultFor(m,winner)>0).length;
      const lastNonLoss=previous.findLastIndex(m=>resultFor(m,winner)>=0);
      const losingRun=previous.length-lastNonLoss-1;
      const lastNonWin=previous.findLastIndex(m=>resultFor(m,winner)<=0);
      const winningRun=previous.length-lastNonWin;
      const lastOpponentNonWin=opponentHistory.findLastIndex(m=>resultFor(m,loser)<=0);
      const opponentRun=opponentHistory.length-lastOpponentNonWin-1;
      const lastMeeting=previous.findLast(m=>[m.home,m.away].includes(loser));

      add(complete&&best(lo)===1&&scores.filter(score=>score===lo).length===1,lostBy+' lost despite posting the week’s second-highest score.',
        ['That score would have beaten every other opponent.','The schedule did the damage.']);
      add(opponentRun>=2,wonBy+' ended '+lostBy+'’s '+opponentRun+'-game winning streak.',
        ['The league finally found an answer.','That run stops here.']);
      add(previous.length>0&&wins===0,wonBy+' earned its first recorded win.',
        ['The win column is open for business.','The drought is over.']);
      add(wins>0&&losingRun>=2,wonBy+' snapped a '+losingRun+'-game losing streak.',
        ['The skid ends here.','That is a result to build on.']);
      add(lastMeeting&&resultFor(lastMeeting,winner)<0,wonBy+' avenged its Week '+lastMeeting?.week+' loss to '+lostBy+'.',
        ['The rematch went the other way.','They remembered the first box score.']);
      add(winningRun>=2,wonBy+' has won '+winningRun+' straight.',
        ['The winning habit is getting comfortable.','The league should be paying attention.']);
      add(previous.length>0&&previous.every(m=>hi>scoreFor(m,winner)),
        wonBy+' set a new personal scoring high of '+fixed(hi)+'.',
        ['The offense raised its ceiling.','The previous high is history.']);
    }

    for(const [team,points] of [[home,homeScore],[away,awayScore]]){
      add(points===weeklyHigh,name(s,team)+(scores.filter(score=>score===points).length>1?' tied for the weekly scoring lead with ':' led the week with ')+fixed(points)+' points.',
        ['That is the benchmark for the week.','The offense earned its flowers.']);
    }
    add(lo>0&&hi>=2*lo,'The winning score was at least twice the losing score.',
      ['Two different levels of offense showed up.','The numbers are downright rude.']);
    const scoreline=name(s,home)+' '+fixed(homeScore)+' – '+name(s,away)+' '+fixed(awayScore)+'.';
    const remark=facts.slice(0,2).join(' ')||('Final margin: '+fixed(diff)+' points.');
    return {key,id,week,updatedAt:match.finalizedAt||match.updatedAt,mentions:[home,away],
      margin:diff,line:scoreline+' '+remark};
  });
}

function finalPosts(s,since=-Infinity){
  const games=finalGames(s);
  const weeks=new Set(games.filter(match=>Date.parse(match.finalizedAt||match.updatedAt)>since||
    since===-Infinity).map(match=>match.week));
  return [...weeks].flatMap(week=>matchupCommentary(s,week,games))
    .filter(post=>since===-Infinity||Date.parse(post.updatedAt)>since)
    .map(post=>({...post,body:('🏁 THE AUDIBLE | WEEK '+post.week+': '+post.line).slice(0,1000)}));
}

module.exports={eventText,finalPosts,matchupCommentary};

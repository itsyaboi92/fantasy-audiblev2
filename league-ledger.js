'use strict';
// Weekly matchup snapshots, finalization, and standings.
// Keep persisted ledger structure and finalized matchups unchanged.
const postseason=require('./postseason');
function currentWeekScore(p,week){
  if(Number(p.scoreWeek)!==Number(week))return 0;
  if(p.nflGame?.status==='upcoming')return 0;
  return Number(p.scoringMode==='handcuff'?(p.credited??0):p.points)||0;
}
function ledgerScore(p,week){return currentWeekScore(p,week);}
function ledgerLineup(s,id,week){return s.players.filter(p=>p.owner===id&&!['BENCH','IR'].includes(p.slot)).map(p=>({id:p.id,name:p.name,team:p.team,pos:p.pos,slot:p.slot,status:p.status,points:ledgerScore(p,week),espnId:p.espnId||null,nflTeamId:p.nflTeamId||null,scoringMode:p.scoringMode||null,liveScoreStatus:p.liveScoreStatus||null}));}
function ledgerTotal(lineup){return Math.round(lineup.reduce((n,p)=>n+p.points,0)*100)/100;}
function createLeagueLedger(){
function updateWeeklyLedger(s,accounts,week,games,failures){
  if(!Number.isInteger(week)||week<1||week>18)return;
  s.weeklyLedger ||= {};
  const schedule=s.frozenMatchupSchedule||{};
  const matches=schedule[week]||[];
  const entry=s.weeklyLedger[week] ||= {week,createdAt:new Date().toISOString(),matchups:{}};
  const allFinal=games.length>0&&games.every(g=>g.status==='final')&&failures.length===0;
  for(const match of matches){
    const prior=entry.matchups[match.id];if(prior?.status==='final')continue;
    // A completed week's frozen lineup must never be rebuilt from today's
    // roster. Historical reconciliation updates the saved entries directly.
    // A previously captured lineup is the authority once games finish.
    // Never finalize an unverified snapshot merely because the NFL slate ended.
    // Matchup IDs are keys, not proof of ownership. Never reuse a saved
    // snapshot for a different pairing if the frozen schedule has changed.
    if(prior&&(String(prior.home)!==String(match.home)||String(prior.away)!==String(match.away))){
      prior.warning='Matchup snapshot protected: saved managers do not match the frozen schedule.';
      prior.snapshotIntegrityIssues=[{reason:'SCHEDULE_PAIRING_MISMATCH',expectedHome:String(match.home),expectedAway:String(match.away),savedHome:String(prior.home),savedAway:String(prior.away)}];
      prior.updatedAt=new Date().toISOString();
      continue;
    }
    if(prior&&allFinal)continue;
    const homeLineup=ledgerLineup(s,match.home,week),awayLineup=ledgerLineup(s,match.away,week);
    // Never silently replace a previously captured starter after that player's
    // NFL kickoff. Legitimate injury swaps are retained when the swap history
    // explicitly records the player being removed from this manager's lineup.
    // Preserve the existing snapshot for investigation rather than corrupting
    // historical evidence or guessing how the lineup should be reconstructed.
    if(prior){
      const gameByTeam=new Map();
      for(const game of games||[])for(const team of game.teams||[]){
        const teamId=typeof team==='object'?team.id:team;
        gameByTeam.set(String(teamId),game);
      }
      const changedSides=[];
      for(const [side,manager,next] of [
        ['homeLineup',match.home,homeLineup],['awayLineup',match.away,awayLineup]]){
        const nextIds=new Set(next.map(p=>String(p.id)));
        for(const old of prior[side]||[]){
          if(nextIds.has(String(old.id)))continue;
          const game=gameByTeam.get(String(old.nflTeamId??old.team??''));
          const kickoff=Date.parse(game?.kickoff||'');
          if(!Number.isFinite(kickoff)||Date.now()<kickoff)continue;
          const approved=(s.injurySwapHistory||[]).some(x=>
            Number(x.week)===week&&String(x.manager)===String(manager)&&
            String(x.removedId)===String(old.id));
          if(!approved)changedSides.push({side,playerId:String(old.id)});
        }
      }
      // A substitution history entry alone does not authorize arbitrary
      // replacements: require the incoming player to match the recorded swap.
      for(const [side,manager,next] of [
        ['homeLineup',match.home,homeLineup],['awayLineup',match.away,awayLineup]]){
        const previous=prior[side]||[];
        const previousIds=new Set(previous.map(p=>String(p.id)));
        const nextIds=new Set(next.map(p=>String(p.id)));
        for(const old of previous){
          if(nextIds.has(String(old.id)))continue;
          const game=gameByTeam.get(String(old.nflTeamId??old.team??''));
          const kickoff=Date.parse(game?.kickoff||'');
          if(!Number.isFinite(kickoff)||Date.now()<kickoff)continue;
          const swaps=(s.injurySwapHistory||[]).filter(x=>
            Number(x.week)===week&&String(x.manager)===String(manager)&&
            String(x.removedId)===String(old.id));
          if(swaps.length&&!swaps.some(x=>nextIds.has(String(x.replacementId))))
            changedSides.push({side,playerId:String(old.id),reason:'RECORDED_REPLACEMENT_NOT_IN_LINEUP'});
        }
      }
      if(changedSides.length){
        prior.warning='Lineup snapshot protected: a starter disappeared after kickoff without a recorded injury substitution.';
        prior.snapshotIntegrityIssues=changedSides;
        prior.updatedAt=new Date().toISOString();
        continue;
      }
    }
    const allPlayers=[...homeLineup,...awayLineup];
    const verified=homeLineup.length>0&&awayLineup.length>0&&
      new Set(allPlayers.map(p=>String(p.id))).size===allPlayers.length&&
      allPlayers.every(p=>p.liveScoreStatus==='UPDATED'&&
    (!p.scoringMode||p.scoringMode==='later')&&Number.isFinite(p.points));
    const status=allFinal&&verified?'final':'provisional';
    const homeScore=ledgerTotal(homeLineup),awayScore=ledgerTotal(awayLineup);
    entry.matchups[match.id]={id:match.id,home:match.home,away:match.away,
      homeScore,awayScore,homeLineup,awayLineup,status,
      winner:status==='final'?(homeScore===awayScore?null:homeScore>awayScore?match.home:match.away):null,
      updatedAt:new Date().toISOString(),warning:status==='final'?null:'Scoring is provisional; missing or unsupported NFL scoring may affect results.'};
  }
}
function leagueStandings(s,accounts){
  const result={};for(const m of s.managers)result[m.id]={manager:m.id,wins:0,losses:0,ties:0,pointsFor:0,pointsAgainst:0};
  for(const [weekNumber,week] of Object.entries(s.weeklyLedger||{}))for(const match of Object.values(week.matchups||{})){
    if(Number(weekNumber)>postseason.endWeek(s.managers.filter(m=>accounts.some(a=>a.manager===m.id)).length))continue;
    const fixture=(s.frozenMatchupSchedule?.[weekNumber]||[]).find(f=>String(f.id)===String(match.id));
    if(match.status!=='final'||!result[match.home]||!result[match.away]||
      !fixture||String(fixture.home)!==String(match.home)||String(fixture.away)!==String(match.away)||
      match.snapshotIntegrityIssues?.length||!Number.isFinite(match.homeScore)||!Number.isFinite(match.awayScore))continue;
    const a=result[match.home],b=result[match.away];a.pointsFor+=match.homeScore;a.pointsAgainst+=match.awayScore;
    b.pointsFor+=match.awayScore;b.pointsAgainst+=match.homeScore;
    if(match.homeScore===match.awayScore){a.ties++;b.ties++;}
    else if(match.homeScore>match.awayScore){a.wins++;b.losses++;}else{b.wins++;a.losses++;}
  }
  return Object.values(result).map(x=>({...x,pointsFor:Math.round(x.pointsFor*100)/100,pointsAgainst:Math.round(x.pointsAgainst*100)/100}))
    .sort((a,b)=>(b.wins+b.ties/2)/(b.wins+b.losses+b.ties||1)-(a.wins+a.ties/2)/(a.wins+a.losses+a.ties||1)||b.pointsFor-a.pointsFor);
}
return {updateWeeklyLedger,leagueStandings};
}
module.exports={createLeagueLedger,currentWeekScore,ledgerScore,ledgerLineup,ledgerTotal,...createLeagueLedger()};

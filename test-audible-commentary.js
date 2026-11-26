'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {finalPosts,matchupCommentary}=require('./audible-commentary');

const time='2026-11-25T12:00:00Z';
const match=(id,home,away,homeScore,awayScore,status='final')=>
  ({id,home,away,homeScore,awayScore,status,updatedAt:time});
function league(weeks){
  return {
    managers:['Alpha','Bravo','Charlie','Delta'].map(team=>({id:team[0],team})),
    weeklyLedger:Object.fromEntries(Object.entries(weeks).map(([week,matches])=>
      [week,{matchups:Object.fromEntries(matches.map(m=>[m.id,m]))}])),
    frozenMatchupSchedule:Object.fromEntries(Object.entries(weeks).map(([week,matches])=>
      [week,matches.map(({id,home,away,kind})=>({id,home,away,kind}))]))
  };
}

test('final announcements and recaps share the same verified score and commentary',()=>{
  const s=league({1:[match('one:two','A','B',101.2,100.2),match('cd','C','D',90,80,'provisional')]});
  const [post]=finalPosts(s,Date.parse(time)-1);
  assert.equal(post.key,'final:1:one:two');
  assert.deepEqual(post.mentions,['A','B']);
  assert.match(post.body,/Alpha 101\.20 – Bravo 100\.20.*A 1\.00-point margin/);
  assert.ok(post.body.endsWith(matchupCommentary(s,1)[0].line));
  assert.equal(finalPosts(s,Date.parse(time)).length,0);
  assert.doesNotMatch(post.body,/second-highest|led the week/);
});

test('weekly score claims require all fixtures to have verified finals',()=>{
  const s=league({1:[match('ab','A','B',130,115),match('cd','C','D',110,90)]});
  const [post]=finalPosts(s);
  assert.match(post.body,/Bravo lost despite posting the week’s second-highest score/);
  assert.match(post.body,/Alpha led the week with 130\.00 points/);
  s.weeklyLedger[1].matchups.cd.homeScore=115;
  assert.doesNotMatch(finalPosts(s)[0].body,/would have beaten every other opponent/);
});

test('earlier verified matchups establish streaks and the rematch outcome',()=>{
  const s=league({
    1:[match('ab','A','B',112,115)],
    2:[match('bc','B','C',130,90),match('ad','A','D',99,103,'provisional')],
    3:[match('ab','A','B',122,111)],
    4:[match('bc','B','C',135,98)]
  });
  const [post]=matchupCommentary(s,3);
  assert.match(post.line,/Alpha ended Bravo’s 2-game winning streak/);
  assert.match(post.line,/Alpha earned its first recorded win/);
});

test('a completed second leg can clear a first-leg deficit and decide a title',()=>{
  const s=league({
    17:[{...match('leg-1','A','B',108,120),kind:'final'}],
    18:[{...match('leg-2','A','B',130,110),kind:'final'}]
  });
  s.postseason={seeds:['B','A']};
  assert.match(matchupCommentary(s,18)[0].line,/Alpha won the league championship with a 238\.00–230\.00 aggregate score/);
  assert.match(matchupCommentary(s,18)[0].line,/overturned a first-leg deficit of 12\.00 points/);
  s.weeklyLedger[18].matchups['leg-2'].homeScore=122;
  assert.match(matchupCommentary(s,18)[0].line,/Bravo won the league championship.*higher seed won the tiebreaker/);
  s.weeklyLedger[17].matchups['leg-1'].status='provisional';
  assert.doesNotMatch(matchupCommentary(s,18)[0].line,/championship/);
});

'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const start=source.indexOf('async function reconcileHistoricalMatchups(){');
const end=source.indexOf('\nconst playerHistoryCache=',start);
assert.ok(start>=0&&end>start,'historical reconciliation must exist');
const reconcile=source.slice(start,end);
test('reconciliation skips player updates for finalized matchups',()=>{
 assert.match(reconcile,/for\(const u of updates\)\{\s*const match=matches\[u\.matchId\];if\(!match\|\|match\.status==='final'\)continue;/);
});
test('reconciliation validates scheduled managers before updating entries',()=>{
 assert.match(reconcile,/const scheduled=\(s\.frozenMatchupSchedule\?\.\[week\]\|\|\[\]\)\.find/);
 assert.match(reconcile,/String\(scheduled\.home\)!==String\(match\.home\)/);
 assert.match(reconcile,/String\(scheduled\.away\)!==String\(match\.away\)/);
});
test('finalization refuses unresolved integrity warnings',()=>{
 assert.match(reconcile,/if\(match\.snapshotIntegrityIssues\?\.length\)\{/);
 assert.match(reconcile,/Verification blocked: unresolved lineup snapshot integrity issues/);
});

test('historical scoring writes verified week and game provenance',()=>{
 assert.match(reconcile,/entry\.verifiedScoreWeek=week/);
 assert.match(reconcile,/entry\.verifiedScoreGameId=u\.game\?String\(u\.game\.id\):null/);
 assert.match(reconcile,/entry\.verifiedScoreTeamId=u\.team\?String\(u\.team\):null/);
});
test('historical finalization rejects wrong week or unmatched game/team',()=>{
 assert.match(reconcile,/Number\(p\.verifiedScoreWeek\)!==week/);
 assert.match(reconcile,/!p\.verifiedScoreGameId/);
 assert.match(reconcile,/String\(g\.id\)===String\(p\.verifiedScoreGameId\)/);
 assert.match(reconcile,/String\(t\.id\)===String\(p\.verifiedScoreTeamId\)/);
});

test('historical finalization requires a nonempty lineup on both sides',()=>{
 assert.match(reconcile,/if\(!home\.length\|\|!away\.length\)/);
});
test('historical finalization refuses duplicate player IDs across teams',()=>{
 assert.match(reconcile,/new Set\(lineupIds\)\.size!==lineupIds\.length/);
 assert.match(reconcile,/DUPLICATE_PLAYER_IN_MATCHUP/);
});

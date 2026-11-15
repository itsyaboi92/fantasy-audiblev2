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

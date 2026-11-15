'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=source.indexOf('function matchupActualPoints(p,week){');
const end=source.indexOf('\nfunction matchupPlayerCell(',start);
assert.ok(start>=0&&end>start,'matchupActualPoints function must be present');
const fnSource=source.slice(start,end);
function points(player,week,gameStatus='upcoming'){
 const context={
   nflPlayerGame:()=>({game:{status:gameStatus}}),
   Number
 };
 vm.runInNewContext(fnSource,context,{timeout:1000});
 return context.matchupActualPoints(player,week);
}
test('historical frozen player points survive stale upcoming schedule',()=>{
 assert.equal(points({_frozenWeek:9,points:17.25},9,'upcoming'),17.25);
});
test('historical frozen points survive missing game information',()=>{
 assert.equal(points({_frozenWeek:9,points:12},9,'missing'),12);
});
test('current-week upcoming player cannot show stale points',()=>{
 assert.equal(points({scoreWeek:9,points:25},9,'upcoming'),0);
});
test('current-week scored player uses current score week',()=>{
 assert.equal(points({scoreWeek:9,points:14.5},9,'final'),14.5);
 assert.equal(points({scoreWeek:8,points:14.5},9,'final'),0);
});
test('handcuff scoring uses credited points for live roster',()=>{
 assert.equal(points({scoreWeek:9,scoringMode:'handcuff',credited:6,points:20},9,'playing'),6);
});

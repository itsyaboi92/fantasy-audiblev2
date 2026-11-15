'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=source.indexOf('const lineupBySlot=rows=>{');
const end=source.indexOf('\n  // Future weeks have no recorded lineup yet.',start);
assert.ok(start>=0&&end>start,'historical lineup mapping must exist');
function map(rows,slots=['QB','RB','WR','FLEX']){
 const context={STARTER_ORDER:slots};
 vm.runInNewContext(source.slice(start,end)+'\nthis.mapLineup=lineupBySlot;',context,{timeout:1000});
 const result=context.mapLineup(rows);
 return {ordered:result.ordered.map(p=>p?.id||null),extras:result.extras.map(p=>p.id)};
}
test('saved historical players remain assigned to their starter slots',()=>{
 assert.deepEqual(map([{id:'q',slot:'QB'},{id:'r',slot:'RB'}]).ordered,['q','r',null,null]);
});
test('duplicate-slot historical entries remain visible as extras',()=>{
 assert.deepEqual(map([{id:'q1',slot:'QB'},{id:'q2',slot:'QB'}]).extras,['q2']);
});
test('saved substitution entries without starter slot remain visible',()=>{
 assert.deepEqual(map([{id:'q',slot:'QB'},{id:'old',slot:'SUBSTITUTED'}]).extras,['old']);
});
test('saved FLEX player remains in FLEX rather than disappearing',()=>{
 const result=map([{id:'q',slot:'QB'},{id:'f',slot:'FLEX'}]);
 assert.equal(result.ordered[3],'f');assert.deepEqual(result.extras,[]);
});
test('multiple saved entries are not lost',()=>{
 const rows=[{id:'q',slot:'QB'},{id:'a',slot:'QB'},{id:'b',slot:'SUBSTITUTED'},{id:'r',slot:'RB'}];
 const result=map(rows);
 assert.equal(result.ordered.filter(Boolean).length+result.extras.length,rows.length);
});

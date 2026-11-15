'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const start=source.indexOf('function fantasySchedule(s,accounts,startWeek=1){');
const end=source.indexOf('\n// ESPN is authoritative',start);
assert.ok(start>=0&&end>start,'fantasySchedule must exist');
const context={postseason:{endWeek:n=>n<=8?14:13}};
vm.runInNewContext(source.slice(start,end)+'\nthis.makeSchedule=fantasySchedule;',context,{timeout:1000});
const makeSchedule=context.makeSchedule;
for(const n of [2,3,4,5,6,8,10,12]){
 test(n+' managers have unique weekly fixtures and IDs',()=>{
  const ids=Array.from({length:n},(_,i)=>'m'+(i+1));
  const schedule=makeSchedule({managers:ids.map(id=>({id}))},ids.map(manager=>({manager})),1);
  const expectedWeeks=n<=8?14:13;
  assert.equal(Object.keys(schedule).length,expectedWeeks);
  for(const [week,matches] of Object.entries(schedule)){
   assert.equal(matches.length,Math.floor(n/2),'week '+week+' fixture count');
   const used=new Set(),fixtureIds=new Set();
   for(const m of matches){
    assert.ok(!fixtureIds.has(m.id),'duplicate fixture ID '+m.id);
    fixtureIds.add(m.id);
    assert.notEqual(m.home,m.away);
    for(const manager of [m.home,m.away]){
     assert.ok(!used.has(manager),'manager appears twice in week '+week);
     used.add(manager);
    }
   }
  }
 });
}
test('schedule uses only registered managers',()=>{
 const s={managers:[{id:'m1'},{id:'m2'},{id:'m3'}]};
 const result=makeSchedule(s,[{manager:'m1'},{manager:'m2'}],1);
 for(const matches of Object.values(result))for(const m of matches){
  assert.ok(['m1','m2'].includes(m.home));
  assert.ok(['m1','m2'].includes(m.away));
 }
});
test('schedule respects league start week',()=>{
 const s={managers:[{id:'m1'},{id:'m2'}]};
 const result=makeSchedule(s,[{manager:'m1'},{manager:'m2'}],9);
 assert.deepEqual(Object.keys(result),['9','10','11','12','13','14']);
});

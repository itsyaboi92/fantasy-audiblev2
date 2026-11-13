'use strict';
const assert=require('node:assert/strict');
const {mapBounded}=require('./bounded-work');
(async()=>{
  let active=0,peak=0;
  const result=await mapBounded(Array.from({length:45},(_,i)=>i),2,async i=>{
    active++;peak=Math.max(peak,active);
    await new Promise(r=>setTimeout(r,(i%3)+1));
    active--;return i*2;
  });
  assert.equal(peak,2,'peak concurrency must not exceed two');
  assert.deepEqual(result,Array.from({length:45},(_,i)=>i*2),'output order preserved');
  assert.deepEqual(await mapBounded([],2,async()=>{throw Error('unexpected');}),[]);
  await assert.rejects(mapBounded([1,2],2,async i=>{if(i===2)throw Error('upstream failure');return i;}),/upstream failure/);
  console.log('Bounded work tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

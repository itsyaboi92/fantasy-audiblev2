'use strict';
// Maintain input order, cap simultaneously retained responses, and propagate errors.
async function mapBounded(items, limit, worker) {
  const input=Array.from(items);
  const output=new Array(input.length);
  const workers=Math.min(input.length,Math.max(1,Math.floor(Number(limit)||1)));
  let next=0;
  await Promise.all(Array.from({length:workers},async()=>{
    while(next<input.length){
      const i=next++;
      output[i]=await worker(input[i],i);
    }
  }));
  return output;
}
module.exports={mapBounded};

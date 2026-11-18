'use strict';
const assert=require('node:assert/strict');
const {replacementHealthEligible}=require('./injury-substitutions');
for(const status of ['ACTIVE','HEALTHY','QUESTIONABLE','DOUBTFUL','UNKNOWN']){
  assert.equal(replacementHealthEligible({injuryStatus:status}),true,status+' should be selectable');
}
for(const status of ['OUT','IR','INJURED_RESERVE','INJURY_RESERVE','RESERVE_INJURED','SUSPENDED','PUP','NFI']){
  assert.equal(replacementHealthEligible({injuryStatus:status}),false,status+' should be excluded');
}
console.log('PASS injury replacement designation filtering');

const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../analysis.js');

test('median and MAD, including empty input',()=>{
  assert.equal(M.median([]),null); assert.equal(M.median([5,3,1]),3);
  assert.equal(M.median([4,1,2,3]),2.5); assert.equal(M.mad([1,2,3,4,5]),1);
});
test('reaction summary and false start',()=>{
  const r=M.reaction([250,230,265,245,255],2);
  assert.equal(r.trials,5);assert.equal(r.medianMs,250);assert.equal(r.falseStarts,2);
});
test('tapping summary',()=>{
  const r=M.tapping([100,300,500,700],15000);
  assert.equal(r.taps,4);assert.equal(r.medianIntervalMs,200);
  assert.equal(r.tapsPerSec,.27);
});
test('motion invalid when no data or inadequate sample rate',()=>{
  assert.equal(M.tremor([]).valid,false);
  assert.equal(M.tremor([{t:1,x:null,y:2,z:3},{t:2,x:null,y:2,z:3}]).valid,false);
  const slow=Array.from({length:101},(_,i)=>({t:i*100,x:0,y:0,z:0}));
  assert.equal(M.tremor(slow).valid,false);
});
test('motion spectrum finds clean synthetic 6 Hz oscillation from irregular samples',()=>{
  const samples=[];let t=0;
  for(let i=0;i<650;i++) {t+=17.5+(i%3-1)*1.2;const x=.8*Math.sin(2*Math.PI*6*t/1000);samples.push({t,x,y:0,z:9.81});}
  const r=M.tremor(samples);
  assert.equal(r.valid,true);
  assert.ok(r.sampleRateHz>40);assert.ok(Math.abs(r.dominantHz-6)<.26,`freq ${r.dominantHz}`);
  assert.ok(r.rmsMps2>.1);
});
test('baseline needs five prior valid sessions and excludes invalid',()=>{
  const data=Array.from({length:7},(_,i)=>({type:'reaction',valid:i!==4,ts:100+i,metrics:{medianMs:200+i*3}}));
  const base=M.baseline(data,'reaction','medianMs');
  assert.equal(base.ready,true);assert.equal(base.count,6);
  assert.ok(Number.isFinite(M.compare(230,base)));
  const early=M.baseline(data.slice(0,4),'reaction','medianMs');
  assert.equal(early.ready,false);
});

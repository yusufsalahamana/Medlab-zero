const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze,roi}=require('../pulse.js');
function fixture(bpm=90,{rate=30,duration=25,noise=0,jitter=0}={}){
  let seed=7;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  return Array.from({length:Math.floor(rate*duration)+1},(_,i)=>{
    const t=i*1000/rate+(i&&i<rate*duration?(random()-.5)*jitter:0);
    return {t,y:120+3*Math.sin(2*Math.PI*bpm/60*t/1000)+noise*(random()-.5),clipped:0};
  });
}
for(const bpm of [45,60,72,90,120,150,180])test(`synthetic ${bpm}/min: frequency within 1.3/min, including drift/noise`,()=>{
  const samples=fixture(bpm,{noise:.5,jitter:2}).map(s=>({...s,y:s.y+s.t/25000*4}));
  const r=analyze(samples);assert.ok(r.valid,JSON.stringify(r));assert.ok(Math.abs(r.candidateBpm-bpm)<1.3);assert.ok(r.peakCount>=12);
});
test('stable frequency with 24/60 Hz input and mild timestamp jitter',()=>{
  for(const rate of [24,60]){const r=analyze(fixture(96,{rate,jitter:3,noise:.3}));assert.ok(r.valid,JSON.stringify(r));assert.ok(Math.abs(r.candidateBpm-96)<1);}
});
test('fail closed: flat, small amplitude, dark, saturated, pixel clipping, noise and motion',()=>{
  const flat=fixture().map(s=>({...s,y:120}));
  const small=fixture().map(s=>({...s,y:120+(s.y-120)*.01}));
  const dark=fixture().map(s=>({...s,y:s.y-110}));
  const bright=fixture().map(s=>({...s,y:s.y+124}));
  const clipped=fixture().map(s=>({...s,clipped:.15}));
  const noisy=fixture(90,{noise:50});
  const jump=fixture().map(s=>({...s,y:s.y+(s.t>12500?30:0)}));
  const mixed=fixture().map(s=>({...s,y:s.y+5*Math.sin(2*Math.PI*2.3*s.t/1000)}));
  for(const samples of [flat,small,dark,bright,clipped,noisy,jump,mixed]){
    const r=analyze(samples);assert.equal(r.valid,false,JSON.stringify(r));assert.equal(r.candidateBpm,null);assert.equal(r.trace,undefined);
  }
});
test('fail closed: short/low rate, gaps, irregular order, nonfinite and timestamps',()=>{
  const gap=fixture().filter(s=>s.t<10000||s.t>10600);
  const jitter=fixture(90,{jitter:27});
  const reversed=fixture();reversed[3].t=reversed[2].t;
  const malformed=fixture();malformed[1].y=NaN;
  for(const s of [[],fixture(90,{duration:10}),fixture(90,{rate:15}),gap,jitter,reversed,malformed]){
    const r=analyze(s);assert.equal(r.valid,false,JSON.stringify(r));assert.equal(r.candidateBpm,null);
  }
});
test('nonstationary pulse-like fixture is rejected',()=>{
  const s=fixture().map(s=>({...s,y:120+3*Math.sin(2*Math.PI*(s.t<12500?1:2)*s.t/1000)}));
  assert.equal(analyze(s).valid,false);
});
test('ROI luminance and clipped-pixel fraction come from RGBA, not an invented trace',()=>{
  const r=roi(Uint8ClampedArray.from([0,0,0,255,255,255,255,255,100,100,100,255]));
  assert.ok(Math.abs(r.y-355/3)<1e-6);assert.equal(r.clipped,2/3);assert.throws(()=>roi([]));
});
module.exports={fixture};

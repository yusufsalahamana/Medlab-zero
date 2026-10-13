const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../reflex.js');
const context={hand:'right',posture:'seated-supported',deviceKey:'synthetic-device-A'};
function stages(start=100000,offset=0){
  return [
    {type:'reaction',valid:true,startedAt:start,endedAt:start+10000,durationMs:10000,deviceKey:context.deviceKey,qc:{valid:true,source:'pointer'},metrics:{trials:5,medianMs:250+offset,minimumMs:230,madMs:10,falseStarts:0,trace:[1,2]}},
    {type:'tapping',valid:true,startedAt:start+11000,endedAt:start+26000,durationMs:15000,deviceKey:context.deviceKey,qc:{valid:true,source:'pointer'},metrics:{taps:60,seconds:15,tapsPerSec:4+offset/100,medianIntervalMs:250,intervalCv:.1}},
    {type:'tremor',valid:true,startedAt:start+27000,endedAt:start+39000,durationMs:12000,deviceKey:context.deviceKey,qc:{valid:true,source:'acceleration',missingSamples:0},metrics:{sampleCount:600,sampleRateHz:50,durationSec:11.98,rmsMps2:.1+offset/1000,dominantHz:6,trace:[1,2],samples:[1,2]}}
  ];
}
function row(i=0,offset=0){const made=R.make(stages(100000+i*60000,offset),context);assert.equal(made.valid,true,made.reason);return {id:'synthetic-'+i,ts:made.session.endedAt,type:'reflex',valid:true,reflex:made.session,metrics:R.metrics(made.session)};}
test('linked summaries strip raw traces/samples and contain actual ordered timing/provenance',()=>{
  const r=row();assert.equal(R.usable(r.reflex),true);assert.doesNotMatch(JSON.stringify(r),/"trace"|"samples"/);assert.deepEqual(r.reflex.stages.map(s=>s.type),['reaction','tapping','tremor']);assert.equal(r.reflex.stages[2].qc.source,'acceleration');
});
test('missing/invalid stages, nonfinite metrics, changed context and impossible timing fail closed',()=>{
  for(const modify of [s=>s.pop(),s=>s[1].valid=false,s=>s[0].qc.valid=false,s=>s.reverse(),s=>delete s[2].metrics.sampleRateHz,s=>s[2].metrics.rmsMps2=NaN,s=>s[2].deviceKey='other',s=>s[1].startedAt=s[0].startedAt,s=>s[2].durationMs=2,s=>s[0].qc.source='mixed']){const s=stages();modify(s);assert.equal(R.make(s,context).valid,false);}
  assert.equal(R.make(stages(),{...context,hand:''}).valid,false);assert.equal(R.make(stages(),{...context,posture:'standing'}).valid,false);
});
test('reference is insufficient before 5 prior comparable complete sessions, not individual modules',()=>{
  const latest=row(6),rows=Array.from({length:4},(_,i)=>row(i));rows.push({...row(4),type:'reaction'});const r=R.compare(rows,latest);assert.equal(r.ready,false);assert.equal(r.count,4);assert.deepEqual(r.features,[]);
});
test('5 comparable prior sessions produce transparent finite MAD/spread/deviations',()=>{
  const r=R.compare([0,1,2,3,4].map(i=>row(i,i-2)),row(6,20));assert.equal(r.ready,true);assert.equal(r.count,5);
  const f=r.features[0];assert.equal(f.center,250);assert.equal(f.mad,1);assert.equal(f.spread,12.5);assert.equal(f.z,1.6);assert.equal(f.low,218.75);assert.equal(f.high,281.25);
});
test('constant repeated metrics use finite zero-MAD floor, without disease score',()=>{
  const r=R.compare([0,1,2,3,4].map(i=>row(i)),row(6));assert.ok(r.ready);for(const f of r.features){assert.equal(f.mad,0);assert.ok(f.spread>0);assert.equal(f.z,0);}assert.equal(r.score,undefined);
});
test('outlier does not dominate small-sample median',()=>{
  const r=R.compare([0,1,2,3,4].map(i=>row(i,i===4?1000:0)),row(6));assert.equal(r.features[0].center,250);assert.equal(r.features[0].mad,0);
});
test('different device, hand, input or sensor source and invalid/future/self/duplicate records are excluded',()=>{
  const current=row(10),rows=[0,1,2,3,4].map(i=>row(i));
  for(const edit of [r=>r.reflex.context.hand='left',r=>r.reflex.context.deviceKey='other',r=>r.reflex.stages[2].qc.source='includes-gravity',r=>r.reflex.stages.slice(0,2).forEach(s=>s.qc.source='keyboard'),r=>r.valid=false,r=>r.reflex.protocol=0]){const r=row(5);edit(r);rows.push(r);}
  rows.push(row(11),current,rows[0]);const r=R.compare(rows,current);assert.equal(r.ready,true);assert.equal(r.count,5);
});
test('temporal drift: only latest 20 prior sessions, sorted by capture time, no future leakage',()=>{
  const rows=Array.from({length:30},(_,i)=>row(i,i));rows.push(row(40,1000));const r=R.compare(rows.reverse(),row(31,40));assert.equal(r.count,20);assert.equal(r.features[0].center,269.5);
});
test('corrupt latest data or an overlapping capture cannot become a reference',()=>{
  const current=row(7),bad=row(6);bad.reflex.stages[2].qc.valid=false;
  assert.equal(R.compare([bad],current).count,0);assert.equal(R.compare([],bad).ready,false);
  const overlap=row(8);overlap.ts=current.ts-1;assert.equal(R.compare([overlap],current).count,0);
});
test('motion QC rejects timestamp gaps, missing values, dropouts and mixed sources',()=>{
  const samples=Array.from({length:600},(_,i)=>({t:i*20,x:0,y:0,z:0}));assert.equal(R.motionQuality(samples,0,['acceleration']).valid,true);
  for(const [data,missing,sources] of [[samples,40,['acceleration']],[samples,0,['acceleration','includes-gravity']],[samples.filter((s,i)=>i<200||i>225),0,['acceleration']],[samples.map((s,i)=>({...s,t:i===1?0:s.t})),0,['acceleration']],[samples.map((s,i)=>({...s,x:i===1?NaN:0})),0,['acceleration']]])assert.equal(R.motionQuality(data,missing,sources).valid,false);
});
test('reference availability groups 5 valid sessions by context and does not count duplicates',()=>{
  const rows=[0,1,2,3,4].map(i=>row(i));assert.equal(R.hasReference(rows.slice(0,4)),false);assert.equal(R.hasReference(rows),true);assert.equal(R.hasReference(Array(5).fill(rows[0])),false);
  rows[4].reflex.context.hand='left';assert.equal(R.hasReference(rows),false);
});
test('malformed or sparse imported-like summaries fail closed without throwing',()=>{
  for(const stagesInput of [null,{},[undefined,...stages().slice(1)],[...stages().slice(0,2),undefined],Array(3)])assert.equal(R.make(stagesInput,context).valid,false);
  const s=row().reflex;s.stages={};assert.equal(R.usable(s),false);assert.equal(R.motionQuality({},0,['acceleration']).valid,false);
});

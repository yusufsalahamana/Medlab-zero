/* MED-LAB ZERO — pure numerical tools; no medical inference. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MedMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function finite(xs) { return xs.filter(Number.isFinite).sort((a,b) => a-b); }
  function median(xs) { const s=finite(xs); return !s.length ? null : (s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2; }
  function mad(xs) { const m=median(xs); return m===null ? null : median(xs.map(v=>Math.abs(v-m))); }
  function mean(xs) { const s=xs.filter(Number.isFinite); return s.length ? s.reduce((a,b)=>a+b,0)/s.length : null; }
  function std(xs) { const m=mean(xs); return m===null ? null : Math.sqrt(mean(xs.map(v=>(v-m)**2))); }
  function reaction(times, falseStarts) { const valid=times.filter(v=>Number.isFinite(v)&&v>=100&&v<=3000); return {trials:valid.length,medianMs:median(valid),minimumMs:valid.length?Math.min(...valid):null,madMs:mad(valid),falseStarts}; }
  function tapping(stamps, durationMs) { const a=stamps.filter(Number.isFinite); const diffs=a.slice(1).map((t,i)=>t-a[i]).filter(n=>n>0); const avg=mean(diffs); return {taps:a.length,seconds:durationMs/1000,tapsPerSec:Math.round(a.length/(durationMs/1000)*100)/100,medianIntervalMs:median(diffs),intervalCv:avg&&diffs.length>1?Math.round(std(diffs)/avg*1000)/1000:null}; }
  function tremor(samples) {
    if (!samples||samples.length<2) return {valid:false,reason:'Sampel tidak mencukupi'};
    const filtered=samples.filter(s=>[s.t,s.x,s.y,s.z].every(Number.isFinite)).sort((a,b)=>a.t-b.t);
    if (filtered.length<2) return {valid:false,reason:'Tidak ada cukup sampel sensor yang valid'};
    const duration=(filtered[filtered.length-1].t-filtered[0].t)/1000;
    const rate=duration>0?(filtered.length-1)/duration:0;
    if (duration<8 || filtered.length<160 || rate<28) return {valid:false,reason:'Sampling kurang: perlukan ≥8 dtk, ≥160 sampel, dan ≥28 Hz',sampleCount:filtered.length,sampleRateHz:+rate.toFixed(1)};
    let low=[filtered[0].x,filtered[0].y,filtered[0].z], prev=filtered[0].t;
    const axis=[[],[],[]];
    for (const s of filtered) {
      const dt=Math.max(.001,Math.min(.1,(s.t-prev)/1000)); prev=s.t;
      const alpha=Math.exp(-2*Math.PI*.7*dt);
      [s.x,s.y,s.z].forEach((v,i)=>{low[i]=alpha*low[i]+(1-alpha)*v;axis[i].push(v-low[i]);});
    }
    const rms=axis.map(v=>Math.sqrt(mean(v.map(x=>x*x))));
    const best=rms.indexOf(Math.max(...rms)); const signal=axis[best];
    // Nonuniform sample timestamps: direct harmonic projection across 3–12 Hz.
    let peak={hz:null,amplitude:0};
    for(let f=3;f<=Math.min(12,rate*.42);f+=.25){
      let co=0,si=0;
      for(let i=0;i<filtered.length;i++){
        const w=2*Math.PI*f*(filtered[i].t-filtered[0].t)/1000;
        co+=signal[i]*Math.cos(w); si+=signal[i]*Math.sin(w);
      }
      const amplitude=2*Math.hypot(co,si)/filtered.length;
      if(amplitude>peak.amplitude)peak={hz:+f.toFixed(2),amplitude};
    }
    const dyn=Math.sqrt(mean(axis[0].map((v,i)=>v*v+axis[1][i]**2+axis[2][i]**2)));
    return {valid:true,sampleCount:filtered.length,sampleRateHz:+rate.toFixed(1),durationSec:+duration.toFixed(2),rmsMps2:+dyn.toFixed(4),dominantHz:Math.max(...rms)>=.03?peak.hz:null,dominantAmplitudeMps2:+peak.amplitude.toFixed(4),axis:best,trace:signal.slice(0,180)};
  }
  function baseline(rows,kind,metric,latestTimestamp) {
    const vals=rows.filter(r=>r.type===kind&&r.valid&&Number.isFinite(r.metrics?.[metric])&&(!latestTimestamp||r.ts<latestTimestamp)).slice(-20).map(r=>r.metrics[metric]);
    if(vals.length<5)return {ready:false,count:vals.length};
    const center=median(vals), deviation=mad(vals), floor=Math.max(Math.abs(center)*.05,metric==='medianMs'?8:metric==='tapsPerSec'?.1:.01);
    return {ready:true,count:vals.length,center,spread:Math.max((deviation||0)*1.4826,floor)};
  }
  function compare(value,base) {return (!base.ready || !Number.isFinite(value))?null:(value-base.center)/base.spread;}
  return {median,mad,mean,std,reaction,tapping,tremor,baseline,compare};
});

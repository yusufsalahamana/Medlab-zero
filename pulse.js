/* Optical periodicity candidates, not validated heart rate. No browser/storage I/O. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.MedPulse=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  const median=a=>{const b=a.slice().sort((x,y)=>x-y);return (b[Math.floor((b.length-1)/2)]+b[Math.floor(b.length/2)])/2;};
  const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)));};
  const reject=(reason,extra={})=>({valid:false,candidateBpm:null,reason,...extra});
  function spectrum(x,rate){
    const powers=[];
    for(let f=.75;f<=3.001;f+=.01){
      let co=0,si=0;
      for(let i=0;i<x.length;i++){
        const y=x[i]*(.5-.5*Math.cos(2*Math.PI*i/(x.length-1)));
        const phase=2*Math.PI*f*i/rate;
        co+=y*Math.cos(phase);si+=y*Math.sin(phase);
      }
      powers.push({f,p:co*co+si*si});
    }
    const peak=powers.reduce((a,b)=>a.p>b.p?a:b);
    const total=powers.reduce((s,v)=>s+v.p,0);
    const share=powers.filter(v=>Math.abs(v.f-peak.f)<=.12).reduce((s,v)=>s+v.p,0)/(total||1);
    return {hz:peak.f,share};
  }
  function analyze(samples){
    if(!Array.isArray(samples)||samples.length<400)return reject('Sampel kurang: perlu ≥20 detik dan ≥400 frame unik.');
    if(samples.some((s,i)=>!s||![s.t,s.y].every(Number.isFinite)||s.y<0||s.y>255||(i&&s.t<=samples[i-1].t)))return reject('Timestamp atau luminansi tidak valid.');
    const duration=(samples.at(-1).t-samples[0].t)/1000;
    const rate=(samples.length-1)/duration;
    const info={durationSec:+duration.toFixed(2),sampleRateHz:+rate.toFixed(1),sampleCount:samples.length};
    if(duration<20||duration>35||rate<20||rate>120)return reject('Durasi/laju tidak cukup: perlu 20–35 detik, 20–120 frame/detik.',info);
    const dt=samples.slice(1).map((s,i)=>s.t-samples[i].t),step=median(dt);
    if(Math.max(...dt)>250||sd(dt)/mean(dt)>.25||dt.filter(v=>v>step*1.8).length/dt.length>.02)return reject('Jeda atau ketidakaturan frame terlalu besar.',info);
    const luminance=samples.map(s=>s.y),level=mean(luminance);
    if(level<15||level>240||luminance.filter(v=>v<=5||v>=250).length/luminance.length>.02||samples.some(s=>Number.isFinite(s.clipped)&&s.clipped>.1))return reject('Pencahayaan terlalu gelap/terang atau piksel jenuh.',info);
    const spread=sd(luminance);
    if(spread<.2||spread/level<.001)return reject('Sinyal datar atau variasi optik terlalu kecil.',info);
    if(luminance.slice(1).some((v,i)=>Math.abs(v-luminance[i])>Math.max(8,spread*5)))return reject('Perubahan mendadak: gerakan atau pencahayaan tidak stabil.',info);
    // Interpolate only after timestamp QC; do not silently bridge large gaps.
    const hz=30,uniform=[];let cursor=1;
    for(let t=samples[0].t;t<=samples.at(-1).t;t+=1000/hz){
      while(cursor<samples.length-1&&samples[cursor].t<t)cursor++;
      const a=samples[cursor-1],b=samples[cursor];
      uniform.push(a.y+(b.y-a.y)*(t-a.t)/(b.t-a.t));
    }
    // Remove linear drift and a centered 1-second baseline, then 3-point smooth.
    const n=uniform.length,center=(n-1)/2,m=mean(uniform);
    const slope=uniform.reduce((s,v,i)=>s+(i-center)*(v-m),0)/uniform.reduce((s,v,i)=>s+(i-center)**2,0);
    const detrended=uniform.map((v,i)=>v-m-slope*(i-center));
    const high=detrended.map((v,i)=>v-mean(detrended.slice(Math.max(0,i-15),Math.min(n,i+16))));
    const filtered=high.map((v,i)=>mean(high.slice(Math.max(0,i-1),Math.min(n,i+2)))).slice(30,-30);
    const spec=spectrum(filtered,hz),period=hz/spec.hz;
    if(spec.share<.65)return reject('Sinyal bising: puncak spektral tidak cukup dominan.',info);
    // Strong autocorrelation and consistent peaks must independently agree.
    const lag=Math.round(period);let cross=0,left=0,right=0;
    for(let i=lag;i<filtered.length;i++){cross+=filtered[i]*filtered[i-lag];left+=filtered[i]**2;right+=filtered[i-lag]**2;}
    const correlation=cross/Math.sqrt(left*right);
    if(!Number.isFinite(correlation)||correlation<.65)return reject('Pola optik tidak berulang dengan cukup konsisten.',info);
    const peaks=[],threshold=sd(filtered)*.25;
    for(let i=1;i<filtered.length-1;i++){
      if(filtered[i]<threshold||filtered[i]<=filtered[i-1]||filtered[i]<filtered[i+1])continue;
      const last=peaks.at(-1);
      if(last!==undefined&&i-last<period*.6){if(filtered[i]>filtered[last])peaks[peaks.length-1]=i;}
      else peaks.push(i);
    }
    if(peaks.length<12)return reject('Puncak berulang terlalu sedikit.',info);
    const intervals=peaks.slice(1).map((p,i)=>(p-peaks[i])/hz),beatHz=1/median(intervals);
    if(sd(intervals)/mean(intervals)>.15||Math.abs(beatHz-spec.hz)/spec.hz>.06)return reject('Interval puncak tidak stabil atau estimator tidak sepakat.',info);
    const half=Math.floor(filtered.length/2),first=spectrum(filtered.slice(0,half),hz),second=spectrum(filtered.slice(half),hz);
    if(first.share<.55||second.share<.55||Math.abs(first.hz-second.hz)/spec.hz>.08)return reject('Pola berubah selama rekaman.',info);
    return {valid:true,candidateBpm:+(spec.hz*60).toFixed(1),...info,peakCount:peaks.length,spectralShare:+spec.share.toFixed(3),correlation:+correlation.toFixed(3),trace:filtered.slice(-300)};
  }
  function roi(data){
    if(!data?.length||data.length%4)throw Error('ROI kosong');
    let sum=0,clipped=0;
    for(let i=0;i<data.length;i+=4){const y=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];sum+=y;if(y<=5||y>=250)clipped++;}
    return {y:sum/(data.length/4),clipped:clipped/(data.length/4)};
  }
  return {analyze,roi};
});

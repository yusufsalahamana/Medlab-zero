/* Linked motor-task statistics. Exploratory within-browser comparisons, no diagnosis. */
(function(root,factory){
  const math=typeof module!=='undefined'&&module.exports?require('./analysis.js'):root.MedMath;
  const api=factory(math);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.MedReflex=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(math){
  'use strict';
  const ORDER=['reaction','tapping','tremor'],PROTOCOL=1;
  const FIELDS={reaction:['trials','medianMs','minimumMs','madMs','falseStarts'],tapping:['taps','seconds','tapsPerSec','medianIntervalMs','intervalCv'],tremor:['sampleCount','sampleRateHz','durationSec','rmsMps2','dominantHz','dominantAmplitudeMps2','axis']};
  const FEATURES=[{key:'reactionMedianMs',type:'reaction',metric:'medianMs',label:'Latensi sentuh aplikasi',unit:'ms',floor:8},{key:'tappingTapsPerSec',type:'tapping',metric:'tapsPerSec',label:'Ketukan/detik',unit:'ketuk/dtk',floor:.1},{key:'motionRmsMps2',type:'tremor',metric:'rmsMps2',label:'RMS gerak dinamis',unit:'m/s²',floor:.01}];
  const fail=reason=>({valid:false,reason,session:null});
  function motionQuality(samples,missing=0,sources=[]){
    if(!Array.isArray(samples)||!samples.length||samples.some((s,i)=>!s||![s.t,s.x,s.y,s.z].every(Number.isFinite)||(i&&s.t<=samples[i-1].t)))return {valid:false,reason:'Timestamp/sampel gerak tidak valid.'};
    if(!Number.isFinite(missing)||missing<0||missing/(missing+samples.length)>.05||!Array.isArray(sources)||sources.length!==1)return {valid:false,reason:'Sampel gerak hilang atau sumber akselerasi berganti.'};
    const gaps=samples.slice(1).map((s,i)=>s.t-samples[i].t),avg=math.mean(gaps);
    if(!avg||Math.max(...gaps)>250||math.std(gaps)/avg>.35)return {valid:false,reason:'Timing sensor gerak tidak stabil.'};
    return {valid:true,reason:'QC timing/source dasar lolos; bukan validasi sensor.'};
  }
  function make(stages,context){
    if(!context||!['right','left'].includes(context.hand)||context.posture!=='seated-supported'||typeof context.deviceKey!=='string'||!context.deviceKey.trim())return fail('Konteks HP/tangan/posisi belum lengkap.');
    if(!Array.isArray(stages)||stages.length!==3||!stages[0]||!stages[1]||!stages[2])return fail('Ketiga tahap belum lengkap.');
    for(let i=0;i<3;i++){
      const s=stages[i],m=s?.metrics;
      if(!s||s.type!==ORDER[i]||s.valid!==true||s.qc?.valid!==true||!m)return fail('Urutan/tahap belum lengkap atau gagal QC.');
      if(![s.startedAt,s.endedAt,s.durationMs].every(Number.isFinite)||s.startedAt<=0||s.endedAt<s.startedAt||s.durationMs<=0||Math.abs(s.endedAt-s.startedAt-s.durationMs)>1000||(i&&s.startedAt<stages[i-1].endedAt)||stages[2].endedAt-stages[0].startedAt>300000)return fail('Timing sesi tidak konsisten atau sesi melewati 5 menit.');
      // Bounds apply to actual capture time, not time waiting on the inter-stage screen.
      if(s.deviceKey!==context.deviceKey)return fail('HP/browser/ukuran layar berubah selama sesi.');
      if(s.type==='reaction'&&(m.trials!==5||!Number.isFinite(m.medianMs)||m.medianMs<100||m.medianMs>3000||s.durationMs<1000||s.durationMs>180000))return fail('Lima percobaan reaksi valid belum lengkap.');
      if(s.type==='tapping'&&(!Number.isInteger(m.taps)||m.taps<3||m.seconds!==15||!Number.isFinite(m.tapsPerSec)||m.tapsPerSec<=0||s.durationMs<14900||s.durationMs>20000))return fail('Ketukan/durasi belum valid.');
      if(s.type!=='tremor'&&!['pointer','keyboard'].includes(s.qc.source))return fail('Metode input sentuh tidak konsisten.');
      if(s.type==='tremor'&&(!['acceleration','includes-gravity'].includes(s.qc.source)||!Number.isInteger(m.sampleCount)||m.sampleCount<160||!Number.isFinite(m.sampleRateHz)||m.sampleRateHz<28||!Number.isFinite(m.durationSec)||m.durationSec<8||!Number.isFinite(m.rmsMps2)||m.rmsMps2<0||s.durationMs<8000||s.durationMs>16000))return fail('Gerak/durasi/sumber sensor belum valid.');
    }
    if(stages[0].qc.source!==stages[1].qc.source)return fail('Reaksi dan ketukan harus memakai metode input yang sama.');
    const clean=stages.map(s=>({type:s.type,startedAt:s.startedAt,endedAt:s.endedAt,durationMs:s.durationMs,qc:{valid:true,source:s.qc.source,missingSamples:s.type==='tremor'?s.qc.missingSamples||0:0},metrics:Object.fromEntries(FIELDS[s.type].filter(k=>Number.isFinite(s.metrics[k])||s.metrics[k]===null).map(k=>[k,s.metrics[k]]))}));
    return {valid:true,reason:'Ketiga tahap lengkap dan lolos QC dasar.',session:{protocol:PROTOCOL,order:ORDER.join('>'),context:{hand:context.hand,posture:context.posture,deviceKey:context.deviceKey},startedAt:stages[0].startedAt,endedAt:stages[2].endedAt,stages:clean}};
  }
  function usable(session){
    if(!session||session.protocol!==PROTOCOL||session.order!==ORDER.join('>')||!Array.isArray(session.stages))return false;
    const stages=session.stages?.map(s=>({...s,valid:true,deviceKey:session.context?.deviceKey}));
    const rebuilt=make(stages,session.context);
    return rebuilt.valid&&rebuilt.session.startedAt===session.startedAt&&rebuilt.session.endedAt===session.endedAt;
  }
  function signature(session){return JSON.stringify([session.protocol,session.order,session.context.deviceKey,session.context.hand,session.context.posture,...session.stages.map(s=>s.qc.source)]);}
  function metrics(session){return Object.fromEntries(FEATURES.map(f=>[f.key,session.stages.find(s=>s.type===f.type).metrics[f.metric]]));}
  function hasReference(rows){
    const groups=new Map(),ids=new Set();
    for(const r of rows){if(!r||r.type!=='reflex'||!r.valid||typeof r.id!=='string'||ids.has(r.id)||!Number.isFinite(r.ts)||!usable(r.reflex)||r.ts<r.reflex.endedAt)continue;
      ids.add(r.id);const key=signature(r.reflex);groups.set(key,(groups.get(key)||0)+1);
    }
    return [...groups.values()].some(n=>n>=5);
  }
  function compare(rows,current){
    if(!usable(current?.reflex)||!Number.isFinite(current.ts)||current.ts<current.reflex.endedAt)return {ready:false,count:0,reason:'Sesi lengkap yang valid diperlukan.',features:[]};
    const ids=new Set(),target=signature(current.reflex);
    const eligible=rows.filter(r=>r&&r.type==='reflex'&&r.valid&&typeof r.id==='string'&&r.id!==current.id&&Number.isFinite(r.ts)&&r.ts<current.ts&&r.ts>=r.reflex?.endedAt&&r.reflex?.endedAt<=current.reflex.startedAt&&usable(r.reflex)&&signature(r.reflex)===target)
      .sort((a,b)=>a.ts-b.ts).filter(r=>{if(ids.has(r.id))return false;ids.add(r.id);return true;}).slice(-20);
    if(eligible.length<5)return {ready:false,count:eligible.length,reason:`Data tidak mencukupi: ${eligible.length}/5 sesi terdahulu sebanding.`,features:[]};
    const values=metrics(current.reflex);
    return {ready:true,count:eligible.length,features:FEATURES.map(f=>{
      const xs=eligible.map(r=>metrics(r.reflex)[f.key]),center=math.median(xs),mad=math.mad(xs),spread=Math.max(mad*1.4826,f.floor,Math.abs(center)*.05);
      return {...f,value:values[f.key],center,mad,spread,low:Math.max(0,center-2.5*spread),high:center+2.5*spread,z:(values[f.key]-center)/spread};
    })};
  }
  return {make,usable,metrics,compare,hasReference,motionQuality};
});

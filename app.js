/* MED-LAB ZERO — vanilla JS, browser-only, local data. No clinical diagnostic logic. */
(() => {
  'use strict';
  const STORAGE='medlabzero.sessions.v1';
  const $=id=>document.getElementById(id);
  const labels={reaction:'Reaction Time',tapping:'Finger Tapping',tremor:'Motion Lab',pulse:'Camera Pulse Lab',reflex:'ReflexPrint'};
  const primary={reaction:'medianMs',tapping:'tapsPerSec',tremor:'rmsMps2'};
  const fmt=(x,n=1)=>Number.isFinite(x)?Number(x).toFixed(n):'—';
  const state={run:null, timers:[],motionListener:null,lastRaw:null,camera:null,guided:null};
  let history=[];
  try { history=JSON.parse(localStorage.getItem(STORAGE)||'[]'); if(!Array.isArray(history))history=[]; }
  catch(err) { history=[]; }
  function setStatus(message){$('status').textContent=message;}
  function later(fn,ms){const t=setTimeout(fn,ms);state.timers.push(t);return t;}
  function repeat(fn,ms){const t=setInterval(fn,ms);state.timers.push({interval:t});return t;}
  function clearTimers(){for(const t of state.timers){if(typeof t==='object')clearInterval(t.interval);else clearTimeout(t);}state.timers=[];}
  function tearDown(){if(state.camera)state.camera.stop();state.camera=null;clearTimers();if(state.motionListener)window.removeEventListener('devicemotion',state.motionListener);state.motionListener=null;state.run=null;state.guided=null;state.lastRaw=null;}
  function setHTML(node,html){node.innerHTML=html;}
  function metric(k,v){return `<div class="metric"><span>${v}</span><small>${k}</small></div>`;}
  function showPanel(name){document.querySelectorAll('.panel').forEach(el=>el.classList.toggle('active',el.id===name));document.querySelectorAll('.tab').forEach(el=>{const active=el.dataset.panel===name;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('workspace').classList.add('hidden');tearDown();if(name==='history')renderHistory();}
  function open(type){showPanel('experiments');$('workspace').classList.remove('hidden');$('exp-label').textContent=type.toUpperCase()+(type==='pulse'?' · M1 EKSPERIMENTAL':type==='reflex'?' · M2 EKSPERIMENTAL':' · V0.1');$('workspace-title').textContent=labels[type];$('workspace-results').classList.add('hidden');$('workspace-results').replaceChildren();$('workspace-content').replaceChildren();state.lastRaw=null;
    const text={reaction:'Selesaikan lima percobaan. Sentuh hanya ketika bidang berubah hijau. Jangan mencoba memprediksi waktunya.',tapping:'Letakkan HP di meja. Ketuk bidang dengan satu jari selama 15 detik sejak tombol mulai ditekan.',tremor:'Pegang HP secara konsisten sambil duduk dengan lengan ditopang. Rekam percepatan selama 12 detik tanpa melakukan gerakan yang dipaksakan.',reflex:'Satu sesi terpandu sekitar 1–2 menit, maksimum 5 menit: Reaksi → Ketukan → Gerak. Lengkapi semua tahap; sesi terputus tidak disimpan. Ini pola tugas motorik, bukan tes kesehatan.',pulse:'Tutupi kamera belakang dengan ujung jari secara lembut, jangan ditekan kuat. Duduk tenang selama 25 detik. Jika lampu terasa panas, batalkan. Gelombang dan kandidat optik belum tervalidasi sebagai denyut jantung.'};$('workspace-instruction').textContent=text[type];setStatus('Siap memulai.');if(type==='reaction')initReaction();if(type==='tapping')initTapping();if(type==='tremor')initTremor();if(type==='pulse')initPulse();if(type==='reflex')initReflex();$('workspace').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function save(type,metrics,valid=true,quality='OK'){
    // Keep the preview trace in memory; persist/export summary metrics only.
    const {trace,...summary}=metrics;
    const record={id:String(Date.now())+'-'+Math.floor(Math.random()*1e5),ts:Date.now(),type,valid,quality,metrics:summary};
    return persist(record);
  }
  function persist(record){
    const nextHistory=history.concat(record).slice(-500);
    try{localStorage.setItem(STORAGE,JSON.stringify(nextHistory));}catch(err){return false;}
    history=nextHistory;renderSummary();return true;
  }
  function report(type,values,opts={}) {
    if(state.guided){finishGuided(type,values,opts);return;}
    const panel=$('workspace-results');panel.classList.remove('hidden');
    const valid=opts.valid!==false, msg=opts.msg||'';
    const old=history.slice();const persisted=valid?save(type,values,true,opts.quality||'OK'):false;
    const base=MedMath.baseline(old,type,primary[type]);
    const score=MedMath.compare(values[primary[type]],base);
    let parts=[];
    if(type==='reaction')parts=[metric('Median reaksi',fmt(values.medianMs,0)+' ms'),metric('MAD',fmt(values.madMs,0)+' ms'),metric('Percobaan valid',values.trials),metric('Terlalu cepat',values.falseStarts)];
    if(type==='tapping')parts=[metric('Total ketukan',values.taps),metric('Ketukan/detik',fmt(values.tapsPerSec,2)),metric('Median interval',fmt(values.medianIntervalMs,0)+' ms'),metric('Variabilitas interval (CV)',values.intervalCv===null?'—':fmt(values.intervalCv,2))];
    if(type==='tremor')parts=[metric('RMS percepatan dinamis',fmt(values.rmsMps2,3)+' m/s²'),metric('Puncak frekuensi 3–12 Hz',values.dominantHz?fmt(values.dominantHz,2)+' Hz':'Tak terbaca'),metric('Laju sampel',fmt(values.sampleRateHz,1)+' Hz'),metric('Jumlah sampel',values.sampleCount??'—')];
    setHTML(panel,`<h3>Hasil eksperimen</h3><div class="stats">${parts.join('')}</div>`);
    const quality=document.createElement('div');quality.className=valid?'flag good':'flag';quality.textContent=valid?'Lulus pemeriksaan kualitas dasar. Ini bukan validasi klinis.':'Data tidak disimpan sebagai pengukuran valid. '+msg;panel.appendChild(quality);
    if(valid){const b=document.createElement('div');b.className='flag';
      if(!base.ready)b.textContent=`Baseline belum tersedia: ${base.count}/5 sesi terdahulu valid. Lakukan pengukuran di kondisi yang konsisten.`;
      else b.textContent=`Baseline pribadi (${base.count} sesi terdahulu): median ${fmt(base.center,3)}. Perbedaan robust z = ${fmt(score,2)}. ${Math.abs(score)>2.5?'Hasil berbeda secara statistik; cek teknik pengukuran, bukan diagnosis.':'Belum ada perbedaan statistik besar menurut ambang eksplorasi.'}`;
      panel.appendChild(b);
    }
    if(msg&&valid){const p=document.createElement('p');p.textContent=msg;panel.appendChild(p);}
    if(type==='tremor'&&state.lastRaw?.length){const canvas=document.createElement('canvas');canvas.width=650;canvas.height=150;canvas.className='chart';canvas.setAttribute('aria-label','Sampel akselerasi dinamis awal');panel.appendChild(canvas);plot(canvas,values.trace||[]);}
    setStatus(valid?(persisted?'Selesai. Ringkasan tersimpan lokal.':'Hasil tampil, tetapi browser gagal menyimpan ke penyimpanan lokal. Hasil ini tidak masuk riwayat, baseline, atau ekspor. Catat hasil sebelum menutup eksperimen.'):'Pengujian belum valid. Ulangi bila diperlukan.');
  }
  function plot(canvas,arr){const ctx=canvas.getContext('2d');const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#e3ede7';ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();if(!arr.length)return;const max=Math.max(.01,...arr.map(Math.abs));ctx.strokeStyle='#167b66';ctx.lineWidth=2;ctx.beginPath();arr.forEach((v,i)=>{const x=i/(arr.length-1||1)*w,y=h/2-v/max*(h*.4);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
  function initReaction(){
    const content=$('workspace-content');setHTML(content,'<button class="action" id="reaction-start">Mulai 5 percobaan</button><div id="reaction-target" class="target hidden" role="button" tabindex="0">Bersiap</div><p class="subdued" id="reaction-progress"></p>');
    const target=$('reaction-target'),progress=$('reaction-progress');const run={type:'reaction',inputModes:new Set(),trials:[],falseStarts:0,phase:'idle',presentedAt:0};state.run=run;
    $('reaction-start').addEventListener('click',()=>{if(state.run!==run||run.phase!=='idle')return;beginGuidedStage(run);$('reaction-start').classList.add('hidden');target.classList.remove('hidden');arm(); });
    function arm(){if(state.run!==run)return;if(run.trials.length>=5){run.phase='done';target.className='target finished';target.textContent='Selesai ✓';progress.textContent='5/5 percobaan';report('reaction',MedMath.reaction(run.trials,run.falseStarts));return;}
      run.presentedAt=0;run.phase='waiting';target.className='target waiting';target.textContent='TUNGGU…';progress.textContent=`Percobaan ${run.trials.length+1}/5 · sentuhan terlalu cepat: ${run.falseStarts}`;
      later(()=>{if(state.run!==run||run.phase!=='waiting')return;target.className='target ready';target.textContent='SENTUH SEKARANG';requestAnimationFrame(()=>{if(state.run!==run||run.phase!=='waiting')return;run.presentedAt=performance.now();run.phase='ready';});},1400+Math.random()*2100);
    }
    function hit(event){event.preventDefault();if(state.run!==run)return;if(['waiting','ready'].includes(run.phase))run.inputModes.add(event.type==='keydown'?'keyboard':'pointer');if(run.phase==='waiting'){run.falseStarts++;run.phase='penalty';clearTimers();target.className='target waiting';target.textContent='Terlalu cepat';later(arm,950);}
      else if(run.phase==='ready'&&run.presentedAt){const elapsed=performance.now()-run.presentedAt;run.phase='feedback';if(elapsed>=100&&elapsed<=3000)run.trials.push(elapsed);else run.falseStarts++;target.className='target finished';target.textContent=elapsed>=100&&elapsed<=3000?`${Math.round(elapsed)} ms`:'Tidak valid';later(arm,750);}}
    target.addEventListener('pointerdown',hit);target.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){hit(e);}});
  }
  function initTapping(){const content=$('workspace-content');setHTML(content,'<button class="action" id="tapping-start">Mulai tes 15 detik</button><div id="tap-timer" class="timer">15.0</div><div id="tap-area" class="target hidden" role="button" tabindex="0">KETUK DI SINI<br>0</div>');
    const run={type:'tapping',inputModes:new Set(),stamps:[],start:0,done:false};state.run=run;const tap=$('tap-area'),time=$('tap-timer');
    $('tapping-start').addEventListener('click',()=>{if(state.run!==run)return;$('tapping-start').classList.add('hidden');tap.classList.remove('hidden');run.start=performance.now();beginGuidedStage(run);setStatus('Pengukuran berjalan. Ketuk satu jari.');repeat(()=>{const elapsed=performance.now()-run.start;time.textContent=fmt(Math.max(0,15-elapsed/1000),1);if(elapsed>=15000)finish();},40);later(finish,15040);});
    function hit(e){e.preventDefault();if(state.run!==run||!run.start||run.done)return;const now=performance.now();if(now-run.start>=15000){finish();return;}run.inputModes.add(e.type==='keydown'?'keyboard':'pointer');run.stamps.push(now);tap.textContent='KETUK DI SINI · '+run.stamps.length;}
    function finish(){if(state.run!==run||run.done||!run.start)return;run.done=true;clearTimers();tap.className='target finished';tap.textContent='Selesai ✓';time.textContent='0.0';report('tapping',MedMath.tapping(run.stamps,15000),{valid:run.stamps.length>=3,msg:'Lakukan setidaknya tiga ketukan untuk perhitungan interval.'});}
    tap.addEventListener('pointerdown',hit);tap.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')hit(e);});
  }
  function initTremor(){const content=$('workspace-content');setHTML(content,'<button class="action" id="motion-start">Izinkan sensor & mulai 12 detik</button><div class="timer" id="motion-timer">12.0</div><div class="target" id="motion-target">Sensor menunggu izin</div><p class="subdued" id="motion-progress"></p>');
    const run={type:'tremor',sources:new Set(),missing:0,samples:[],start:0,done:false};state.run=run;
    $('motion-start').addEventListener('click',async()=>{if(state.run!==run)return;const button=$('motion-start');button.disabled=true;
      if(!window.isSecureContext){setStatus('Sensor gerak memerlukan konteks aman. Buka aplikasi melalui hosting HTTPS yang disetujui; file lokal hanya mendukung tes reaksi dan ketukan.');button.disabled=false;return;}
      if(typeof DeviceMotionEvent==='undefined'){setStatus('Browser ini tidak menyediakan DeviceMotionEvent.');return;}
      try {if(typeof DeviceMotionEvent.requestPermission==='function'){const permission=await DeviceMotionEvent.requestPermission();if(permission!=='granted')throw Error('Akses sensor tidak diizinkan.');}}
      catch(e){if(state.run!==run)return;setStatus('Akses sensor gagal: '+e.message);button.disabled=false;return;}
      if(state.run!==run)return;
      $('motion-target').textContent='Rekam…';run.start=performance.now();beginGuidedStage(run);let lastMissing=0;
      state.motionListener=e=>{if(state.run!==run||run.done)return;const good=a=>a&&[a.x,a.y,a.z].every(Number.isFinite);const a=good(e.acceleration)?e.acceleration:e.accelerationIncludingGravity;if(!good(a)){lastMissing++;run.missing++;return;}run.sources.add(good(e.acceleration)?'acceleration':'includes-gravity');const t=performance.now();run.samples.push({t,x:a.x,y:a.y,z:a.z});if(run.samples.length>5000)run.samples.shift();};
      window.addEventListener('devicemotion',state.motionListener);
      repeat(()=>{const elapsed=performance.now()-run.start;$('motion-timer').textContent=fmt(Math.max(0,12-elapsed/1000),1);$('motion-progress').textContent=`${run.samples.length} sampel · ${lastMissing} tidak terbaca`;if(elapsed>=12000)finish();},90);
      later(()=>{if(!run.samples.length&&!run.done)setStatus('Belum ada sampel sensor. Periksa izin gerak di browser / Android.');},2600);
      later(finish,12040);
      function finish(){if(state.run!==run||run.done)return;run.done=true;clearTimers();window.removeEventListener('devicemotion',state.motionListener);state.motionListener=null;$('motion-timer').textContent='0.0';$('motion-target').className='target finished';$('motion-target').textContent='Selesai ✓';const result=MedMath.tremor(run.samples);state.lastRaw=run.samples;report('tremor',result,{valid:result.valid,msg:result.reason||'Frekuensi dominan adalah fitur spektral, bukan diagnosis tremor.'});}
    });
  }
  function deviceKey(){return JSON.stringify([navigator.userAgent||'unavailable',window.screen?.width||0,window.screen?.height||0,window.devicePixelRatio||1]);}
  function initReflex(){
    setHTML($('workspace-content'),'<p>Gunakan HP/browser, tangan dan posisi yang sama pada sesi lanjutan. Reaksi & ketukan: HP di meja. Gerak: duduk, lengan ditopang, pegang HP stabil tanpa gerakan yang dipaksakan.</p><label for="reflex-hand">Tangan yang digunakan</label><select id="reflex-hand"><option value="">Pilih tangan</option><option value="right">Kanan</option><option value="left">Kiri</option></select><label class="reflex-confirm"><input type="checkbox" id="reflex-context"> Saya menggunakan HP dan posisi yang sama untuk perbandingan sesi.</label><button class="action" id="reflex-start">Mulai sesi terpandu</button>');
    const setup={type:'reflex'};state.run=setup;
    $('reflex-start').addEventListener('click',()=>{
      if(state.run!==setup)return;
      const hand=$('reflex-hand').value;
      if(!['left','right'].includes(hand)||!$('reflex-context').checked){setStatus('Pilih tangan dan konfirmasi HP/posisi yang digunakan.');return;}
      state.guided={context:{hand,posture:'seated-supported',deviceKey:deviceKey()},stages:[],index:0};
      guidedStage();
    });
  }
  function guidedStage(){
    clearTimers();if(state.motionListener)window.removeEventListener('devicemotion',state.motionListener);state.motionListener=null;state.lastRaw=null;
    const g=state.guided,type=['reaction','tapping','tremor'][g.index];
    $('workspace-results').replaceChildren();$('workspace-results').classList.add('hidden');
    $('workspace-instruction').textContent=`ReflexPrint · tahap ${g.index+1}/3: ${labels[type]}. ${type==='tremor'?'Duduk dengan lengan ditopang, pegang HP stabil.':'Letakkan HP di meja; gunakan tangan yang dipilih.'} Tutup/buka menu lain untuk membatalkan seluruh sesi.`;
    setStatus('Siap. Tahap sementara tidak masuk riwayat.');
    ({reaction:initReaction,tapping:initTapping,tremor:initTremor})[type]();
  }
  function beginGuidedStage(run){if(state.guided)run.capture={startedAt:Date.now(),startPerf:performance.now(),deviceKey:deviceKey()};}
  function finishGuided(type,values,opts){
    const g=state.guided,run=state.run;if(!g||!run?.capture)return;
    const capture=run.capture,source=type==='tremor'?[...run.sources]:[...run.inputModes];
    const qc=type==='tremor'?MedReflex.motionQuality(run.samples,run.missing,source):{valid:source.length===1,reason:'Metode input berubah.'};
    const stage={type,valid:opts.valid!==false&&qc.valid,deviceKey:capture.deviceKey===deviceKey()?capture.deviceKey:'changed-during-capture',startedAt:capture.startedAt,endedAt:Date.now(),durationMs:performance.now()-capture.startPerf,qc:{valid:qc.valid,source:source[0],missingSamples:run.missing||0},metrics:values};
    // Raw values live only long enough for QC. Intermediate stages use an allowlisted summary.
    const {trace,...summary}=values;stage.metrics=summary;state.lastRaw=null;if(type==='tremor')run.samples=[];
    if(!stage.valid){g.stages=[];state.guided=null;$('workspace-content').replaceChildren();setStatus('Sesi ReflexPrint tidak lengkap/valid; tidak disimpan. '+(opts.msg||qc.reason||'Ulangi dari awal.'));return;}
    g.stages.push(stage);
    if(g.index<2){
      const next=document.createElement('button');next.id='reflex-next';next.className='action';next.textContent='Tahap '+(g.index+1)+' lolos QC dasar · lanjut '+labels[['reaction','tapping','tremor'][g.index+1]];
      $('workspace-content').replaceChildren(next);setStatus('Belum disimpan: lanjutkan sampai ketiga tahap valid.');
      const completed=g.index;next.addEventListener('click',()=>{if(state.guided!==g||g.index!==completed)return;g.index++;guidedStage();});return;
    }
    const linked=MedReflex.make(g.stages,g.context);g.stages=[];state.guided=null;$('workspace-content').replaceChildren();
    if(!linked.valid){setStatus('ReflexPrint tidak disimpan: '+linked.reason);return;}
    const record={id:String(Date.now())+'-'+Math.floor(Math.random()*1e5),ts:Date.now(),type:'reflex',valid:true,quality:'Linked QC v1; research only',metrics:MedReflex.metrics(linked.session),reflex:linked.session};
    const comparison=MedReflex.compare(history,record),panel=$('workspace-results');panel.classList.remove('hidden');
    const title=document.createElement('h3');title.textContent='ReflexPrint · tiga tahap lengkap';panel.appendChild(title);
    const detail=document.createElement('p');detail.textContent=`Latensi sentuh aplikasi ${fmt(record.metrics.reactionMedianMs,0)} ms · ketukan ${fmt(record.metrics.tappingTapsPerSec,2)}/dtk · RMS gerak ${fmt(record.metrics.motionRmsMps2,3)} m/s². QC dasar bukan validasi sensor atau pengukuran saraf.`;panel.appendChild(detail);
    const baseline=document.createElement('div');baseline.className='flag';
    baseline.textContent=comparison.ready?`Perbandingan ${comparison.count} sesi terdahulu sebanding (maksimum 20). Rentang eksploratif = median ±2,5 × maks(1,4826 MAD, floor). Bukan rentang sehat/sakit.`:comparison.reason+' Sesi tunggal dan konteks lain tidak digabung.';panel.appendChild(baseline);
    for(const f of comparison.features){const line=document.createElement('p');line.textContent=`${f.label}: ${fmt(f.value,3)} ${f.unit}; median ${fmt(f.center,3)}, MAD ${fmt(f.mad,3)}, spread ${fmt(f.spread,3)}; rentang ${fmt(f.low,3)}–${fmt(f.high,3)}; deviasi standar robust ${fmt(f.z,2)}. ${Math.abs(f.z)>2.5?'Berbeda dari pola terdahulu; cek teknik pengukuran.':'Dalam rentang eksploratif terdahulu.'} Bukan diagnosis.`;panel.appendChild(line);}
    const retry=document.createElement('button');retry.className='outline';retry.id='reflex-save-retry';retry.textContent='Coba simpan ulang';
    let persisted=false;function commit(){if(state.run!==run||persisted)return;persisted=persist(record);retry.disabled=persisted;setStatus(persisted?'ReflexPrint selesai. Satu sesi lengkap tersimpan lokal.':'Browser gagal menyimpan ReflexPrint. Hasil sementara tidak masuk riwayat, baseline atau ekspor; coba simpan ulang sebelum menutup.');if(!persisted&&!panel.contains?.(retry))panel.appendChild(retry);}
    retry.addEventListener('click',commit);commit();
  }
  function initPulse(){
    setHTML($('workspace-content'),'<button class="action" id="camera-start">Izinkan kamera & rekam 25 detik</button><button class="outline" id="camera-cancel">Batalkan kamera</button><div class="timer" id="camera-timer">25.0</div><video id="camera-video" class="camera-preview" muted playsinline aria-label="Pratinjau kamera lokal"></video><canvas id="camera-roi" width="32" height="32" hidden></canvas><p id="camera-progress" class="subdued"></p><p class="subdued">Frame dan gelombang hanya di memori; tidak masuk riwayat, baseline, ekspor, atau unggahan. Dukungan kamera/lampu dan akurasi Android belum diuji.</p>');
    const run={type:'pulse',busy:false};state.run=run;
    const start=$('camera-start');
    const capture=new MedCamera.Capture({video:$('camera-video'),canvas:$('camera-roi'),media:navigator.mediaDevices,secure:window.isSecureContext,pulse:MedPulse});
    state.camera=capture;
    function cancel(){capture.stop();run.busy=false;start.disabled=false;$('camera-timer').textContent='25.0';$('camera-progress').textContent='';$('workspace-results').replaceChildren();$('workspace-results').classList.add('hidden');setStatus('Kamera dibatalkan. Data tidak disimpan.');}
    $('camera-cancel').addEventListener('click',()=>{if(state.run===run)cancel();});
    start.addEventListener('click',()=>{
      if(state.run!==run||run.busy)return;
      run.busy=true;start.disabled=true;$('workspace-results').replaceChildren();$('workspace-results').classList.add('hidden');$('camera-timer').textContent='25.0';$('camera-progress').textContent='';
      capture.start({
        status:message=>{if(state.run!==run)return;setStatus(message);if(!capture.stream&&!message.startsWith('Meminta')){run.busy=false;start.disabled=false;}},
        progress:(elapsed,count)=>{if(state.run!==run)return;$('camera-timer').textContent=fmt(25-elapsed,1);$('camera-progress').textContent=count+' frame unik · tetap tenang';},
        result:answer=>{if(state.run!==run)return;run.busy=false;start.disabled=false;$('camera-timer').textContent='0.0';
          const panel=$('workspace-results');panel.classList.remove('hidden');
          const title=document.createElement('h3');title.textContent=answer.valid?'Experimental candidate pulse':'Data tidak mencukupi';panel.appendChild(title);
          const detail=document.createElement('p');detail.textContent=answer.valid?fmt(answer.candidateBpm,1)+' kandidat/menit · pola optik 45–180/menit; bukan nilai medis atau denyut tervalidasi.':answer.reason;panel.appendChild(detail);
          if(answer.valid){const canvas=document.createElement('canvas');canvas.width=650;canvas.height=150;canvas.className='chart';canvas.setAttribute('aria-label','Gelombang optik terfilter, skala relatif');panel.appendChild(canvas);plot(canvas,answer.trace);}
          const note=document.createElement('p');note.textContent='QC hanya menguji kualitas dan keterulangan optik. Gerakan/pencahayaan periodik dapat menyerupai denyut. Tidak untuk diagnosis, keputusan klinis, atau kepastian kesehatan. Hasil tidak disimpan.';panel.appendChild(note);
          setStatus(answer.valid?'Selesai. Kandidat optik hanya tampil sementara; tidak disimpan.':'Data tidak mencukupi. Tidak ada kandidat denyut; tidak disimpan.');
        }
      });
    });
  }
  function download(name,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function exportJSON(){download('medlab-zero-history.json',JSON.stringify({schema:1,generated:new Date().toISOString(),sessions:history},null,2),'application/json');}
  function escapeCSV(v){const value=String(v??'');return '"'+value.replace(/"/g,'""')+'"';}
  function exportCSV(){const keys=['timestamp','type','valid','quality','medianMs','madMs','falseStarts','taps','tapsPerSec','medianIntervalMs','intervalCv','sampleCount','sampleRateHz','rmsMps2','dominantHz','reactionMedianMs','tappingTapsPerSec','motionRmsMps2','protocol','hand','posture','deviceKey','order','sessionStartedAt','sessionEndedAt','reactionStartedAt','reactionEndedAt','reactionDurationMs','reactionSource','tappingStartedAt','tappingEndedAt','tappingDurationMs','tappingSource','motionStartedAt','motionEndedAt','motionDurationMs','motionSource','motionSampleCount','motionSampleRateHz','motionMissingSamples'];const lines=[keys.join(',')];for(const r of history){const values={timestamp:new Date(r.ts).toISOString(),type:r.type,valid:r.valid,quality:r.quality,...r.metrics};if(r.type==='reflex'&&MedReflex.usable(r.reflex)){const s=r.reflex;Object.assign(values,{protocol:s.protocol,...s.context,order:s.order,sessionStartedAt:s.startedAt,sessionEndedAt:s.endedAt});for(const stage of s.stages){const prefix=stage.type==='tremor'?'motion':stage.type;for(const [k,v] of Object.entries({StartedAt:stage.startedAt,EndedAt:stage.endedAt,DurationMs:stage.durationMs,Source:stage.qc.source}))values[prefix+k]=v;if(stage.type==='tremor')Object.assign(values,{motionSampleCount:stage.metrics.sampleCount,motionSampleRateHz:stage.metrics.sampleRateHz,motionMissingSamples:stage.qc.missingSamples});}}lines.push(keys.map(k=>escapeCSV(values[k])).join(','));}download('medlab-zero-history.csv',lines.join('\r\n'),'text/csv;charset=utf-8');}
  function renderSummary(){
    $('total-sessions').textContent=history.length;$('valid-sessions').textContent=history.filter(r=>r.valid).length;
    $('active-baselines').textContent=Object.keys(primary).filter(type=>MedMath.baseline(history,type,primary[type]).ready).length+(MedReflex.hasReference(history)?1:0);
  }
  function renderHistory(){const node=$('history-items');node.replaceChildren();if(!history.length){const p=document.createElement('div');p.className='empty';p.textContent='Belum ada sesi. Jalankan eksperimen pertama.';node.appendChild(p);return;}
    for(const r of history.slice(-60).reverse()){const div=document.createElement('div');div.className='hist';const v=r.metrics[primary[r.type]],unit=r.type==='reaction'?' ms':r.type==='tapping'?' ketuk/dtk':' m/s²';const title=document.createElement('div');title.className='hist-head';const name=document.createElement('span');name.className='hist-name';name.textContent=labels[r.type]||r.type;const date=document.createElement('span');date.className='hist-meta';date.textContent=new Date(r.ts).toLocaleString('id-ID');title.append(name,date);const number=document.createElement('div');number.className='hist-value';number.textContent=r.type==='reflex'?`Reaksi ${fmt(r.metrics.reactionMedianMs,0)} ms · ketukan ${fmt(r.metrics.tappingTapsPerSec,2)}/dtk · gerak ${fmt(r.metrics.motionRmsMps2,3)} m/s²`:fmt(v,r.type==='reaction'?0:r.type==='tapping'?2:3)+unit;const foot=document.createElement('div');foot.className='hist-foot';foot.textContent=r.type==='reflex'?'Sesi berantai lengkap · QC dasar · bukan diagnosis':r.valid?'Lulus QC dasar · bukan nilai medis':'Tidak valid';div.append(title,number,foot);node.appendChild(div);}
  }
  document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.panel)));
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.open)));
  $('close-exp').addEventListener('click',()=>showPanel('experiments'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.run){tearDown();setStatus('Eksperimen dibatalkan karena aplikasi masuk latar belakang. Buka kembali eksperimen untuk mengulang.');}});
  window.addEventListener('pagehide',tearDown);
  $('export-json').addEventListener('click',exportJSON);$('export-csv').addEventListener('click',exportCSV);
  $('delete-history').addEventListener('click',()=>{
    if(!confirm('Hapus seluruh riwayat dari browser ini? Tidak dapat dibatalkan.'))return;
    try{localStorage.removeItem(STORAGE);}catch(err){$('history-status').textContent='Gagal menghapus riwayat lokal. Data tetap tersimpan di browser ini. Coba lagi atau hapus data situs melalui pengaturan browser.';return;}
    history=[];renderSummary();renderHistory();$('history-status').textContent='Riwayat lokal sudah dihapus.';
  });
  renderSummary();renderHistory();
  $('offline-chip').textContent=navigator.onLine?'LOCAL ONLY':'OFFLINE MODE';
  window.addEventListener('online',()=>$('offline-chip').textContent='LOCAL ONLY');window.addEventListener('offline',()=>$('offline-chip').textContent='OFFLINE MODE');
  $('environment-status').textContent=`Konteks ${window.isSecureContext?'aman':'tidak aman'} · API gerak ${typeof DeviceMotionEvent==='undefined'?'tidak tersedia':'tersedia (sensor belum diuji)'}`;
  const pwa=$('pwa-status');
  if('serviceWorker' in navigator && window.isSecureContext && ['https:','http:'].includes(location.protocol)){
    pwa.textContent='Menyiapkan cache offline…';
    navigator.serviceWorker.register('./service-worker.js').then(()=>navigator.serviceWorker.ready).then(()=>{pwa.textContent='Cache aplikasi siap. Uji buka ulang tanpa jaringan; instalasi tetap perlu diperiksa di Chrome.';}).catch(()=>{pwa.textContent='Cache offline gagal disiapkan. Muat ulang saat server lokal/HTTPS berjalan.';});
  }else pwa.textContent='Cache offline tidak tersedia di konteks ini. Gunakan HTTPS atau server localhost di HP.';
})();

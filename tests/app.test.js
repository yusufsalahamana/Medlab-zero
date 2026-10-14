const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const MedMath=require('../analysis.js');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const KEY='medlabzero.sessions.v1';

// Deterministic DOM/event/timer harness. This is not a real browser/device test.
function app(options={}) {
  const nodes=new Map(), windowEvents=new Map(), documentEvents=new Map();
  const timers=new Map(), frames=[], blobs=[], data=new Map(Object.entries(options.storage||{}));
  let now=1000, nextTimer=0;
  class Element {
    constructor(id='',className='') {this.id=id;this.className=className;this.dataset={};this.children=[];this.events=new Map();this.textContent='';this.disabled=false;}
    get classList(){return {add:c=>this.toggle(c,true),remove:c=>this.toggle(c,false),toggle:(c,on)=>this.toggle(c,on)};}
    toggle(c,on){const set=new Set(this.className.split(/\s+/).filter(Boolean));on?set.add(c):set.delete(c);this.className=[...set].join(' ');}
    set innerHTML(value){this.html=value;parse(value);}
    get innerHTML(){return this.html||'';}
    addEventListener(type,fn){this.events.set(type,fn);}
    setAttribute(){} removeAttribute(){} scrollIntoView(){} remove(){}
    appendChild(e){this.children.push(e);if(e.id)nodes.set(e.id,e);return e;} append(...elements){this.children.push(...elements);}
    replaceChildren(...elements){this.children=elements;for(const e of elements)if(e.id)nodes.set(e.id,e);}
    contains(e){return this.children.includes(e);}
    click(){return this.events.get('click')?.({preventDefault(){}});}
    getContext(){return Object.fromEntries(['clearRect','beginPath','moveTo','lineTo','stroke'].map(k=>[k,()=>{}]));}
  }
  function parse(markup){for(const m of markup.matchAll(/<(\w+)([^>]*)>/g)){
    const attrs=Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]));
    if(!attrs.id&&!attrs['data-panel']&&!attrs['data-open'])continue;
    const e=new Element(attrs.id||'auto-'+nodes.size,attrs.class||'');
    if(attrs['data-panel'])e.dataset.panel=attrs['data-panel'];
    if(attrs['data-open'])e.dataset.open=attrs['data-open'];
    nodes.set(e.id,e);
  }}
  parse(html);
  const document={hidden:false,body:new Element(),getElementById:id=>nodes.get(id),createElement:()=>new Element(),
    querySelectorAll:selector=>[...nodes.values()].filter(e=>selector==='.panel'?e.className.split(' ').includes('panel'):selector==='.tab'?e.className.split(' ').includes('tab'):selector==='[data-panel]'?e.dataset.panel:selector==='[data-open]'?e.dataset.open:false),
    addEventListener:(name,fn)=>documentEvents.set(name,fn)};
  const window={screen:{width:412,height:915},devicePixelRatio:1,isSecureContext:options.secure!==false,addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener:(name,fn)=>{if(windowEvents.get(name)===fn)windowEvents.delete(name);}};
  function schedule(fn,ms,interval=false){const id=++nextTimer;timers.set(id,{fn,at:now+ms,interval:interval?ms:0});return id;}
  const navigator={onLine:true,userAgent:'Synthetic Browser',mediaDevices:options.media};if(options.serviceWorker)navigator.serviceWorker=options.serviceWorker;
  const context={document,window,navigator,location:{protocol:options.protocol||'https:'},MedMath,MedReflex:require('../reflex.js'),MedDeviceCheck:require('../device-check.js'),Date:class extends Date{static now(){return 100000+now;}},MedPulse:require('../pulse.js'),MedCamera:options.camera,
    Math:Object.assign(Object.create(Math),{random:()=>0}),performance:{now:()=>now},localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>{if(options.storageFails)throw Error('quota');data.set(k,v);},removeItem:k=>{if(options.deleteFails)throw Error('denied');data.delete(k);}},
    setTimeout:(fn,ms)=>schedule(fn,ms),setInterval:(fn,ms)=>schedule(fn,ms,true),clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id),
    requestAnimationFrame:fn=>frames.push(fn),Blob,URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:synthetic';},revokeObjectURL(){}},confirm:()=>options.confirmDelete!==false};
  if(options.motion!==undefined)context.DeviceMotionEvent=options.motion;
  vm.runInNewContext(source,context,{filename:'app.js'});
  function advance(ms){const end=now+ms;while(true){const entry=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;
    const [id,t]=entry;now=t.at;t.interval?t.at+=t.interval:timers.delete(id);t.fn();}now=end;}
  return {nodes,window,windowEvents,timers,frames,blobs,data,advance,
    sessions:()=>JSON.parse(data.get(KEY)||'[]'),
    open:type=>[...nodes.values()].find(e=>e.dataset.open===type).click(),
    click:id=>nodes.get(id).click(),
    hit:(id,type='pointerdown')=>nodes.get(id).events.get(type)?.({type,key:'Enter',preventDefault(){}}),
    frame:()=>{for(const fn of frames.splice(0))fn();},
    background:()=>{document.hidden=true;documentEvents.get('visibilitychange')?.();}};
}

test('reaction resets onset: a hit before the next animation frame is a false start',()=>{
  const a=app();a.open('reaction');a.click('reaction-start');
  a.advance(1400);a.frame();a.advance(250);a.hit('reaction-target');
  a.advance(2150); // Next stimulus timer fired; frame has not run.
  a.hit('reaction-target');a.frame();a.advance(2350);a.frame();
  a.advance(250);a.hit('reaction-target');
  for(let i=0;i<3;i++){a.advance(2150);a.frame();a.advance(250);a.hit('reaction-target');}
  a.advance(751);
  assert.equal(a.sessions().length,1);
  assert.equal(a.sessions()[0].metrics.trials,5);
  assert.equal(a.sessions()[0].metrics.falseStarts,1);
  assert.equal(a.sessions()[0].metrics.medianMs,250);
});

test('15-second tapping persists, reloads, exports JSON/CSV and deletes locally',async()=>{
  const a=app();a.open('tapping');a.click('tapping-start');
  for(let i=0;i<4;i++){a.advance(200);a.hit('tap-area');}
  a.advance(14200);a.hit('tap-area'); // Boundary hit must not count.
  assert.equal(a.sessions()[0].metrics.taps,4);
  const b=app({storage:Object.fromEntries(a.data)});
  assert.equal(b.nodes.get('total-sessions').textContent,1);
  b.click('export-json');b.click('export-csv');
  const json=JSON.parse(await b.blobs[0].text());
  assert.equal(json.sessions[0].metrics.taps,4);
  const csv=await b.blobs[1].text();assert.equal(csv.split('\r\n').length,2);assert.match(csv,/"tapping"/);
  b.click('delete-history');assert.deepEqual(b.sessions(),[]);
});

test('cancel or background an experiment: no saved result and no timer remains',()=>{
  for(const stop of ['close','background']){
    const a=app();a.open('tapping');a.click('tapping-start');a.advance(200);a.hit('tap-area');
    stop==='close'?a.click('close-exp'):a.background();a.advance(16000);a.hit('tap-area');a.click('tapping-start');
    assert.equal(a.timers.size,0);assert.deepEqual(a.sessions(),[]);
  }
});

test('failed save preserves persisted history, counters, baseline and exports; retry stores only the new session',async()=>{
  const prior=Array.from({length:4},(_,i)=>({id:'synthetic-'+i,ts:1000+i,type:'tapping',valid:true,quality:'OK',metrics:{taps:4,tapsPerSec:0.27}}));
  const options={storageFails:true,storage:{[KEY]:JSON.stringify(prior)}};
  const a=app(options);
  for(let attempt=0;attempt<2;attempt++){
    a.open('tapping');a.click('tapping-start');
    for(let i=0;i<3;i++){a.advance(200);a.hit('tap-area');}a.advance(15000);
    assert.match(a.nodes.get('status').textContent,/gagal menyimpan/);
    assert.deepEqual(a.sessions(),prior);
    assert.equal(a.nodes.get('total-sessions').textContent,4);
    assert.equal(a.nodes.get('valid-sessions').textContent,4);
    assert.equal(a.nodes.get('active-baselines').textContent,0);
    [...a.nodes.values()].find(e=>e.dataset.panel==='history').click();
    assert.equal(a.nodes.get('history-items').children.length,4);
  }
  a.click('export-json');a.click('export-csv');
  assert.deepEqual(JSON.parse(await a.blobs[0].text()).sessions,prior);
  assert.equal((await a.blobs[1].text()).split('\r\n').length,5);
  const reload=app({storage:Object.fromEntries(a.data)});
  assert.equal(reload.nodes.get('total-sessions').textContent,4);
  options.storageFails=false;
  a.open('tapping');a.click('tapping-start');
  for(let i=0;i<3;i++){a.advance(200);a.hit('tap-area');}a.advance(15000);
  assert.equal(a.sessions().length,5);assert.deepEqual(a.sessions().slice(0,4),prior);
  assert.equal(a.nodes.get('active-baselines').textContent,1);
  assert.match(a.nodes.get('status').textContent,/tersimpan lokal/);
});

test('failed deletion keeps stored and displayed history, reports failure in history panel, and can retry',async()=>{
  const prior=[{id:'synthetic-delete',ts:1000,type:'tapping',valid:true,quality:'OK',metrics:{taps:4,tapsPerSec:0.27}}];
  const options={deleteFails:true,storage:{[KEY]:JSON.stringify(prior)}};
  const a=app(options);[...a.nodes.values()].find(e=>e.dataset.panel==='history').click();
  assert.doesNotThrow(()=>a.click('delete-history'));
  assert.deepEqual(a.sessions(),prior);
  assert.equal(a.nodes.get('history-items').children.length,1);
  assert.equal(a.nodes.get('total-sessions').textContent,1);
  assert.match(a.nodes.get('history-status').textContent,/Gagal menghapus.*tetap tersimpan/);
  a.click('export-json');assert.deepEqual(JSON.parse(await a.blobs[0].text()).sessions,prior);
  const reload=app({storage:Object.fromEntries(a.data)});assert.equal(reload.nodes.get('total-sessions').textContent,1);
  options.deleteFails=false;a.click('delete-history');
  assert.deepEqual(a.sessions(),[]);assert.equal(a.data.has(KEY),false);
  assert.equal(a.nodes.get('total-sessions').textContent,0);
  assert.match(a.nodes.get('history-status').textContent,/sudah dihapus/);
  const empty=app({storage:Object.fromEntries(a.data)});assert.equal(empty.nodes.get('total-sessions').textContent,0);
});

test('canceling deletion preserves history without calling restricted storage',()=>{
  const prior=[{id:'synthetic-cancel',ts:1000,type:'tapping',valid:true,quality:'OK',metrics:{taps:4,tapsPerSec:0.27}}];
  const a=app({confirmDelete:false,deleteFails:true,storage:{[KEY]:JSON.stringify(prior)}});
  assert.doesNotThrow(()=>a.click('delete-history'));
  assert.deepEqual(a.sessions(),prior);assert.equal(a.nodes.get('total-sessions').textContent,1);
});

test('motion unavailable, insecure and denied paths never start capture',async()=>{
  for(const options of [{},{secure:false,motion:{}},{motion:{requestPermission:async()=> 'denied'}}]){
    const a=app(options);a.open('tremor');await a.click('motion-start');
    assert.equal(a.windowEvents.has('devicemotion'),false);assert.equal(a.timers.size,0);assert.deepEqual(a.sessions(),[]);
    assert.match(a.nodes.get('status').textContent,/tidak menyediakan|konteks aman|memerlukan HTTPS|Akses sensor gagal/);
  }
});

test('closing while motion permission is pending prevents a late capture',async()=>{
  let grant;const a=app({motion:{requestPermission:()=>new Promise(resolve=>{grant=resolve;})}});
  a.open('tremor');const pending=a.click('motion-start');a.click('close-exp');grant('granted');await pending;
  assert.equal(a.windowEvents.has('devicemotion'),false);assert.equal(a.timers.size,0);assert.deepEqual(a.sessions(),[]);
});

test('motion without samples is rejected; synthetic valid motion stores/exports no trace',async()=>{
  const empty=app({motion:{}});empty.open('tremor');await empty.click('motion-start');empty.advance(12100);
  assert.deepEqual(empty.sessions(),[]);assert.match(empty.nodes.get('status').textContent,/belum valid/);
  const a=app({motion:{requestPermission:async()=> 'granted'}});a.open('tremor');await a.click('motion-start');
  for(let i=0;i<600;i++){a.advance(20);a.windowEvents.get('devicemotion')?.({acceleration:{x:0.8*Math.sin(2*Math.PI*6*i/50),y:0,z:0}});}
  a.advance(100);assert.equal(a.windowEvents.has('devicemotion'),false);
  const record=a.sessions()[0];assert.equal(record.valid,true);assert.equal(record.metrics.dominantHz,6);
  assert.equal('trace' in record.metrics,false);assert.equal('samples' in record.metrics,false);
  a.click('export-json');assert.doesNotMatch(await a.blobs[0].text(),/"trace"|"samples"/);
});

test('PWA registers on secure HTTPS/loopback HTTP, but not file URLs or insecure HTTP',async()=>{
  for(const [protocol,secure,expected] of [['https:',true,1],['http:',true,1],['http:',false,0],['file:',true,0]]){
    let calls=0;
    const a=app({protocol,secure,serviceWorker:{register:async()=>{calls++;},ready:Promise.resolve({})}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,expected);
    assert.match(a.nodes.get('pwa-status').textContent,expected?/Worker aplikasi aktif/:/tidak tersedia/);
  }
});

test('PWA registration failure is visible and cannot claim offline readiness',async()=>{
  const a=app({serviceWorker:{register:async()=>{throw Error('blocked');}}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(a.nodes.get('pwa-status').textContent,/gagal disiapkan/);
});


test('camera UI candidate/rejection is transient; navigation and background stop capture',async()=>{
  for(const valid of [true,false]){
    let handlers,stops=0;
    const camera={Capture:class {constructor(){this.stream=null;}stop(){stops++;this.stream=null;}start(callbacks){handlers=callbacks;this.stream={};}}};
    const a=app({camera});a.open('pulse');a.click('camera-start');
    handlers.result({valid,candidateBpm:90,trace:[0,1,0,-1],reason:'Sinyal datar'});
    assert.equal(a.nodes.get('workspace-results').children[0].textContent,valid?'Experimental candidate pulse':'Data tidak mencukupi');
    assert.deepEqual(a.sessions(),[]);assert.equal(a.nodes.get('total-sessions').textContent,0);
    a.click('export-json');assert.deepEqual(JSON.parse(await a.blobs[0].text()).sessions,[]);
    a.click('camera-start');a.click('camera-cancel');assert.equal(stops,1);assert.match(a.nodes.get('status').textContent,/dibatalkan/);
    a.click('camera-start');a.background();assert.equal(stops,2);
    handlers.result({valid:true,candidateBpm:90,trace:[]});assert.deepEqual(a.sessions(),[]);
  }
});


function startReflex(a){a.open('reflex');a.nodes.get('reflex-hand').value='right';a.nodes.get('reflex-context').checked=true;a.click('reflex-start');}
function guidedReaction(a){a.click('reaction-start');for(let i=0;i<5;i++){a.advance(i?2150:1400);a.frame();a.advance(250);a.hit('reaction-target');}a.advance(751);}
function guidedTapping(a){a.click('reflex-next');a.click('tapping-start');for(let i=0;i<4;i++){a.advance(200);a.hit('tap-area');}a.advance(14240);}
async function guidedMotion(a,{empty=false,gap=false,mixed=false}={}){a.click('reflex-next');await a.click('motion-start');if(!empty)for(let i=0;i<600;i++){a.advance(20);if(gap&&i>250&&i<275)continue;const acceleration={x:.8*Math.sin(2*Math.PI*6*i/50),y:0,z:0};a.windowEvents.get('devicemotion')?.(mixed&&i%2?{accelerationIncludingGravity:acceleration}:{acceleration});}else a.advance(12000);a.advance(100);}

test('ReflexPrint stores one complete linked record; intermediate stages and raw motion never persist',async()=>{
  const a=app({motion:{}});startReflex(a);guidedReaction(a);assert.deepEqual(a.sessions(),[]);guidedTapping(a);assert.deepEqual(a.sessions(),[]);await guidedMotion(a);
  assert.equal(a.sessions().length,1);const r=a.sessions()[0];assert.equal(r.type,'reflex');assert.equal(require('../reflex.js').usable(r.reflex),true);assert.equal(r.reflex.stages.length,3);assert.equal(r.metrics.reactionMedianMs,250);assert.equal(r.metrics.tappingTapsPerSec,.27);assert.doesNotMatch(JSON.stringify(r),/"trace"|"samples"/);
  const b=app({storage:Object.fromEntries(a.data)});assert.equal(b.nodes.get('total-sessions').textContent,1);b.click('export-json');b.click('export-csv');const json=JSON.parse(await b.blobs[0].text());assert.equal(json.sessions[0].reflex.context.hand,'right');const csv=await b.blobs[1].text();assert.match(csv,/motionSource/);assert.match(csv,/"acceleration"/);assert.match(csv,/reaction>tapping>tremor/);assert.doesNotMatch(csv,/"trace"|"samples"/);
});
test('ReflexPrint close/background/panel switch/pagehide discard all partial data and listeners',async()=>{
  for(const mode of ['close','background','panel','pagehide']){const a=app({motion:{}});startReflex(a);guidedReaction(a);guidedTapping(a);a.click('reflex-next');await a.click('motion-start');a.advance(20);a.windowEvents.get('devicemotion')?.({acceleration:{x:1,y:0,z:0}});
    if(mode==='close')a.click('close-exp');if(mode==='background')a.background();if(mode==='panel')[...a.nodes.values()].find(e=>e.dataset.panel==='history').click();if(mode==='pagehide')a.windowEvents.get('pagehide')();a.advance(20000);
    assert.deepEqual(a.sessions(),[]);assert.equal(a.windowEvents.has('devicemotion'),false);assert.equal(a.timers.size,0);
  }
});
test('ReflexPrint denies incomplete motion/unstable timing/mixed source; no partial saves',async()=>{
  for(const mode of [{empty:true},{gap:true},{mixed:true}]){const a=app({motion:{}});startReflex(a);guidedReaction(a);guidedTapping(a);await guidedMotion(a,mode);assert.deepEqual(a.sessions(),[]);assert.match(a.nodes.get('status').textContent,/tidak.*disimpan/);}
});
test('ReflexPrint motion permission denied or granted after close cannot create a linked record',async()=>{
  const a=app({motion:{requestPermission:async()=> 'denied'}});startReflex(a);guidedReaction(a);guidedTapping(a);a.click('reflex-next');await a.click('motion-start');assert.deepEqual(a.sessions(),[]);assert.equal(a.windowEvents.has('devicemotion'),false);
  let grant;const b=app({motion:{requestPermission:()=>new Promise(resolve=>grant=resolve)}});startReflex(b);guidedReaction(b);guidedTapping(b);b.click('reflex-next');const task=b.click('motion-start');b.click('close-exp');grant('granted');await task;assert.deepEqual(b.sessions(),[]);assert.equal(b.windowEvents.has('devicemotion'),false);
});
test('ReflexPrint failed atomic save keeps history/counters/exports; retry saves exactly once',async()=>{
  const options={motion:{},storageFails:true};const a=app(options);startReflex(a);guidedReaction(a);guidedTapping(a);await guidedMotion(a);
  assert.deepEqual(a.sessions(),[]);assert.equal(a.nodes.get('total-sessions').textContent,0);assert.match(a.nodes.get('status').textContent,/gagal menyimpan/);a.click('export-json');assert.deepEqual(JSON.parse(await a.blobs[0].text()).sessions,[]);
  a.click('reflex-save-retry');assert.deepEqual(a.sessions(),[]);options.storageFails=false;a.click('reflex-save-retry');a.click('reflex-save-retry');assert.equal(a.sessions().length,1);assert.equal(a.nodes.get('total-sessions').textContent,1);assert.match(a.nodes.get('status').textContent,/Satu sesi lengkap tersimpan/);
  options.deleteFails=true;[...a.nodes.values()].find(e=>e.dataset.panel==='history').click();a.click('delete-history');assert.equal(a.sessions().length,1);assert.match(a.nodes.get('history-status').textContent,/Gagal menghapus/);options.deleteFails=false;a.click('delete-history');assert.deepEqual(a.sessions(),[]);
});
test('ReflexPrint rejects changed device/context, mixed keyboard/pointer, and stale next-step double click',async()=>{
  const a=app({motion:{}});startReflex(a);guidedReaction(a);const stale=a.nodes.get('reflex-next');stale.click();stale.click();assert.equal(a.nodes.get('tapping-start').className,'action');a.click('tapping-start');for(let i=0;i<4;i++){a.advance(200);a.hit('tap-area');}a.advance(14240);a.window.screen.width=915;await guidedMotion(a);assert.deepEqual(a.sessions(),[]);assert.match(a.nodes.get('status').textContent,/HP/);
  const b=app({motion:{}});startReflex(b);b.click('reaction-start');for(let i=0;i<5;i++){b.advance(i?2150:1400);b.frame();b.advance(250);b.hit('reaction-target',i?'pointerdown':'keydown');}b.advance(751);assert.deepEqual(b.sessions(),[]);assert.match(b.nodes.get('status').textContent,/tidak.*disimpan/);
});
test('6 guided sessions expose per-feature personal comparison after reload; no current-session baseline leakage',async()=>{
  const a=app({motion:{}});
  for(let i=0;i<6;i++){startReflex(a);guidedReaction(a);guidedTapping(a);await guidedMotion(a);const text=a.nodes.get('workspace-results').children.map(e=>e.textContent).join(' ');if(i<5)assert.match(text,new RegExp(i+'/5 sesi'));else {assert.match(text,/Perbandingan 5 sesi/);assert.match(text,/MAD/);assert.match(text,/Latensi sentuh aplikasi/);}assert.equal(a.sessions().length,i+1);}
  assert.equal(a.nodes.get('active-baselines').textContent,1);const b=app({storage:Object.fromEntries(a.data)});assert.equal(b.nodes.get('total-sessions').textContent,6);assert.equal(b.nodes.get('active-baselines').textContent,1);
});


test('device self-check UI starts no hardware automatically; background cancels probe with no active experiment',async()=>{
  let permissions=0,media=0;const a=app({motion:{requestPermission:async()=>{permissions++;return 'granted';}},media:{getUserMedia:async()=>{media++;throw Object.assign(Error(),{name:'NotAllowedError'});}}});
  assert.equal(permissions,0);assert.equal(media,0);assert.match(a.nodes.get('device-permission').textContent,/UNTESTED/);await a.click('device-refresh');assert.equal(permissions,0);assert.equal(media,0);
  await a.click('device-motion');assert.equal(permissions,1);assert.equal(a.windowEvents.has('devicemotion'),true);a.background();assert.equal(a.windowEvents.has('devicemotion'),false);assert.equal(a.timers.size,0);assert.match(a.nodes.get('device-permission').textContent,/CANCELLED/);assert.deepEqual(a.sessions(),[]);
});
test('device camera denial and late stream after leaving Metode cannot persist or keep tracks',async()=>{
  let grant,stops=0;const a=app({media:{getUserMedia:()=>new Promise(resolve=>grant=resolve)}});const task=a.click('device-camera');a.open('reaction');const track={stop(){stops++;}};grant({getTracks:()=>[track],getVideoTracks:()=>[track]});await task;assert.equal(stops,1);assert.match(a.nodes.get('device-camera-access').textContent,/CANCELLED/);assert.deepEqual(a.sessions(),[]);
  const b=app({media:{getUserMedia:async()=>{throw Object.assign(Error(),{name:'NotAllowedError'});}}});await b.click('device-camera');assert.match(b.nodes.get('device-camera-access').textContent,/DENIED/);assert.equal(b.timers.size,0);assert.deepEqual(b.sessions(),[]);
});

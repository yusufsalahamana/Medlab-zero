// Synthetic API/permission/cache mocks, not physical Android.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Probe,cacheState,ASSETS}=require('../device-check.js');
function fixture(options={}){
  const states={},timers=new Map();let listener=null,next=0,now=0,mediaCalls=0,permissionCalls=0;
  const p=new Probe({secure:options.secure!==false,protocol:'https:',motion:options.unsupported?null:{requestPermission:async()=>{permissionCalls++;return options.permission||'granted';}},media:options.unsupported?null:{getUserMedia:async constraints=>{mediaCalls++;return options.media?.(constraints);}},worker:null,caches:null,base:'https://example.test/lab/',online:()=>options.online!==false,status:(key,s)=>states[key]=s,listen:f=>listener=f,unlisten:f=>{if(listener===f)listener=null;},clock:()=>now,timer:(f,ms)=>{const id=++next;timers.set(id,{f,ms});return id;},clear:id=>timers.delete(id)});
  return {p,states,timers,listener:()=>listener,mediaCalls:()=>mediaCalls,permissionCalls:()=>permissionCalls,finish:()=>{const t=[...timers.values()].find(t=>t.ms===3000);assert.ok(t);t.f();},emit:(t,good=true)=>{now=t;listener?.({acceleration:good?{x:1,y:0,z:0}:null});}};
}
test('construction/static/cache refresh never automatically asks hardware permission',async()=>{
  const f=fixture();assert.equal(f.mediaCalls(),0);assert.equal(f.permissionCalls(),0);assert.equal(f.states.samples.code,'UNTESTED');await f.p.refresh();assert.equal(f.mediaCalls(),0);assert.equal(f.permissionCalls(),0);assert.equal(f.states.cache.code,'UNSUPPORTED');
});
test('unsupported/insecure and denied motion show distinct API/permission/sample states',async()=>{
  for(const opts of [{unsupported:true},{secure:false}]){const f=fixture(opts);await f.p.probeMotion();await f.p.probeCamera();assert.equal(f.states.samples.code,'UNSUPPORTED');assert.equal(f.states.camera.code,'UNSUPPORTED');assert.equal(f.mediaCalls(),0);assert.equal(f.permissionCalls(),0);}
  const f=fixture({permission:'denied'});await f.p.probeMotion();assert.equal(f.states.permission.code,'DENIED');assert.equal(f.states.samples.code,'INSUFFICIENT_DATA');assert.equal(f.listener(),null);assert.equal(f.timers.size,0);
});
test('late motion permission after cancellation or timeout cannot register listener',async()=>{
  for(const action of ['cancel','timeout']){const f=fixture();let grant;f.p.motion.requestPermission=()=>new Promise(r=>grant=r);const task=f.p.probeMotion();action==='cancel'?f.p.cancel():[...f.timers.values()][0].f();grant('granted');await task;assert.equal(f.listener(),null);assert.equal(f.timers.size,0);assert.notEqual(f.states.samples.code,'SAMPLES_OBSERVED');}
});
test('granted permission without samples or low-rate samples is not sensor PASS',async()=>{
  for(const count of [0,15]){const f=fixture();await f.p.probeMotion();for(let i=0;i<count;i++)f.emit(i*200);f.finish();assert.equal(f.states.permission.code,'GRANTED');assert.equal(f.states.samples.code,'INSUFFICIENT_DATA');assert.equal(f.listener(),null);assert.equal(f.timers.size,0);}
});
test('observed finite samples are availability only; absent permission API is not GRANTED',async()=>{
  const f=fixture();f.p.motion={};await f.p.probeMotion();for(let i=0;i<150;i++)f.emit(i*20);f.finish();assert.equal(f.states.permission.code,'NO_PERMISSION_RESULT');assert.equal(f.states.samples.code,'SAMPLES_OBSERVED');assert.match(f.states.samples.text,/bukan QC lengkap/);assert.equal(f.listener(),null);assert.equal(f.p.samples,undefined);
});
test('camera denied/rear unsupported/error are distinguished; no residual timer',async()=>{
  for(const [name,code] of [['NotAllowedError','DENIED'],['OverconstrainedError','UNSUPPORTED'],['NotFoundError','UNSUPPORTED'],['SecurityError','ERROR']]){const f=fixture({media:()=>{throw Object.assign(Error(),{name});}});await f.p.probeCamera();assert.equal(f.states.camera.code,code);assert.equal(f.states.rear.code,'UNTESTED');assert.equal(f.timers.size,0);}
});
test('camera stream is stopped promptly, exact rear requested, absent metadata not rear proof',async()=>{
  for(const facingMode of ['environment',undefined]){let stops=0;const track={stop(){stops++;},getSettings:()=>({facingMode})};const f=fixture({media:constraints=>{assert.equal(constraints.audio,false);assert.deepEqual(constraints.video.facingMode,{exact:'environment'});return {getTracks:()=>[track],getVideoTracks:()=>[track]};}});await f.p.probeCamera();assert.equal(stops,1);assert.equal(f.states.camera.code,'ACCESS_OBSERVED');assert.equal(f.states.rear.code,facingMode?'REAR_REPORTED':'UNVERIFIED');assert.equal(f.timers.size,0);}
});
test('late camera after cancel/timeout stopped without overwriting a newer probe',async()=>{
  for(const action of ['cancel','timeout']){let grant,stops=0;const f=fixture({media:()=>new Promise(r=>grant=r)});const task=f.p.probeCamera();action==='cancel'?f.p.cancel():[...f.timers.values()][0].f();await f.p.probeMotion();const before={...f.states.permission};const track={stop(){stops++;}};grant({getTracks:()=>[track],getVideoTracks:()=>[track]});await task;assert.equal(stops,1);assert.deepEqual(f.states.permission,before);assert.notEqual(f.states.camera.code,'ACCESS_OBSERVED');f.p.cancel();assert.equal(f.listener(),null);assert.equal(f.timers.size,0);}
});
test('cache readiness requires worker control and every successful asset in one local cache',async()=>{
  const base='https://example.test/lab/';const worker={controller:{},getRegistration:async()=>({active:{}})};
  const caches={keys:async()=>['unrelated','medlab-zero-synthetic'],open:async()=>({match:async url=>ASSETS.some(a=>new URL(a,base).href===url)?{ok:true}:undefined})};
  assert.equal((await cacheState({worker,caches,base})).code,'CACHE_READY');
  assert.equal((await cacheState({worker:{...worker,controller:null},caches,base})).code,'NOT_READY');
  const missing={...caches,open:async()=>({match:async url=>url.endsWith('device-check.js')?undefined:{ok:true}})};assert.equal((await cacheState({worker,caches:missing,base})).code,'NOT_READY');
  const bad={...caches,open:async()=>({match:async()=>({ok:false,status:404})})};assert.equal((await cacheState({worker,caches:bad,base})).code,'NOT_READY');
  assert.equal((await cacheState({worker:null,caches,base})).code,'UNSUPPORTED');assert.equal((await cacheState({worker,caches:{keys:async()=>{throw Error();}},base})).code,'ERROR');
});
test('offline reported is independent of readiness and cannot claim physical offline relaunch',async()=>{
  const f=fixture({online:false});assert.equal(f.states.network.code,'OFFLINE_REPORTED');assert.match(f.states.network.text,/belum diuji/);assert.equal(f.states.cache.code,'UNTESTED');await f.p.refresh();assert.equal(f.states.cache.code,'UNSUPPORTED');assert.equal(f.mediaCalls(),0);
});

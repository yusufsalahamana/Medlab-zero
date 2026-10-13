const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Capture}=require('../camera.js');
const MedPulse=require('../pulse.js');
function harness({denied=false,torch=false,torchFails=false,playFails=false,readFails=false,legacy=false}={}){
  let resolveMedia;const pending=new Promise(resolve=>resolveMedia=resolve),frames=new Map(),timers=new Map(),listeners={},messages=[],results=[];
  let stops=0,next=0,frameId=0,time=0,luminance=120,reads=0;
  const track={stop(){stops++;},addEventListener:(k,f)=>listeners[k]=f,getCapabilities:()=>({torch}),applyConstraints:async()=>{if(torchFails)throw Error('torch failed');}};
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  const video={srcObject:null,readyState:2,videoWidth:320,videoHeight:240,currentTime:0,play:async()=>{if(playFails)throw Error('play failed');},pause(){},requestVideoFrameCallback:fn=>{const id=++next;frames.set(id,fn);return id;},cancelVideoFrameCallback:id=>frames.delete(id),getVideoPlaybackQuality:()=>({totalVideoFrames:frameId})};
  if(legacy){delete video.requestVideoFrameCallback;delete video.cancelVideoFrameCallback;}
  const ctx={clearRect(){},drawImage(){reads++;if(readFails)throw Error('read failed');},getImageData:()=>({data:Uint8ClampedArray.from([luminance,luminance,luminance,255])})};
  const canvas={width:32,height:32,getContext:()=>ctx};
  const capture=new Capture({video,canvas,pulse:MedPulse,media:{getUserMedia:()=>denied?Promise.reject(Object.assign(Error(),{name:'NotAllowedError'})):pending},secure:true,setTimer:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id),raf:fn=>{const id=++next;frames.set(id,fn);return id;},caf:id=>frames.delete(id)});
  const start=()=>capture.start({status:s=>messages.push(s),progress(){},result:r=>results.push(r)});
  function frame(t,y=120,unique=true){time=t;luminance=y;if(unique)frameId++;video.currentTime=t/1000;const entry=frames.entries().next().value;if(!entry)return;frames.delete(entry[0]);entry[1](t,legacy?undefined:{presentationTime:t,presentedFrames:frameId,mediaTime:t/1000});}
  return {capture,video,frames,timers,messages,results,start,frame,resolve:()=>resolveMedia(stream),stops:()=>stops,reads:()=>reads,end:()=>listeners.ended?.()};
}
test('permission denial / insecure / unavailable: no fabricated candidate',async()=>{
  const h=harness({denied:true});await h.start();assert.match(h.messages.at(-1),/ditolak/);assert.equal(h.results.length,0);assert.equal(h.timers.size,0);
  for(const key of ['secure','media']){const h=harness();h.capture[key]=key==='secure'?false:null;await h.start();assert.match(h.messages.at(-1),/tidak tersedia/);assert.equal(h.timers.size,0);}
});
test('cancel while permission pending: late stream is stopped without attaching or callback',async()=>{
  const h=harness(),task=h.start();h.capture.stop();h.resolve();await task;
  assert.equal(h.stops(),1);assert.equal(h.video.srcObject,null);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.results.length,0);
});
test('torch absent or failing degrades to same QC without aborting capture',async()=>{
  for(const options of [{},{torch:true,torchFails:true}]){const h=harness(options),task=h.start();h.resolve();await task;assert.match(h.messages.at(-1),/Lampu (tidak tersedia|gagal)/);assert.equal(h.frames.size,1);h.capture.stop();assert.equal(h.stops(),1);}
});
test('play/read failure, ended track, timeout: release stream and discard trace',async()=>{
  for(const mode of ['play','read','ended','timeout']){
    const h=harness({playFails:mode==='play',readFails:mode==='read'}),task=h.start();h.resolve();await task;
    if(mode==='read')h.frame(0);if(mode==='ended')h.end();if(mode==='timeout')[...h.timers.values()][0]();
    assert.equal(h.stops(),1,mode);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.capture.samples.length,0);assert.equal(h.results.length,0);assert.match(h.messages.at(-1),/tidak mencukupi/);
  }
});
test('25-second decoded synthetic frames reach QC; frames/traces discarded on success',async()=>{
  const h=harness(),task=h.start();h.resolve();await task;
  for(let i=0;i<=750;i++)h.frame(i*1000/30,120+4*Math.sin(2*Math.PI*1.5*i/30));
  assert.equal(h.results.length,1);assert.equal(h.results[0].valid,true,JSON.stringify(h.results[0]));assert.ok(Math.abs(h.results[0].candidateBpm-90)<1);
  assert.equal(h.capture.samples.length,0);assert.equal(h.stops(),1);assert.equal(h.video.srcObject,null);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
});
test('flat camera input fails closed, never invents a candidate',async()=>{
  const h=harness(),task=h.start();h.resolve();await task;for(let i=0;i<=750;i++)h.frame(i*1000/30);
  assert.equal(h.results[0].valid,false);assert.equal(h.results[0].candidateBpm,null);assert.equal(h.stops(),1);
});
test('RAF fallback skips duplicate decoded frames despite advancing playback time',async()=>{
  const h=harness({legacy:true}),task=h.start();h.resolve();await task;h.frame(0);h.frame(10,120,false);h.frame(20,120,false);h.frame(33);
  assert.equal(h.capture.samples.length,2);assert.equal(h.reads(),2);h.capture.stop();assert.equal(h.frames.size,0);
});
test('cancel active session prevents stale callbacks and clears sampled data',async()=>{
  const h=harness(),task=h.start();h.resolve();await task;h.frame(0);const stale=[...h.frames.values()][0];h.capture.stop();stale(25000,{presentedFrames:100,presentationTime:25000});
  assert.equal(h.capture.samples.length,0);assert.equal(h.results.length,0);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.stops(),1);
});

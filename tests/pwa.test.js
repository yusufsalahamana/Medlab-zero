const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function worker(){
  const events={},deleted=[],network=[],entries=new Map();let assets=[];
  const cache={addAll:async list=>{assets=list;for(const p of list)entries.set(new URL(p,'https://example.test/lab/').href,{asset:p});},match:async req=>entries.get(req.url)};
  vm.runInNewContext(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),{
    self:{location:{origin:'https://example.test'},addEventListener:(k,f)=>events[k]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}},URL,
    caches:{open:async()=>cache,keys:async()=>['unrelated-app','medlab-zero-old','medlab-zero-v02-camera-research'],delete:async k=>deleted.push(k)},
    fetch:async req=>{network.push(req.url);return {fromNetwork:true};}
  });
  return {events,deleted,network,assets:()=>assets};
}
test('manifest and all precached assets resolve under a subpath',async()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  for(const p of [manifest.start_url,...manifest.icons.map(i=>i.src)])assert.ok(fs.existsSync(path.join(root,p)));
  assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
  for(const size of [192,512]){
    const icon=manifest.icons.find(i=>i.type==='image/png'&&i.sizes===`${size}x${size}`);
    assert.ok(icon,`missing ${size} icon`);
    const bytes=fs.readFileSync(path.join(root,icon.src));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
  }
  const w=worker();let done;w.events.install({waitUntil:p=>done=p});await done;
  for(const p of w.assets())assert.ok(fs.existsSync(path.join(root,p)),p);
  for(const asset of ['analysis.js','pulse.js','camera.js'])assert.ok(w.assets().includes('./'+asset));
});
test('activation removes only obsolete MED-LAB ZERO caches',async()=>{
  const w=worker();let done;w.events.activate({waitUntil:p=>done=p});await done;
  assert.deepEqual(w.deleted,['medlab-zero-old']);
});
test('cached app asset loads offline; non-GET and external requests are not intercepted',async()=>{
  const w=worker();let done;w.events.install({waitUntil:p=>done=p});await done;
  w.events.fetch({request:{method:'GET',url:'https://example.test/lab/app.js'},respondWith:p=>done=p});
  assert.equal((await done).asset,'./app.js');assert.deepEqual(w.network,[]);
  for(const request of [{method:'POST',url:'https://example.test/lab/'},{method:'GET',url:'https://external.test/'}]){
    let intercepted=false;w.events.fetch({request,respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
  }
});

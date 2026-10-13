// PR-source Chromium with synthetic touchscreen/motion inputs, no physical Android claim.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const base='http://127.0.0.1:8765';
const server=spawn('python3',['tools/serve.py'],{stdio:['ignore','pipe','inherit']});
let browser;
const timeout=setTimeout(()=>{console.error('Reflex browser smoke timed out');server.kill();process.exit(1);},120000);
(async()=>{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}if(i===49)throw Error('Loopback server did not start');await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR:',e.message);});
  page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
  await page.goto(base);await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  // Five explicit prior synthetic linked sessions to test comparison in the real DOM.
  await page.evaluate(()=>{
    const deviceKey=JSON.stringify([navigator.userAgent,screen.width,screen.height,devicePixelRatio]);
    const context={deviceKey,hand:'right',posture:'seated-supported'};
    const rows=Array.from({length:5},(_,i)=>{
      const start=Date.now()-3600000+i*60000;
      const stages=[
        {type:'reaction',valid:true,deviceKey,startedAt:start,endedAt:start+10000,durationMs:10000,qc:{valid:true,source:'pointer'},metrics:{trials:5,medianMs:250,minimumMs:230,madMs:10,falseStarts:0}},
        {type:'tapping',valid:true,deviceKey,startedAt:start+11000,endedAt:start+26000,durationMs:15000,qc:{valid:true,source:'pointer'},metrics:{taps:4,seconds:15,tapsPerSec:.27,medianIntervalMs:200,intervalCv:0}},
        {type:'tremor',valid:true,deviceKey,startedAt:start+27000,endedAt:start+39000,durationMs:12000,qc:{valid:true,source:'acceleration',missingSamples:0},metrics:{sampleCount:600,sampleRateHz:50,durationSec:11.98,rmsMps2:.5,dominantHz:6}}
      ];
      const linked=MedReflex.make(stages,context);if(!linked.valid)throw Error(linked.reason);
      return {id:'prior-synthetic-'+i,ts:linked.session.endedAt,type:'reflex',valid:true,quality:'SYNTHETIC CI',metrics:MedReflex.metrics(linked.session),reflex:linked.session};
    });
    localStorage.setItem('medlabzero.sessions.v1',JSON.stringify(rows));
  });
  await page.reload();assert.equal(await page.locator('#total-sessions').textContent(),'5');
  await page.locator('[data-open="reflex"]').click();
  await page.locator('#reflex-start').click();assert.match(await page.locator('#status').textContent(),/Pilih tangan/);
  await page.locator('#reflex-hand').selectOption('right');await page.locator('#reflex-context').check();await page.locator('#reflex-start').click();
  await page.locator('#reaction-start').click();await page.locator('#close-exp').click();
  assert.equal(await page.locator('#total-sessions').textContent(),'5');
  // Restart: incomplete capture must not contribute to the new session.
  await page.locator('[data-open="reflex"]').click();await page.locator('#reflex-hand').selectOption('right');await page.locator('#reflex-context').check();await page.locator('#reflex-start').click();
  await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('synthetic write denial');};});
  await page.locator('#reaction-start').click();
  for(let i=0;i<5;i++){await page.locator('#reaction-target.ready').waitFor();await page.waitForTimeout(160);await page.locator('#reaction-target').dispatchEvent('pointerdown');}
  await page.locator('#reflex-next').waitFor();assert.equal(await page.locator('#total-sessions').textContent(),'5');await page.locator('#reflex-next').click();
  await page.locator('#tapping-start').click();for(let i=0;i<4;i++){await page.waitForTimeout(200);await page.locator('#tap-area').dispatchEvent('pointerdown');}
  await page.locator('#reflex-next').waitFor();assert.equal(await page.locator('#total-sessions').textContent(),'5');await page.locator('#reflex-next').click();
  await page.locator('#motion-start').click();
  await page.evaluate(()=>{const start=performance.now();window.syntheticMotion=setInterval(()=>{const t=(performance.now()-start)/1000;window.dispatchEvent(new DeviceMotionEvent('devicemotion',{acceleration:{x:.8*Math.sin(2*Math.PI*6*t),y:0,z:0},interval:20}));},20);});
  await page.waitForFunction(()=>document.getElementById('workspace-results').textContent.includes('tiga tahap lengkap'),{},{timeout:16000}).catch(async e=>{console.error('REFLEX STATUS:',await page.locator('#status').textContent());throw e;});
  await page.evaluate(()=>clearInterval(window.syntheticMotion));
  assert.match(await page.locator('#status').textContent(),/gagal menyimpan/);assert.equal(await page.locator('#total-sessions').textContent(),'5');
  assert.match(await page.locator('#workspace-results').textContent(),/Perbandingan 5 sesi/);assert.match(await page.locator('#workspace-results').textContent(),/MAD/);
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});await page.locator('#reflex-save-retry').click();
  assert.equal(await page.locator('#total-sessions').textContent(),'6');assert.equal(await page.locator('#reflex-save-retry').isDisabled(),true);
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('medlabzero.sessions.v1')));
  assert.equal(data.length,6);assert.equal(data[5].reflex.stages.length,3);assert.doesNotMatch(JSON.stringify(data[5]),/"trace"|"samples"/);
  await page.reload();await page.locator('[data-panel="history"]').click();assert.match(await page.locator('#history-items').textContent(),/Sesi berantai lengkap/);
  const jsonDownload=page.waitForEvent('download');await page.locator('#export-json').click();const json=JSON.parse(fs.readFileSync(await (await jsonDownload).path(),'utf8'));assert.equal(json.sessions[5].reflex.context.hand,'right');
  const csvDownload=page.waitForEvent('download');await page.locator('#export-csv').click();const csv=fs.readFileSync(await (await csvDownload).path(),'utf8');assert.match(csv,/motionSource/);assert.match(csv,/"acceleration"/);
  await page.evaluate(()=>{window.originalRemoveItem=Storage.prototype.removeItem;Storage.prototype.removeItem=function(){throw Error('synthetic delete denial');};});page.once('dialog',d=>d.accept());await page.locator('#delete-history').click();assert.equal(await page.locator('#total-sessions').textContent(),'6');assert.match(await page.locator('#history-status').textContent(),/Gagal menghapus/);
  await page.evaluate(()=>{Storage.prototype.removeItem=window.originalRemoveItem;});server.kill();await context.setOffline(true);await page.reload();assert.equal(await page.locator('#total-sessions').textContent(),'6');await page.locator('[data-panel="history"]').click();page.once('dialog',d=>d.accept());await page.locator('#delete-history').click();await page.reload();assert.equal(await page.locator('#total-sessions').textContent(),'0');assert.equal(await page.locator('#active-baselines').textContent(),'0');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('REFLEX BROWSER PASS: Chromium mobile viewport; opt-in, interruption/restart, real-time guided synthetic Reaction/Tapping/DeviceMotion, 5-prior comparison, atomic failed save/retry, linked JSON/CSV, delete denial/retry, offline reload, no raw persistence or external page requests. Physical Android/clinical validity UNVERIFIED.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{clearTimeout(timeout);if(browser)await browser.close();server.kill();});

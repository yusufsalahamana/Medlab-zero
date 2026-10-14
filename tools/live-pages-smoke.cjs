// Public HTTPS Pages smoke (deployed main), distinct from PR-source localhost CI.
// All interactions are synthetic Chromium inputs. No Android hardware or medical validation.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base='https://yusufsalahamana.github.io/Medlab-zero/';
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,acceptDownloads:true});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
    const response=await page.goto(base,{waitUntil:'networkidle',timeout:45000});
    assert.equal(response.status(),200);
    assert.equal(await page.evaluate(()=>window.isSecureContext),true);
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await page.waitForFunction(()=>/Cache aplikasi siap|Worker aplikasi aktif/.test(document.getElementById('pwa-status').textContent));

    // Validate deployed dependencies, not local build files or a PR preview.
    const assets=await page.evaluate(()=>[...document.querySelectorAll('script[src],link[href]')].map(e=>e.src||e.href));
    assets.push(base+'service-worker.js');
    const manifestResponse=await context.request.get(base+'manifest.webmanifest');
    assert.equal(manifestResponse.status(),200);
    const manifest=await manifestResponse.json();
    assets.push(...manifest.icons.map(i=>new URL(i.src,base).href));
    for(const url of new Set(assets)){
      assert.ok(url.startsWith(base),url);
      const r=await context.request.get(url);
      assert.equal(r.status(),200,url);
      assert.ok((await r.body()).length>0,url);
    }
    console.log('LIVE PAGES PASS: public HTTPS root, assets and controlled service worker (published main).');

    // Each shipped module must open in the mobile viewport without starting sensors.
    for(const [type,title,ready] of [
      ['reaction','Reaction Time','#reaction-start'],
      ['tapping','Finger Tapping','#tapping-start'],
      ['tremor','Motion Lab','#motion-start'],
      ['pulse','Camera Pulse Lab','#camera-start'],
      ['reflex','ReflexPrint','#reflex-start']
    ]){
      await page.locator('[data-open="'+type+'"]').click();
      assert.equal(await page.locator('#workspace-title').textContent(),title);
      assert.equal(await page.locator(ready).isVisible(),true);
      await page.locator('#close-exp').click();
      assert.equal(await page.locator('#workspace').isVisible(),false);
    }
    assert.equal(await page.locator('#total-sessions').textContent(),'0');
    console.log('LIVE PAGES PASS: all five modules open/close on mobile; no capture started.');

    // Browser-only self-check: no real permission prompts or actual camera/sensor.
    await page.locator('[data-panel="method"]').click();
    assert.match(await page.locator('#environment-status').textContent(),/Konteks aman/);
    assert.match(await page.locator('#device-camera-access').textContent(),/UNTESTED/);
    await page.evaluate(()=>{
      window.syntheticCameraCalls=0;
      navigator.mediaDevices.getUserMedia=async()=>{
        window.syntheticCameraCalls++;
        throw new DOMException('synthetic denial','NotAllowedError');
      };
      DeviceMotionEvent.requestPermission=async()=> 'denied';
    });
    await page.locator('#device-refresh').click();
    await page.waitForFunction(()=>document.getElementById('device-cache').textContent.startsWith('CACHE_READY'));
    assert.equal(await page.evaluate(()=>window.syntheticCameraCalls),0);
    await page.locator('#device-motion').click();
    await page.waitForFunction(()=>document.getElementById('device-permission').textContent.startsWith('DENIED'));
    assert.match(await page.locator('#device-samples').textContent(),/INSUFFICIENT_DATA/);
    await page.locator('#device-camera').click();
    await page.waitForFunction(()=>document.getElementById('device-camera-access').textContent.startsWith('DENIED'));
    assert.equal(await page.evaluate(()=>window.syntheticCameraCalls),1);

    // Synthetic late-arriving video stream must stop after cancel, never touch real devices.
    await page.evaluate(()=>{
      navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.resolveSyntheticCamera=resolve;});
    });
    await page.locator('#device-camera').click();
    await page.locator('#device-cancel').click();
    await page.evaluate(()=>{
      const canvas=document.createElement('canvas');
      canvas.width=16;canvas.height=16;
      const stream=canvas.captureStream(1);
      window.syntheticTrack=stream.getVideoTracks()[0];
      window.resolveSyntheticCamera(stream);
    });
    await page.waitForFunction(()=>window.syntheticTrack.readyState==='ended');
    assert.match(await page.locator('#device-camera-access').textContent(),/CANCELLED/);
    assert.equal(await page.locator('#total-sessions').textContent(),'0');
    console.log('LIVE PAGES PASS: cache readiness, synthetic motion/camera denial and late-stream cancellation; no hardware access.');

    // Create exactly one disposable history record using browser-synthetic taps.
    await page.locator('[data-panel="experiments"]').click();
    await page.locator('[data-open="tapping"]').click();
    await page.locator('#tapping-start').click();
    for(let i=0;i<4;i++){
      await page.waitForTimeout(180);
      await page.locator('#tap-area').dispatchEvent('pointerdown');
    }
    await page.waitForFunction(()=>document.getElementById('total-sessions').textContent==='1',{},{timeout:20000});
    const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('medlabzero.sessions.v1')));
    assert.equal(records.length,1);
    assert.equal(records[0].type,'tapping');
    assert.equal(records[0].metrics.taps,4);
    await page.locator('[data-panel="history"]').click();
    const download=page.waitForEvent('download');
    await page.locator('#export-json').click();
    assert.equal((await download).suggestedFilename(),'medlab-zero-history.json');
    await page.reload();
    assert.equal(await page.locator('#total-sessions').textContent(),'1');
    console.log('LIVE PAGES PASS: one synthetic tapping result saved locally, exported and persisted after reload.');

    // Offline is only tested after explicit CACHE_READY; cached public path, not Android process relaunch.
    await context.setOffline(true);
    await page.reload();
    assert.equal(await page.locator('#total-sessions').textContent(),'1');
    await page.locator('[data-panel="method"]').click();
    await page.locator('#device-refresh').click();
    await page.waitForFunction(()=>document.getElementById('device-cache').textContent.startsWith('CACHE_READY'));
    assert.match(await page.locator('#device-network').textContent(),/OFFLINE_REPORTED/);
    await page.locator('[data-panel="experiments"]').click();
    await page.locator('[data-open="reaction"]').click();
    assert.equal(await page.locator('#reaction-start').isVisible(),true);
    await page.locator('#close-exp').click();
    await page.locator('[data-panel="history"]').click();
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#delete-history').click();
    assert.match(await page.locator('#history-status').textContent(),/sudah dihapus/);
    await page.reload();
    assert.equal(await page.locator('#total-sessions').textContent(),'0');
    assert.deepEqual(errors,[]);
    assert.deepEqual(external,[]);
    console.log('LIVE PAGES PASS: controlled offline reload/navigation, synthetic history clear, no page errors or external page requests captured.');
    console.log('LIVE PAGES QA COMPLETE: published main only; PR source covered separately by localhost CI. Physical Android camera/motion/torch/PWA relaunch and clinical validity UNVERIFIED.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

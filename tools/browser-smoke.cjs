// Real Chromium DOM/storage/SW smoke with synthetic inputs. No physical sensor claim.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const base='http://127.0.0.1:8765';
const server=spawn('python3',['tools/serve.py'],{stdio:['ignore','pipe','inherit']});
let browser;
const timeout=setTimeout(()=>{console.error('Browser smoke timed out');server.kill();process.exit(1);},120000);

(async()=>{
  for(let i=0;i<50;i++){
    try{if((await fetch(base)).ok)break;}catch{}
    if(i===49)throw Error('Loopback server did not start');
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR:',e.message);});
  page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
  await page.goto(base);
  assert.equal(await page.evaluate(()=>window.isSecureContext),true);
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await page.waitForFunction(()=>document.getElementById('pwa-status').textContent.includes('Cache aplikasi siap'));
  await page.locator('[data-panel="method"]').click();
  assert.match(await page.locator('#environment-status').textContent(),/Konteks aman/);
  await page.locator('[data-panel="experiments"]').click();
  await page.locator('[data-open="reaction"]').click();
  await page.locator('#reaction-start').click();
  await page.locator('#reaction-target').click(); // Deliberately early input.
  for(let trial=0;trial<5;trial++){
    await page.locator('#reaction-target.ready').waitFor();
    await page.waitForTimeout(150);
    await page.locator('#reaction-target').dispatchEvent('pointerdown');
  }
  await page.waitForFunction(()=>document.getElementById('total-sessions').textContent==='1');
  await page.locator('[data-open="tapping"]').click();
  await page.locator('#tapping-start').click();
  for(let i=0;i<4;i++){await page.waitForTimeout(200);await page.locator('#tap-area').dispatchEvent('pointerdown');}
  await page.waitForFunction(()=>document.getElementById('total-sessions').textContent==='2',{},{timeout:20000});
  const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('medlabzero.sessions.v1')));
  assert.equal(records[0].metrics.falseStarts,1);assert.equal(records[1].metrics.taps,4);
  await page.locator('[data-open="pulse"]').click();
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('synthetic denial','NotAllowedError');};});
  await page.locator('#camera-start').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('ditolak'),{},{timeout:5000}).catch(async e=>{console.error('CAMERA STATUS:',await page.locator('#status').textContent());throw e;});
  assert.equal(await page.locator('#camera-start').isEnabled(),true);
  await page.evaluate(()=>{
    const source=document.createElement('canvas');source.width=64;source.height=64;const ctx=source.getContext('2d');const start=performance.now();
    function paint(){const y=Math.round(120+4*Math.sin(2*Math.PI*1.5*(performance.now()-start)/1000));ctx.fillStyle=`rgb(${y},${y},${y})`;ctx.fillRect(0,0,64,64);}
    paint();window.syntheticCameraTimer=setInterval(paint,1000/30);
    navigator.mediaDevices.getUserMedia=async()=>source.captureStream(30);
  });
  await page.locator('#camera-start').click();
  await page.waitForFunction(()=>document.getElementById('workspace-results').textContent.includes('Experimental candidate pulse'),{},{timeout:35000}).catch(async e=>{console.error('CAMERA STATUS:',await page.locator('#status').textContent(),'RESULT:',await page.locator('#workspace-results').textContent());throw e;});
  const candidate=Number((await page.locator('#workspace-results').textContent()).match(/([0-9]+\.[0-9]) kandidat/)[1]);assert.ok(Math.abs(candidate-90)<2,candidate);
  assert.equal(await page.evaluate(()=>document.getElementById('camera-video').srcObject),null);
  assert.equal(await page.locator('#total-sessions').textContent(),'2');
  await page.evaluate(()=>clearInterval(window.syntheticCameraTimer));
  await page.reload();
  assert.equal(await page.locator('#total-sessions').textContent(),'2');
  await page.locator('[data-panel="history"]').click();
  const download=page.waitForEvent('download');await page.locator('#export-json').click();
  assert.equal((await download).suggestedFilename(),'medlab-zero-history.json');
  await page.evaluate(()=>{
    window.originalRemoveItem=Storage.prototype.removeItem;
    Storage.prototype.removeItem=function(){throw Error('synthetic denial');};
  });
  page.once('dialog',d=>d.accept());await page.locator('#delete-history').click();
  assert.match(await page.locator('#history-status').textContent(),/Gagal menghapus/);
  assert.equal(await page.locator('#total-sessions').textContent(),'2');
  await page.evaluate(()=>{Storage.prototype.removeItem=window.originalRemoveItem;});
  server.kill(); // Cached reload must work with the HTTP server stopped.
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator('#total-sessions').textContent(),'2');
  await page.locator('[data-panel="history"]').click();
  page.once('dialog',d=>d.accept());await page.locator('#delete-history').click();
  assert.match(await page.locator('#history-status').textContent(),/sudah dihapus/);
  await page.reload();assert.equal(await page.locator('#total-sessions').textContent(),'0');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('BROWSER PASS: Chromium mobile viewport; secure loopback, reaction/tapping, denied camera + synthetic canvas optical capture/QC/no persistence, local reload/export/delete failure+retry, offline reload, no external page requests. Android hardware/install UNVERIFIED.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  clearTimeout(timeout);if(browser)await browser.close();server.kill();
});

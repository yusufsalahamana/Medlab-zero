// Remote published main, distinct from PR-source localhost tests. No camera claim.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base='https://yusufsalahamana.github.io/Medlab-zero/';
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
    const response=await page.goto(base,{waitUntil:'networkidle',timeout:45000});
    assert.equal(response.status(),200);assert.equal(await page.evaluate(()=>window.isSecureContext),true);
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await page.waitForFunction(()=>document.getElementById('pwa-status').textContent.includes('Cache aplikasi siap'));
    // Browser request context verifies deployed root-relative assets, not local copies.
    const assets=await page.evaluate(()=>[...document.querySelectorAll('script[src],link[href]')].map(e=>e.src||e.href));
    assets.push(base+'service-worker.js');
    const manifestResponse=await context.request.get(base+'manifest.webmanifest');assert.equal(manifestResponse.status(),200);
    const manifest=await manifestResponse.json();
    assets.push(...manifest.icons.map(i=>new URL(i.src,base).href));
    for(const url of new Set(assets)){
      assert.ok(url.startsWith(base),url);const r=await context.request.get(url);assert.equal(r.status(),200,url);assert.ok((await r.body()).length>0,url);
    }
    await page.locator('[data-open="reaction"]').click();assert.equal(await page.locator('#reaction-start').isVisible(),true);
    await page.locator('#close-exp').click();
    await page.locator('[data-panel="history"]').click();assert.match(await page.locator('#history-items').textContent(),/Belum ada sesi/);
    await context.setOffline(true);await page.reload();
    assert.equal(await page.locator('[data-open="tapping"]').isVisible(),true);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log(`LIVE PAGES PASS: ${base}; HTTPS Chromium mobile viewport, root + ${new Set(assets).size} deployed assets, SW cache, navigation, offline browser reload, no external page requests. Tests published main; does NOT prove this PR is deployed or real Android camera/install/accuracy.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

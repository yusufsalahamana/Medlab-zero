const CACHE_PREFIX='medlab-zero-';
const CACHE=CACHE_PREFIX+'v04-device-check';
const ASSETS=['./','./index.html','./app.css','./app.js','./analysis.js','./reflex.js','./pulse.js','./camera.js','./device-check.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',evt=>{evt.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',evt=>{evt.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',evt=>{if(evt.request.method!=='GET'||new URL(evt.request.url).origin!==self.location.origin)return;evt.respondWith(caches.open(CACHE).then(cache=>cache.match(evt.request)).then(c=>c||fetch(evt.request)));});

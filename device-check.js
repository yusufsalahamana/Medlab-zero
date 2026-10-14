/* Optional capability probes. No measurements, identifiers, storage writes or network upload. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.MedDeviceCheck=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ASSETS=['./','./index.html','./app.css','./app.js','./analysis.js','./reflex.js','./pulse.js','./camera.js','./device-check.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
  async function cacheState({worker,caches,base}){
    if(!worker||!caches)return {code:'UNSUPPORTED',text:'Service worker atau Cache API tidak tersedia.'};
    try{
      const registration=await worker.getRegistration(base);
      if(!registration?.active||!worker.controller)return {code:'NOT_READY',text:'Worker aktif/kontrol halaman belum siap. Muat ulang setelah cache selesai.'};
      for(const name of (await caches.keys()).filter(k=>k.startsWith('medlab-zero-'))){
        const cache=await caches.open(name),found=await Promise.all(ASSETS.map(p=>cache.match(new URL(p,base).href)));
        if(found.every(r=>r?.ok===true))return {code:'CACHE_READY',text:'Semua aset aplikasi ditemukan di satu cache dan halaman dikontrol worker. Offline relaunch/instalasi fisik belum diuji.'};
      }
      return {code:'NOT_READY',text:'Cache aset belum lengkap. Sambungkan jaringan, muat ulang, lalu periksa lagi.'};
    }catch{return {code:'ERROR',text:'Kesiapan cache tidak dapat diperiksa; jangan anggap siap offline.'};}
  }
  class Probe {
    constructor({secure,protocol,motion,media,worker,caches,base,online=()=>navigator.onLine,status,listen=(f)=>window.addEventListener('devicemotion',f),unlisten=(f)=>window.removeEventListener('devicemotion',f),clock=()=>performance.now(),timer=(f,ms)=>setTimeout(f,ms),clear=id=>clearTimeout(id)}){
      Object.assign(this,{secure,protocol,motion,media,worker,caches,base,online,status,listen,unlisten,clock,timer,clear});this.token=0;this.cacheToken=0;this.handle=null;this.listener=null;this.active=null;
      this.staticStatus();this.put('permission','UNTESTED','Izin sensor belum diperiksa.');this.put('samples','UNTESTED','Belum menerima sampel melalui probe.');this.put('camera','UNTESTED','Akses kamera belakang belum diperiksa.');this.put('rear','UNTESTED','Arah kamera/frame/torch belum diuji.');this.put('cache','UNTESTED','Tap Periksa perangkat untuk memeriksa aset cache.');
    }
    put(key,code,text){this.status(key,{code,text});}
    staticStatus(){this.put('secure',this.secure?(this.protocol==='https:'?'HTTPS_SECURE':'SECURE_CONTEXT'):'INSECURE',this.secure?'Konteks aman; bukan bukti hardware diuji.':'Buka URL aplikasi HTTPS untuk akses sensor/kamera.');this.put('motion',this.motion?'SUPPORTED':'UNSUPPORTED','Keberadaan API gerak saja, bukan izin/sampel.');this.put('cameraApi',this.media?.getUserMedia?'SUPPORTED':'UNSUPPORTED','Keberadaan API kamera saja, bukan akses kamera belakang.');this.put('network',this.online()?'ONLINE_REPORTED':'OFFLINE_REPORTED','Status jaringan menurut browser; offline relaunch belum diuji.');}
    cleanup(){if(this.handle!==null)this.clear(this.handle);this.handle=null;if(this.listener)this.unlisten(this.listener);this.listener=null;this.active=null;}
    cancel(){const active=this.active;this.token++;this.cleanup();if(active==='motion'){this.put('permission','CANCELLED','Probe dibatalkan; izin terdahulu tidak dicabut.');this.put('samples','UNTESTED','Probe dibatalkan, tidak ada klaim hasil.');}if(active==='camera'){this.put('camera','CANCELLED','Probe dibatalkan. Stream yang datang terlambat langsung dihentikan.');this.put('rear','UNTESTED','Kamera belakang belum dikonfirmasi.');}}
    async refresh(){this.cancel();this.staticStatus();const token=++this.cacheToken;this.put('cache','CHECKING','Membaca cache lokal, tanpa meminta izin hardware.');const state=await cacheState(this);if(token===this.cacheToken)this.put('cache',state.code,state.text);}
    async probeMotion(){
      this.cancel();const token=this.token,current=()=>token===this.token;this.put('samples','UNTESTED','Belum menerima sampel.');
      if(!this.secure||!this.motion){this.put('permission','UNSUPPORTED','Konteks aman/API gerak tidak tersedia.');this.put('samples','UNSUPPORTED','Tidak dapat memulai probe gerak.');return;}
      this.active='motion';this.put('permission','REQUESTING','Memeriksa izin setelah tap Anda.');
      this.handle=this.timer(()=>{if(!current())return;this.cleanup();this.token++;this.put('permission','UNTESTED','Izin belum selesai; coba ulang bila diperlukan.');this.put('samples','INSUFFICIENT_DATA','Tidak cukup data probe.');},15000);
      try{
        if(typeof this.motion.requestPermission==='function'){
          const permission=await this.motion.requestPermission();if(!current())return;
          if(permission!=='granted'){this.cleanup();this.put('permission','DENIED','Akses gerak ditolak browser/sistem.');this.put('samples','INSUFFICIENT_DATA','Tidak ada capture yang dimulai.');return;}
          this.put('permission','GRANTED','Browser melaporkan izin diberikan; sampel tetap harus diperiksa.');
        }else this.put('permission','NO_PERMISSION_RESULT','Browser tidak menyediakan hasil izin eksplisit; belum membuktikan sampel.');
        if(!current())return;this.clear(this.handle);let count=0,first=null,last=null;
        this.listener=e=>{const good=a=>a&&[a.x,a.y,a.z].every(Number.isFinite);if(!current()||!(good(e.acceleration)||good(e.accelerationIncludingGravity)))return;const t=this.clock();if(!Number.isFinite(t)||(last!==null&&t<=last))return;if(first===null)first=t;last=t;count++;};
        this.listen(this.listener);this.put('samples','OBSERVING','Menerima event selama 3 detik; nilai akselerasi tidak disimpan.');
        this.handle=this.timer(()=>{if(!current())return;this.cleanup();const rate=count>1&&last>first?(count-1)*1000/(last-first):0;this.put('samples',count>=40&&rate>=28?'SAMPLES_OBSERVED':'INSUFFICIENT_DATA',`${count} event valid · ${rate.toFixed(1)} Hz selama probe. Ini ketersediaan sampel browser, bukan QC lengkap/validasi fisik atau fisiologis.`);},3000);
      }catch(error){if(!current())return;this.cleanup();this.put('permission',error.name==='NotAllowedError'?'DENIED':'ERROR','Probe izin gerak gagal ('+(error.name||'Error')+').');this.put('samples','INSUFFICIENT_DATA','Tidak ada capture yang selesai.');}
    }
    async probeCamera(){
      this.cancel();const token=this.token,current=()=>token===this.token;this.put('rear','UNTESTED','Arah kamera belum dikonfirmasi.');
      if(!this.secure||!this.media?.getUserMedia){this.put('camera','UNSUPPORTED','Konteks aman/API kamera tidak tersedia.');return;}
      this.active='camera';this.put('camera','REQUESTING','Meminta akses kamera belakang setelah tap Anda; tanpa audio/torch/frame.');
      this.handle=this.timer(()=>{if(!current())return;this.cleanup();this.token++;this.put('camera','UNTESTED','Izin kamera belum selesai. Stream terlambat akan dihentikan.');},15000);
      let stream;
      try{
        stream=await this.media.getUserMedia({audio:false,video:{facingMode:{exact:'environment'}}});
        if(!current())return;
        const track=stream.getVideoTracks()[0];if(!track)throw Error('NoVideoTrack');
        this.put('camera','ACCESS_OBSERVED','Stream video diperoleh dan langsung dihentikan. Frame, torch dan akurasi belum diuji.');
        const rear=track.getSettings?.().facingMode==='environment';this.put('rear',rear?'REAR_REPORTED':'UNVERIFIED',rear?'API melaporkan kamera environment; bukan bukti kualitas frame/PPG.':'Stream diperoleh, tetapi metadata arah kamera tidak tersedia/tidak sesuai.');
      }catch(error){if(!current())return;const code=error.name==='NotAllowedError'?'DENIED':['NotFoundError','OverconstrainedError'].includes(error.name)?'UNSUPPORTED':'ERROR';this.put('camera',code,'Probe kamera belakang gagal ('+(error.name||'Error')+').');}
      finally{if(stream)for(const track of stream.getTracks())track.stop();if(current())this.cleanup();}
    }
  }
  return {Probe,cacheState,ASSETS};
});

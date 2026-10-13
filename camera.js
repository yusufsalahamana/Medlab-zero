/* Capture lifecycle isolated for synthetic tests. Frames/traces never persisted. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.MedCamera=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  class Capture {
    constructor({video,canvas,media,secure,pulse,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),raf=fn=>requestAnimationFrame(fn),caf=id=>cancelAnimationFrame(id)}){
      Object.assign(this,{video,canvas,media,secure,pulse,setTimer,clearTimer,raf,caf});
      this.generation=0;this.stream=null;this.frame=null;this.timer=null;this.samples=[];
    }
    stop(){
      this.generation++;
      if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;
      if(this.frame!==null){if(this.video.cancelVideoFrameCallback&&this.video.requestVideoFrameCallback)this.video.cancelVideoFrameCallback(this.frame);else this.caf(this.frame);}this.frame=null;
      if(this.stream)for(const track of this.stream.getTracks())track.stop();this.stream=null;
      this.video.pause();this.video.srcObject=null;this.samples.length=0;
      this.canvas.getContext('2d').clearRect(0,0,this.canvas.width,this.canvas.height);
    }
    async start({status,progress,result}){
      this.stop();const generation=this.generation,current=()=>this.generation===generation;
      const fail=message=>{if(!current())return;this.stop();status(message);};
      if(!this.secure||!this.media?.getUserMedia){fail('Kamera tidak tersedia. Gunakan Chrome Android melalui HTTPS.');return;}
      status('Meminta izin kamera belakang…');
      // Bound hangs, permission dialogs, stalled video and missing-frame sessions.
      this.timer=this.setTimer(()=>fail('Kamera/frame tidak siap atau terhenti. Data tidak mencukupi; coba ulang.'),45000);
      try{
        const stream=await this.media.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:320},height:{ideal:240},frameRate:{ideal:30}}});
        if(!current()){stream.getTracks().forEach(t=>t.stop());return;}
        this.stream=stream;this.video.srcObject=stream;
        const track=stream.getVideoTracks()[0];
        if(!track)throw Error('Tidak ada track video.');
        track.addEventListener('ended',()=>fail('Kamera terputus. Data tidak mencukupi.'));
        let torch='Lampu tidak tersedia; gunakan pencahayaan stabil. QC tetap berlaku.';
        try{if(track.getCapabilities?.().torch){await track.applyConstraints({advanced:[{torch:true}]});torch='Lampu aktif. Jika jari terasa panas, segera batalkan.';}}
        catch{torch='Lampu gagal aktif; gunakan pencahayaan stabil. QC tetap berlaku.';}
        if(!current())return;
        await this.video.play();if(!current())return;
        if(!this.video.requestVideoFrameCallback&&!this.video.getVideoPlaybackQuality)throw Error('Browser tidak menyediakan hitungan frame unik.');
        status(torch+' Rekam 25 detik. Kandidat optik bukan denyut tervalidasi.');
        let start=null,lastFrame=-1;
        const ctx=this.canvas.getContext('2d',{willReadFrequently:true});
        const next=()=>{this.frame=this.video.requestVideoFrameCallback?this.video.requestVideoFrameCallback(safeSample):this.raf(safeSample);};
        const sample=(now,metadata)=>{
          this.frame=null;if(!current())return;
          // RAF must use decoded-frame counts: currentTime alone advances on duplicate frames.
          const frameId=metadata?.presentedFrames??this.video.getVideoPlaybackQuality?.().totalVideoFrames;
          if(Number.isFinite(frameId)&&frameId>lastFrame&&this.video.readyState>=2){
            lastFrame=frameId;
            const t=metadata?.presentationTime??now;
            if(!Number.isFinite(t))throw Error('Timestamp frame tidak tersedia.');
            if(start===null)start=t;
            const w=this.video.videoWidth,h=this.video.videoHeight;
            ctx.drawImage(this.video,w*.35,h*.35,w*.3,h*.3,0,0,32,32);
            this.samples.push({t,...this.pulse.roi(ctx.getImageData(0,0,32,32).data)});
            progress(Math.min(25,(t-start)/1000),this.samples.length);
            if(t-start>=25000){
              const answer=this.pulse.analyze(this.samples);this.stop();result(answer);return;
            }
            if(this.samples.length>4000)throw Error('Laju frame tidak didukung.');
          }
          next();
        };
        // Frame callback exceptions must release camera, not escape the event loop.
        const safeSample=(now,metadata)=>{try{sample(now,metadata);}catch{fail('Frame kamera gagal dibaca. Data tidak mencukupi; coba ulang.');}};
        next();
      }catch(error){
        fail(error.name==='NotAllowedError'?'Izin kamera ditolak. Data tidak mencukupi; izinkan kamera di pengaturan situs bila ingin mencoba.':'Kamera gagal dibuka. Data tidak mencukupi; coba ulang.');
      }
    }
  }
  return {Capture};
});

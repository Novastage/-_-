(()=>{
  const $=id=>document.getElementById(id);

  if(!window.__NOVA_REDLINE_FULL_PREVIEW__){
    window.__NOVA_REDLINE_FULL_PREVIEW__=true;

    const previewMedia=m=>{
      if(!(m instanceof HTMLMediaElement))return false;
      const id=String(m.id||'').toLowerCase();
      if(/preview|final|clean|result|stem|restore/.test(id))return true;
      const box=m.closest&&m.closest('#stemWorkspace,#voiceWorkspace,#restoreWorkspace,#aiRestoreWorkspace,[id*="restore" i],.stemCard');
      return !!box;
    };

    const stopLegacy60s=e=>{
      const m=e.target;
      if(!previewMedia(m))return;
      const t=Number(m.currentTime||0);
      if(e.type==='timeupdate'&&t>=58.5){e.stopImmediatePropagation();return;}
      if((e.type==='seeking'||e.type==='play')&&t>59.5)e.stopImmediatePropagation();
    };
    document.addEventListener('timeupdate',stopLegacy60s,true);
    document.addEventListener('seeking',stopLegacy60s,true);
    document.addEventListener('play',stopLegacy60s,true);

    const rewriteText=s=>String(s||'')
      .replace(/FREE\s*[·•-]?\s*60\s*SEC\s*PREVIEW/gi,'FREE · FULL PREVIEW')
      .replace(/MAX\s*60\s*SEC/gi,'FULL LENGTH')
      .replace(/Preview\s*60초/gi,'전체 길이 Preview')
      .replace(/60초\s*Preview/gi,'전체 길이 Preview')
      .replace(/최대\s*60초까지\s*청취할\s*수\s*있습니다/gi,'전체 길이를 청취할 수 있습니다')
      .replace(/최대\s*60초까지\s*청취/gi,'전체 길이 청취')
      .replace(/최대\s*60초/gi,'전체 길이')
      .replace(/FREE는\s*60초\s*Preview입니다/gi,'FREE도 전체 길이 Preview가 가능합니다');

    let textPatchBusy=false;
    const patchPreviewText=()=>{
      textPatchBusy=false;
      document.querySelectorAll('.onlineAccessBar,.onlineTrialNotice,.voicePlan,.stemHero,.voiceHero,span,b,strong,p,small').forEach(el=>{
        if(el.children&&el.children.length>0&&!el.matches('.onlineAccessBar,.onlineTrialNotice,.voicePlan,.stemHero,.voiceHero'))return;
        const old=el.textContent||'',next=rewriteText(old);
        if(next!==old)el.textContent=next;
      });
      const state=$('onlineAccessState');
      if(state){
        const old=state.innerHTML;
        let next=old.replace(/Preview\s*60초/gi,'Full Preview').replace(/60초\s*Preview/gi,'Full Preview').replace(/MAX\s*60\s*SEC/gi,'FULL LENGTH');
        if(next!==old)state.innerHTML=next;
      }
      document.querySelectorAll('.onlineTrialNotice').forEach(n=>{
        if(/FREE PREVIEW/i.test(n.textContent||'')&&/60초/.test(n.textContent||''))n.innerHTML='<b>FREE PREVIEW</b> · 결과물 전체 길이를 청취할 수 있습니다. WAV 다운로드는 정기구독 후 가능합니다.';
      });
    };
    const scheduleTextPatch=()=>{if(textPatchBusy)return;textPatchBusy=true;requestAnimationFrame(patchPreviewText)};
    patchPreviewText();
    new MutationObserver(scheduleTextPatch).observe(document.body,{subtree:true,childList:true,characterData:true});
    document.addEventListener('click',()=>setTimeout(patchPreviewText,0),true);
    setTimeout(patchPreviewText,300);
    setTimeout(patchPreviewText,1200);
  }

  if(!window.__NOVA_REDLINE_FREE_PROCESSING_FIX__){
    window.__NOVA_REDLINE_FREE_PROCESSING_FIX__=true;

    const clearFalsePaywallFlags=()=>{
      ['masterBtn','autoMasterAssistBtn','analyzeBtn'].forEach(id=>{
        const b=$(id);if(!b)return;
        b.removeAttribute('data-nova-paywall-download');
        b.removeAttribute('data-nova-paywalldownload');
        delete b.dataset.novaPaywallDownload;
        b.disabled=false;
        b.removeAttribute('disabled');
        b.removeAttribute('aria-disabled');
      });
    };

    const runMasterAction=(btn,mode)=>{
      clearFalsePaywallFlags();
      try{
        if(mode==='MANUAL'&&typeof window.master==='function')return window.master({mode:'MANUAL'});
        if(mode==='AUTO'&&typeof window.autoMasterAssist==='function')return window.autoMasterAssist();
        if(typeof btn.onclick==='function')return btn.onclick.call(btn,new MouseEvent('click',{bubbles:false,cancelable:true}));
      }catch(err){console.error('NOVA MASTER ACTION',err);}
    };

    window.addEventListener('click',e=>{
      const t=e.target&&e.target.closest?e.target.closest('#masterBtn,#autoMasterAssistBtn'):null;
      if(!t)return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const mode=t.id==='masterBtn'?'MANUAL':'AUTO';
      Promise.resolve().then(()=>runMasterAction(t,mode));
    },true);

    clearFalsePaywallFlags();
    setTimeout(clearFalsePaywallFlags,250);
    setTimeout(clearFalsePaywallFlags,1000);
    new MutationObserver(clearFalsePaywallFlags).observe(document.body,{subtree:true,attributes:true,attributeFilter:['disabled','data-nova-paywall-download','data-nova-paywalldownload']});
  }

  const ws=$('voiceWorkspace'),file=$('voiceFile'),oldRun=$('voiceRunBtn');
  const orig=$('voiceOriginal'),clean=$('voiceClean');
  if(!ws||!file||!oldRun||!orig||!clean||window.__NOVA_VOICE_CLEAN_ENHANCED_V2__)return;
  window.__NOVA_VOICE_CLEAN_ENHANCED_V2__={url:null,blob:null};

  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const db=x=>20*Math.log10(Math.max(1e-12,x));
  const lin=x=>Math.pow(10,x/20);
  const status=$('voiceStatus'),prog=$('voiceProgress');
  const ctl={noise:$('voiceNoise'),room:$('voiceRoom'),deess:$('voiceDeess'),body:$('voiceBody'),clarity:$('voiceClarity')};

  function subscribed(){
    if(window.NOVA_REDLINE_SUBSCRIBED===true)return true;
    const badge=$('onlinePlanBadge'),state=$('onlineAccessState');
    const t=(((badge&&badge.textContent)||'')+' '+((state&&state.textContent)||'')).toUpperCase();
    if(t.includes('FREE'))return false;
    return /SUBSCRIBED|PAID|PREMIUM|ACTIVE/.test(t);
  }
  function showPaywall(){
    const p=$('novaSubscriptionPopup');if(p){p.classList.add('show');return;}
    const modal=$('onlineSubscriptionModal');if(modal){modal.classList.add('show');$('onlineSubscriptionModalOk')?.focus();return;}
    alert('정기구독 후 다운로드 가능합니다.');
  }
  function setStatus(text,p=0){if(status)status.textContent=text;if(prog)prog.style.width=clamp(p,0,100)+'%'}
  function setDownloadLabel(){
    const b=$('voiceDownloadLocked');
    if(b){b.textContent='WAV 다운로드';b.disabled=false;b.removeAttribute('disabled');b.removeAttribute('aria-disabled');b.dataset.novaPaywallDownload='1';}
    const plan=ws.querySelector('.voicePlan b');if(plan&&/DOWNLOAD\s*LOCKED/i.test(plan.textContent||''))plan.textContent='WAV DOWNLOAD · SUBSCRIPTION';
  }
  setDownloadLabel();

  const oldDownload=$('voiceDownloadLocked');
  if(oldDownload){
    const dl=oldDownload.cloneNode(true);oldDownload.replaceWith(dl);dl.id='voiceDownloadLocked';dl.textContent='WAV 다운로드';dl.disabled=false;dl.dataset.novaPaywallDownload='1';
    dl.addEventListener('click',e=>{
      if(!subscribed()){e.preventDefault();showPaywall();return;}
      const u=window.__NOVA_VOICE_CLEAN_ENHANCED_V2__?.url;if(!u)return;
      e.preventDefault();e.stopPropagation();const a=document.createElement('a');a.href=u;a.download='NOVA_REDLINE_VOICE_CLEAN.wav';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
    });
  }

  const run=oldRun.cloneNode(true);oldRun.replaceWith(run);run.id='voiceRunBtn';run.textContent='VOICE CLEAN 처리';

  function channels(buf){return [new Float32Array(buf.getChannelData(0)),new Float32Array(buf.numberOfChannels>1?buf.getChannelData(1):buf.getChannelData(0))]}
  function metrics(L,R){let peak=0,sum=0,n=0;const step=Math.max(1,Math.floor(L.length/1200000));for(let i=0;i<L.length;i+=step){peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));const m=(L[i]+R[i])*.5;sum+=m*m;n++;}return{peak,rms:Math.sqrt(sum/Math.max(1,n))}}
  function estimateFloor(L,R,fs){const frame=Math.max(128,Math.round(fs*.02)),hop=Math.max(64,Math.round(fs*.015)),v=[];for(let s=0;s+frame<L.length;s+=hop){let q=0,n=0;for(let i=s;i<s+frame;i+=4){const m=(L[i]+R[i])*.5;q+=m*m;n++;}v.push(Math.sqrt(q/Math.max(1,n)));}if(!v.length)return lin(-60);v.sort((a,b)=>a-b);const count=Math.max(1,Math.floor(v.length*.16));let z=0;for(let i=0;i<count;i++)z+=v[i];return z/count}
  function adaptiveClean(L,R,fs,floor,noisePct,roomPct){
    const threshold=Math.max(floor*2.5,lin(-60+noisePct*.10)),maxCutDb=clamp(6+noisePct*.17+roomPct*.06,6,22),minGain=lin(-maxCutDb);
    const atk=Math.exp(-1/(fs*.005)),rel=Math.exp(-1/(fs*.13)),smooth=Math.exp(-1/(fs*.022));const hpF=68,dt=1/fs,rc=1/(2*Math.PI*hpF),ha=rc/(rc+dt);
    let env=0,g=1,slow=0,prevL=L[0]||0,prevR=R[0]||0,hpL=0,hpR=0;
    for(let i=0;i<L.length;i++){const inL=L[i],inR=R[i];hpL=ha*(hpL+inL-prevL);hpR=ha*(hpR+inR-prevR);prevL=inL;prevR=inR;L[i]=hpL;R[i]=hpR;const a=Math.max(Math.abs(hpL),Math.abs(hpR));env=(a>env?atk:rel)*env+(1-(a>env?atk:rel))*a;slow=.99955*slow+.00045*a;const r=clamp(env/(threshold+1e-10),0,1),curve=Math.pow(r,1.75);let target=minGain+(1-minGain)*curve;if(roomPct>0&&slow>1e-5&&env<slow*(.78-roomPct*.0016)){const tailRatio=clamp(env/(slow*.78+1e-10),0,1);target*=lin(-clamp(roomPct*.055*(1-tailRatio),0,5.5));}g=smooth*g+(1-smooth)*target;L[i]*=g;R[i]*=g;}
  }
  function deess(x,fs,amount){if(amount<=0)return;const fc=5100,alpha=1-Math.exp(-2*Math.PI*fc/fs),atk=Math.exp(-1/(fs*.0035)),rel=Math.exp(-1/(fs*.065)),maxRed=clamp(2.3+amount*.085,2.3,9.5);let low=0,hEnv=0,fEnv=0,g=1;for(let i=0;i<x.length;i++){const v=x[i];low+=alpha*(v-low);const hi=v-low,ha=Math.abs(hi),fa=Math.abs(v);hEnv=(ha>hEnv?atk:rel)*hEnv+(1-(ha>hEnv?atk:rel))*ha;fEnv=.994*fEnv+.006*fa;const spectral=hEnv/(fEnv+1e-5),act=clamp((spectral-.40)/.42,0,1)*clamp((fEnv-.003)/.05,0,1),target=lin(-maxRed*act);g=.93*g+.07*target;x[i]=low+hi*g;}}
  async function tonalAndDynamics(L,R,fs,body,clarity,noise,room){
    const ctx=new OfflineAudioContext(2,L.length,fs),buf=ctx.createBuffer(2,L.length,fs);buf.copyToChannel(L,0);buf.copyToChannel(R,1);const src=ctx.createBufferSource();src.buffer=buf;let node=src;
    const filter=(type,freq,Q,gain)=>{const n=ctx.createBiquadFilter();n.type=type;n.frequency.value=freq;if(Q!=null)n.Q.value=Q;if(gain!=null)n.gain.value=gain;node.connect(n);node=n;};
    filter('peaking',180,.85,body*1.35);filter('peaking',360,.9,-clamp(room*.035+noise*.012,0,2.2));filter('peaking',3200,.9,clarity*1.75);filter('highshelf',8500,.7,Math.max(0,clarity)*.45);
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-22;comp.knee.value=8;comp.ratio.value=1.75;comp.attack.value=.014;comp.release.value=.13;node.connect(comp);node=comp;node.connect(ctx.destination);src.start();return channels(await ctx.startRendering());
  }
  function normalize(L,R,inputRms){const m=metrics(L,R),target=inputRms*lin(.55);let gain=target/(m.rms+1e-10);gain=Math.min(gain,lin(-1)/(m.peak+1e-10));gain=clamp(gain,.72,1.5);let p=0;for(let i=0;i<L.length;i++){L[i]=clamp(L[i]*gain,-.891,.891);R[i]=clamp(R[i]*gain,-.891,.891);p=Math.max(p,Math.abs(L[i]),Math.abs(R[i]));}return{gain,peak:p}}
  function wav24(L,R,sr){const n=L.length,ab=new ArrayBuffer(44+n*6),v=new DataView(ab),S=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};S(0,'RIFF');v.setUint32(4,ab.byteLength-8,true);S(8,'WAVE');S(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sr,true);v.setUint32(28,sr*6,true);v.setUint16(32,6,true);v.setUint16(34,24,true);S(36,'data');v.setUint32(40,n*6,true);let o=44;for(let i=0;i<n;i++){for(const a of[L,R]){let x=clamp(a[i],-1,.999999),q=Math.round(x*8388607);if(q<0)q+=16777216;v.setUint8(o++,q&255);v.setUint8(o++,(q>>8)&255);v.setUint8(o++,(q>>16)&255);}}return new Blob([ab],{type:'audio/wav'})}

  run.addEventListener('click',async()=>{
    const f=file.files&&file.files[0];if(!f)return alert('보컬 또는 Stem 파일을 먼저 선택하세요.');run.disabled=true;const label=run.textContent;run.textContent='VOICE CLEAN V2 처리 중…';
    try{setStatus('VOICE CLEAN V2 · DECODING…',7);const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Web Audio API를 지원하지 않는 브라우저입니다.');const ctx=new AC(),ab=await f.arrayBuffer(),decoded=await ctx.decodeAudioData(ab.slice(0));await ctx.close();let[L,R]=channels(decoded),fs=decoded.sampleRate;const input=metrics(L,R),floor=estimateFloor(L,R,fs),noise=+(ctl.noise?.value||35),room=+(ctl.room?.value||20),ess=+(ctl.deess?.value||30),body=+(ctl.body?.value||.8),clarity=+(ctl.clarity?.value||1);if($('voiceFloor'))$('voiceFloor').textContent=db(floor).toFixed(1)+' dBFS';setStatus('ADAPTIVE NOISE / ROOM CLEAN…',28);await new Promise(r=>requestAnimationFrame(r));adaptiveClean(L,R,fs,floor,noise,room);setStatus('DYNAMIC DE-ESS…',52);await new Promise(r=>requestAnimationFrame(r));deess(L,fs,ess);deess(R,fs,ess);setStatus('BODY / CLARITY / DYNAMICS…',72);[L,R]=await tonalAndDynamics(L,R,fs,body,clarity,noise,room);const nrm=normalize(L,R,input.rms);if($('voiceOutPeak'))$('voiceOutPeak').textContent=db(nrm.peak).toFixed(1)+' dBFS';setStatus('ENCODING 24-BIT WAV…',91);const blob=wav24(L,R,fs),state=window.__NOVA_VOICE_CLEAN_ENHANCED_V2__;if(state.url)URL.revokeObjectURL(state.url);state.url=URL.createObjectURL(blob);state.blob=blob;clean.src=state.url;clean.load();setDownloadLabel();setStatus('VOICE CLEAN COMPLETE · ENHANCED V2 · 적응형 Noise/Room · Dynamic De-Ess · Mud Cut · Body/Clarity · Gentle Comp · Level Preserve',100);setTimeout(()=>{if(prog)prog.style.width='0%'},1100);}catch(e){console.error('VOICE CLEAN V2',e);setStatus('VOICE CLEAN ERROR · '+(e.message||e),0);alert('VOICE CLEAN 처리 중 오류가 발생했습니다.\n'+(e.message||e));}finally{run.disabled=false;run.textContent=label||'VOICE CLEAN 처리';setDownloadLabel();}
  });

  document.querySelectorAll('[data-online-module="voice"]').forEach(b=>b.addEventListener('click',()=>setTimeout(setDownloadLabel,0)));
  new MutationObserver(ms=>{for(const m of ms){const t=(m.target&&m.target.textContent)||'';if(/DOWNLOAD\s*LOCKED/i.test(t)){setDownloadLabel();break;}}}).observe(ws,{subtree:true,childList:true,characterData:true});
  const note=ws.querySelector('.voiceNote');if(note)note.innerHTML='<b>VOICE CLEAN ENHANCED V2</b> · 적응형 바닥 노이즈 억제, 잔향 꼬리 감쇠, 다이내믹 De-Esser, 360 Hz Mud 정리, Body / Clarity, Gentle Compression과 Level Preserve를 적용합니다. 원본 타이밍과 피치는 유지합니다.';
})();
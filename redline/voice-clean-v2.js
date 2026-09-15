(()=>{
  const $=id=>document.getElementById(id);
  let manualBusy=false;

  function manualSurface(){
    const btn=$('downloadBtn');
    if(!btn)return null;
    const text=(btn.textContent||'').trim();
    if(text==='마스터링'||/마스터링\s*처리\s*중/.test(text))return btn;
    return null;
  }

  function setManualReady(btn){
    if(!btn)return;
    btn.textContent='마스터링';
    btn.disabled=false;
    btn.removeAttribute('disabled');
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('data-nova-paywall-download');
    btn.removeAttribute('data-nova-paywalldownload');
    delete btn.dataset.novaPaywallDownload;
  }

  function setDownloadReady(btn){
    if(!btn)return;
    btn.textContent='WAV 다운로드';
    btn.disabled=false;
    btn.removeAttribute('disabled');
    btn.removeAttribute('aria-disabled');
    btn.dataset.novaPaywallDownload='1';
    const wrap=btn.closest&&btn.closest('#download');
    if(wrap)wrap.dataset.novaPaywallDownload='1';
  }

  async function runManualFromFinalButton(btn){
    if(manualBusy)return;
    manualBusy=true;
    btn.textContent='마스터링 처리 중…';
    try{
      if(typeof window.master!=='function')throw new Error('MASTER 엔진을 찾을 수 없습니다.');
      const ok=await window.master({mode:'MANUAL'});
      if(ok===false){setManualReady(btn);return;}
      setDownloadReady(btn);
    }catch(err){
      console.error('NOVA MANUAL MASTER',err);
      setManualReady(btn);
      alert('마스터링 처리 중 오류가 발생했습니다.\n'+(err?.message||err));
    }finally{
      manualBusy=false;
    }
  }

  // Window capture runs before the document-level subscription gate.
  // While this control says "마스터링" it is a processing action, never a download action.
  window.addEventListener('click',e=>{
    const raw=e.target;
    const btn=raw&&raw.closest?raw.closest('#downloadBtn'):null;
    if(!btn)return;
    const text=(btn.textContent||'').trim();
    if(manualBusy||text==='마스터링'||/마스터링\s*처리\s*중/.test(text)){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if(!manualBusy)runManualFromFinalButton(btn);
    }
  },true);

  window.__NOVA_REDLINE_FREE_PROCESSING_FIX__=true;
  function proxy(originalId,proxyId,mode){
    if($(proxyId))return;
    const old=$(originalId);if(!old)return;
    const btn=old.cloneNode(true);
    btn.id=proxyId;
    btn.classList.remove('onlineHiddenControl');
    btn.removeAttribute('data-nova-paywall-download');
    btn.removeAttribute('data-nova-paywalldownload');
    btn.style.setProperty('display','inline-flex','important');
    old.style.setProperty('display','none','important');
    old.insertAdjacentElement('afterend',btn);
    const sync=()=>{btn.disabled=!!old.disabled;if(old.textContent)btn.textContent=old.textContent;};
    sync();
    new MutationObserver(sync).observe(old,{attributes:true,childList:true,subtree:true});
    btn.onclick=async e=>{
      e.preventDefault();
      e.stopPropagation();
      if(mode==='MANUAL'&&typeof window.master==='function')return window.master({mode:'MANUAL'});
      if(mode==='AUTO'&&typeof window.autoMasterAssist==='function')return window.autoMasterAssist();
      if(typeof old.onclick==='function')return old.onclick.call(old,e);
    };
  }
  function install(){
    proxy('masterBtn','novaManualMasterBtn','MANUAL');
    proxy('autoMasterAssistBtn','novaAutoMasterAssistBtn','AUTO');
    const b=manualSurface();
    if(b&&!manualBusy)setManualReady(b);
  }
  install();setTimeout(install,100);setTimeout(install,500);setTimeout(install,1200);

  const s=document.createElement('script');
  s.src='/redline/voice-clean-core-v2.js?v=20260916-master-button-fix-3';
  document.head.appendChild(s);
})();
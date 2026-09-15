(()=>{
  const $=id=>document.getElementById(id);
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
  function install(){proxy('masterBtn','novaManualMasterBtn','MANUAL');proxy('autoMasterAssistBtn','novaAutoMasterAssistBtn','AUTO');}
  install();setTimeout(install,100);setTimeout(install,500);setTimeout(install,1200);
  const s=document.createElement('script');
  s.src='/redline/voice-clean-core-v2.js?v=20260916-master-free-2';
  document.head.appendChild(s);
})();
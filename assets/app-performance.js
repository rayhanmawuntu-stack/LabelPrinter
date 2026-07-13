(()=>{
  const root=document.documentElement;
  const nav=navigator||{};
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  const lowSpec=root.classList.contains('low-spec')||
    (Number.isFinite(nav.hardwareConcurrency)&&nav.hardwareConcurrency<=4)||
    (Number.isFinite(nav.deviceMemory)&&nav.deviceMemory<=4)||
    !!nav.connection?.saveData||reducedMotion;

  root.classList.toggle('low-spec',lowSpec);
  const schedule=(callback,timeout=500)=>{
    if(typeof callback!=='function')return 0;
    if('requestIdleCallback'in window)return requestIdleCallback(callback,{timeout});
    return setTimeout(callback,lowSpec?80:16);
  };
  const cancel=id=>{
    if('cancelIdleCallback'in window)cancelIdleCallback(id);else clearTimeout(id);
  };
  const setVisibilityState=()=>root.classList.toggle('app-paused',document.hidden);
  document.addEventListener('visibilitychange',setVisibilityState,{passive:true});
  setVisibilityState();

  schedule(()=>{
    document.querySelectorAll('img').forEach(img=>{
      try{img.decoding='async'}catch{}
      if(!img.closest('.physical,.sheet,.print-root,#reviewWrap')){
        try{img.loading='lazy'}catch{}
      }
    });
  },900);

  window.LabelPrintPerformance={lowSpec,reducedMotion,schedule,cancel};
})();
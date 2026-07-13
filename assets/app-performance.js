(()=>{
  const root=document.documentElement;
  const nav=navigator||{};
  const connection=nav.connection||nav.mozConnection||nav.webkitConnection||{};
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  const slowConnection=['slow-2g','2g','3g'].includes(connection.effectiveType);
  const lowSpec=root.classList.contains('low-spec')||
    (Number.isFinite(nav.hardwareConcurrency)&&nav.hardwareConcurrency<=4)||
    (Number.isFinite(nav.deviceMemory)&&nav.deviceMemory<=4)||
    !!connection.saveData||slowConnection||reducedMotion;

  root.classList.toggle('low-spec',lowSpec);
  root.dataset.performance=lowSpec?'low':'standard';

  const schedule=(callback,timeout=500)=>{
    if(typeof callback!=='function')return 0;
    if('requestIdleCallback'in window)return requestIdleCallback(callback,{timeout});
    return setTimeout(callback,lowSpec?120:24);
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
        if(lowSpec)try{img.fetchPriority='low'}catch{}
      }
    });
  },900);

  if(lowSpec){
    schedule(()=>{
      document.querySelectorAll('[data-performance-decoration],.ambient-orb,.decorative-blur').forEach(node=>node.remove());
    },1200);
  }

  window.LabelPrintPerformance={lowSpec,reducedMotion,slowConnection,schedule,cancel};
})();

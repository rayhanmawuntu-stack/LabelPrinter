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

  let scrolling=false;
  let scrollFrame=0;
  let scrollEndTimer=0;
  const finishScrolling=()=>{
    scrolling=false;
    root.classList.remove('is-scrolling');
  };
  const onScroll=()=>{
    if(!lowSpec||scrollFrame)return;
    scrollFrame=requestAnimationFrame(()=>{
      scrollFrame=0;
      scrolling=true;
      root.classList.add('is-scrolling');
      clearTimeout(scrollEndTimer);
      scrollEndTimer=setTimeout(finishScrolling,160);
    });
  };
  if(lowSpec)window.addEventListener('scroll',onScroll,{passive:true});

  const whenScrollIdle=callback=>{
    if(typeof callback!=='function')return()=>{};
    let cancelled=false;
    let retryTimer=0;
    let idleId=0;
    const check=()=>{
      if(cancelled)return;
      if(scrolling){retryTimer=setTimeout(check,180);return}
      idleId=schedule(()=>{
        if(cancelled)return;
        if(scrolling){check();return}
        callback();
      },1400);
    };
    check();
    return()=>{
      cancelled=true;
      clearTimeout(retryTimer);
      if(idleId)cancel(idleId);
    };
  };

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
    whenScrollIdle(()=>{
      document.querySelectorAll('[data-performance-decoration],.ambient-orb,.decorative-blur').forEach(node=>node.remove());
    });
  }

  window.LabelPrintPerformance={lowSpec,reducedMotion,slowConnection,schedule,cancel,whenScrollIdle,isScrolling:()=>scrolling};
})();
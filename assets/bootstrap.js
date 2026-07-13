(async function(){
  try{
    const version='20260713-low-spec-scroll-67';
    let initialTheme='light';
    let initialPalette='ksb';
    try{
      const savedTheme=localStorage.getItem('ksb-theme');
      initialTheme=savedTheme==='dark'||savedTheme==='light'?savedTheme:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
      const savedPalette=localStorage.getItem('ksb-color-scheme');
      if(['ksb','blood-mint','shilo-killarney','teal-coral','tokyo'].includes(savedPalette))initialPalette=savedPalette;
    }catch{}
    const root=document.documentElement;
    root.dataset.theme=initialTheme;
    root.dataset.palette=initialPalette;
    root.style.colorScheme=initialTheme;
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection||{};
    const lowSpec=Boolean(
      (navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||
      (navigator.deviceMemory&&navigator.deviceMemory<=4)||
      connection.saveData||
      ['slow-2g','2g','3g'].includes(connection.effectiveType)||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    root.classList.toggle('low-spec',lowSpec);
    root.dataset.performance=lowSpec?'low':'standard';

    const styles=['style-03b.css','style-05b.css','style-06.css','style-07.css','style-08.css','style-09.css','style-10.css','style-11.css','style-12.css','style-13.css','style-14.css','style-15.css','style-16.css','style-17.css','style-18.css','style-19.css','style-20.css','style-21.css','style-22.css','style-23.css','style-24.css','style-25.css','style-26.css','style-27.css','style-28.css','style-29.css','style-30.css','style-31.css','style-32.css','style-33.css','style-34.css','style-35.css','style-36.css','style-37.css','style-38.css','style-39.css','style-40.css','style-41.css','style-42.css','style-43.css','style-44.css','style-45.css','style-46.css','style-47.css','style-48.css','style-49.css','style-50.css','style-51.css'];
    styles.forEach(file=>{
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='assets/'+file+'?v='+version;
      document.head.appendChild(link);
    });

    const partials=['body-01.html','body-02.html','body-03.html','body-04.html'];
    const chunks=await Promise.all(partials.map(async file=>{
      const response=await fetch('partials/'+file+'?v='+version,{cache:'force-cache'});
      if(!response.ok)throw new Error('Failed to load '+file);
      return response.text();
    }));
    document.body.innerHTML=chunks.join('');

    const nav=document.querySelector('.nav');
    const analyticsButton=nav?.querySelector('[data-view="analytics"]');
    if(nav&&!nav.querySelector('[data-view="tracking"]')){
      const button=document.createElement('button');
      button.type='button';
      button.dataset.view='tracking';
      button.title='Tracking';
      button.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 10h15v12H5zM20 14h4l3 4v4h-7zM9 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM23 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg><span>Tracking</span><span class="badge" id="trackingBadge">0</span>';
      nav.insertBefore(button,analyticsButton||null);
    }

    const load=function(src){
      return new Promise(function(resolve,reject){
        const element=document.createElement('script');
        element.src=src+'?v='+version;
        element.onload=resolve;
        element.onerror=function(){reject(new Error('Failed to load '+src));};
        document.body.appendChild(element);
      });
    };

    const critical=['no-mock.js','app-01.js','app-sanitize.js','app-theme.js','app-palette.js','app-performance.js','app-02.js'];
    for(const file of critical)await load('assets/'+file);
    load('assets/app-favicon.js').catch(console.warn);

    const essential=['app-03.js','app-03b.js','app-awb.js','app-print-logo.js','app-04.js','app-04b.js','app-analytics-fast.js','app-05.js','app-validation.js','app-tracking-tab.js','app-tracking-settings.js'];
    for(const file of essential)await load('assets/'+file);

    const optional=[
      ...(!lowSpec?['app-analytics-hover.js']:[]),
      'app-monthly-report-graphs.js','app-import.js','app-report-export.js','app-report-pdf-v2.js','app-pdf.js'
    ];
    const waitForQuiet=()=>new Promise(resolve=>{
      const performanceHelper=window.LabelPrintPerformance;
      if(lowSpec&&performanceHelper?.whenScrollIdle){performanceHelper.whenScrollIdle(resolve);return}
      if('requestIdleCallback'in window){requestIdleCallback(resolve,{timeout:1800});return}
      setTimeout(resolve,lowSpec?420:24);
    });
    const loadOptional=async()=>{
      for(const file of optional){
        if(lowSpec)await waitForQuiet();
        await load('assets/'+file);
      }
    };
    if(lowSpec){
      const run=()=>loadOptional().catch(error=>console.warn('Optional module load failed:',error));
      const performanceHelper=window.LabelPrintPerformance;
      if(performanceHelper?.whenScrollIdle)performanceHelper.whenScrollIdle(run);
      else setTimeout(run,500);
    }else{
      await loadOptional();
    }
  }catch(error){
    document.body.innerHTML='<div class="boot">Unable to load KSB LabelPrint: '+String(error&&error.message||error)+'</div>';
  }
})();
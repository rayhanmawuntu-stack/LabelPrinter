(async function(){
  try{
    const version='20260720-shipment-template-82';
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
    const hardwareLow=Boolean(
      (navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||
      (navigator.deviceMemory&&navigator.deviceMemory<=4)||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    const constrainedNetwork=Boolean(connection.saveData||['slow-2g','2g','3g'].includes(connection.effectiveType));
    const deferHeavy=hardwareLow||constrainedNetwork;
    root.classList.toggle('low-spec',hardwareLow);
    root.dataset.performance=hardwareLow?'low':'standard';
    root.dataset.network=constrainedNetwork?'constrained':'standard';

    const shellResponse=await fetch('partials/app-shell.html?v='+version,{cache:'force-cache'});
    if(!shellResponse.ok)throw new Error('Failed to load application shell');
    document.body.innerHTML=await shellResponse.text();

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

    const modulePromises=new Map();
    const load=function(src){
      if(modulePromises.has(src))return modulePromises.get(src);
      const promise=new Promise(function(resolve,reject){
        const element=document.createElement('script');
        element.src=src+'?v='+version;
        element.async=false;
        element.onload=resolve;
        element.onerror=function(){modulePromises.delete(src);reject(new Error('Failed to load '+src));};
        document.body.appendChild(element);
      });
      modulePromises.set(src,promise);
      return promise;
    };
    const loadFiles=async files=>{for(const file of files)await load(file.startsWith('assets/')?file:'assets/'+file)};
    const analyticsExtras=[...(!hardwareLow?['app-analytics-hover.js']:[]),'app-analytics.bundle.js'];
    let analyticsPromise=null;
    let pdfPromise=null;
    const ensureAnalytics=()=>analyticsPromise||(analyticsPromise=loadFiles(analyticsExtras).then(()=>{
      document.documentElement.dataset.analyticsReady='true';
      return true;
    }).catch(error=>{analyticsPromise=null;throw error}));
    const ensurePdf=()=>pdfPromise||(pdfPromise=loadFiles(['app-pdf.js']).then(()=>true).catch(error=>{pdfPromise=null;throw error}));
    window.LabelPrintModules={load:loadFiles,ensureAnalytics,ensurePdf,isLoaded:file=>modulePromises.has(file.startsWith('assets/')?file:'assets/'+file)};

    await loadFiles(['app-core.bundle.js']);
    load('assets/app-favicon.js').catch(console.warn);

    const analyticsNav=document.querySelector('[data-view="analytics"]');
    const prepareAnalytics=()=>ensureAnalytics().catch(error=>{console.warn('Analytics modules failed to load:',error);toast?.('Some analytics tools could not be loaded')});
    analyticsNav?.addEventListener('click',prepareAnalytics,{passive:true});
    if(!deferHeavy){
      analyticsNav?.addEventListener('pointerenter',prepareAnalytics,{once:true,passive:true});
      analyticsNav?.addEventListener('focus',prepareAnalytics,{once:true,passive:true});
      const preload=()=>prepareAnalytics();
      if('requestIdleCallback'in window)requestIdleCallback(preload,{timeout:4000});else setTimeout(preload,2200);
    }

    const installLazyAction=(id,ensure)=>{
      const button=document.getElementById(id);
      if(!button)return;
      button.addEventListener('click',async event=>{
        if(button.dataset.modulesReady==='true')return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const original=button.textContent;
        button.disabled=true;
        button.textContent='Loading tools…';
        try{
          await ensure();
          button.dataset.modulesReady='true';
          button.disabled=false;
          button.textContent=original;
          button.click();
        }catch(error){
          console.error('Feature module load failed:',error);
          button.disabled=false;
          button.textContent=original;
          toast?.('Unable to load this tool. Check your connection.');
        }
      },true);
    };
    installLazyAction('downloadMonthlyReport',ensureAnalytics);
    installLazyAction('downloadMonthlyReportPdf',ensureAnalytics);
  }catch(error){
    document.body.innerHTML='<div class="boot">Unable to load KSB LabelPrint: '+String(error&&error.message||error)+'</div>';
  }
})();

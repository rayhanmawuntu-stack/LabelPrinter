(async function(){
  try{
    const version='20260722-header-accent-88';
    const deploymentKey='labelprint-deployment-version';
    const legacyInstallationKeys=['ksb-no-mock-startup','ksb-labels','ksb-history','ksb-users','ksb-layout','ksb-theme','ksb-color-scheme'];
    let legacyInstallation=false;
    try{
      legacyInstallation=!localStorage.getItem(deploymentKey)&&legacyInstallationKeys.some(key=>localStorage.getItem(key)!==null);
    }catch{}
    let deploymentCheckTimer=0;
    const readDeploymentVersion=async()=>{
      const response=await fetch('deployment-version.json?_='+Date.now(),{
        cache:'no-store',
        headers:{'Cache-Control':'no-cache'}
      });
      if(!response.ok)throw new Error('Version check failed');
      const data=await response.json();
      return typeof data.version==='string'?data.version.trim():'';
    };
    const requireDeploymentRefresh=latest=>{
      if(document.getElementById('deploymentRefreshOverlay'))return;
      clearInterval(deploymentCheckTimer);
      document.documentElement.style.overflow='hidden';
      document.body.style.overflow='hidden';
      const app=Array.from(document.body.children);
      app.forEach(element=>{
        element.setAttribute('aria-hidden','true');
        if('inert'in element)element.inert=true;
      });
      const overlay=document.createElement('div');
      overlay.id='deploymentRefreshOverlay';
      overlay.setAttribute('role','alertdialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-labelledby','deploymentRefreshTitle');
      overlay.setAttribute('aria-describedby','deploymentRefreshCopy');
      overlay.innerHTML='<div class="deployment-refresh-card"><span class="deployment-refresh-icon" aria-hidden="true">↻</span><p class="deployment-refresh-kicker">Update available</p><h2 id="deploymentRefreshTitle">Refresh required</h2><p id="deploymentRefreshCopy">A new version of LabelPrint is ready. Refresh now to continue using the app.</p><button type="button" id="deploymentRefreshButton">Refresh now</button></div>';
      const style=document.createElement('style');
      style.id='deploymentRefreshStyle';
      style.textContent='#deploymentRefreshOverlay{position:fixed;inset:0;width:100vw;height:100dvh;min-height:100vh;z-index:2147483647;display:grid;place-items:center;box-sizing:border-box;padding:max(24px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));overflow:auto;overscroll-behavior:contain;background:rgba(12,15,18,.94);backdrop-filter:blur(12px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#15191f}.deployment-refresh-card{width:min(100%,420px);box-sizing:border-box;padding:32px;border:1px solid rgba(255,255,255,.2);border-radius:28px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.48);text-align:center}.deployment-refresh-icon{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 20px;border-radius:18px;background:var(--theme-primary,#dfff3f);color:var(--theme-on-primary,#111315);font-size:34px;font-weight:800;line-height:1}.deployment-refresh-kicker{margin:0 0 8px;color:#626b75;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.deployment-refresh-card h2{margin:0;font-size:clamp(26px,7vw,36px);line-height:1.05}.deployment-refresh-card p:not(.deployment-refresh-kicker){margin:14px auto 24px;color:#626b75;font-size:15px;line-height:1.55}.deployment-refresh-card button{width:100%;min-height:52px;border:0;border-radius:15px;background:var(--theme-primary,#dfff3f);color:var(--theme-on-primary,#111315);font:800 15px inherit;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.18)}.deployment-refresh-card button:focus-visible{outline:4px solid rgba(120,148,255,.65);outline-offset:3px}@media(max-width:480px){.deployment-refresh-card{padding:28px 22px;border-radius:23px}}@media(prefers-reduced-motion:no-preference){.deployment-refresh-card{animation:deploymentRefreshIn .18s ease-out}@keyframes deploymentRefreshIn{from{opacity:0;transform:translateY(10px) scale(.98)}}}';
      document.head.appendChild(style);
      document.body.appendChild(overlay);
      const button=overlay.querySelector('#deploymentRefreshButton');
      const blockExit=event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();}
      };
      document.addEventListener('keydown',blockExit,true);
      button.addEventListener('click',()=>{
        button.disabled=true;
        button.textContent='Refreshing…';
        const target=new URL(location.href);
        target.searchParams.set('_lpv',latest.slice(0,12));
        location.replace(target.href);
      },{once:true});
      requestAnimationFrame(()=>button.focus());
    };
    const checkDeployment=async()=>{
      try{
        const latest=await readDeploymentVersion();
        if(!latest)return;
        let current='';
        try{
          current=localStorage.getItem(deploymentKey)||sessionStorage.getItem(deploymentKey)||'';
          localStorage.setItem(deploymentKey,latest);
          sessionStorage.setItem(deploymentKey,latest);
        }catch{
          current=sessionStorage.getItem(deploymentKey)||'';
          sessionStorage.setItem(deploymentKey,latest);
        }
        if((current&&current!==latest)||(!current&&legacyInstallation)){
          legacyInstallation=false;
          requireDeploymentRefresh(latest);
        }
      }catch(error){
        console.warn('Deployment version check skipped:',error);
      }
    };
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
    let trackingPromise=null;
    let trackingReady=false;
    let importPromise=null;
    let pdfPromise=null;
    const ensureAnalytics=()=>analyticsPromise||(analyticsPromise=loadFiles(analyticsExtras).then(()=>{
      document.documentElement.dataset.analyticsReady='true';
      return true;
    }).catch(error=>{analyticsPromise=null;throw error}));
    const ensurePdf=()=>pdfPromise||(pdfPromise=loadFiles(['app-pdf.js']).then(()=>true).catch(error=>{pdfPromise=null;throw error}));
    const ensureTracking=()=>trackingPromise||(trackingPromise=loadFiles(['app-tracking.bundle.js']).then(()=>{trackingReady=true;return true}).catch(error=>{trackingPromise=null;throw error}));
    const ensureImport=()=>importPromise||(importPromise=loadFiles(['app-import.bundle.js']).then(()=>true).catch(error=>{importPromise=null;throw error}));
    window.LabelPrintModules={load:loadFiles,ensureAnalytics,ensurePdf,ensureTracking,ensureImport,isLoaded:file=>modulePromises.has(file.startsWith('assets/')?file:'assets/'+file)};

    await loadFiles(['app-core.bundle.js']);
    load('assets/app-favicon.js').catch(console.warn);

    const analyticsNav=document.querySelector('[data-view="analytics"]');
    const prepareAnalytics=()=>ensureAnalytics().catch(error=>{console.warn('Analytics modules failed to load:',error);toast?.('Some analytics tools could not be loaded')});
    analyticsNav?.addEventListener('click',prepareAnalytics,{passive:true});
    const trackingNav=document.querySelector('[data-view="tracking"]');
    trackingNav?.addEventListener('click',async event=>{
      if(trackingReady)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try{await ensureTracking();switchView('tracking')}catch(error){console.warn('Tracking module failed to load:',error);toast?.('Tracking could not be loaded')}
    },true);
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
    installLazyAction('importHistory',ensureImport);

    if(!deferHeavy){
      const preloadSecondary=()=>Promise.allSettled([ensureTracking(),ensureImport()]);
      if('requestIdleCallback'in window)requestIdleCallback(preloadSecondary,{timeout:7000});else setTimeout(preloadSecondary,5000);
    }

    await checkDeployment();
    deploymentCheckTimer=setInterval(checkDeployment,120000);
    document.addEventListener('visibilitychange',()=>{
      if(!document.hidden)checkDeployment();
    },{passive:true});
    window.addEventListener('focus',checkDeployment,{passive:true});
  }catch(error){
    document.body.innerHTML='<div class="boot">Unable to load KSB LabelPrint: '+String(error&&error.message||error)+'</div>';
  }
})();

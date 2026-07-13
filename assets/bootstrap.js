(async function(){
  try{
    const version='20260713-tracking-status-settings-61';
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
    const lowSpec=(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||(navigator.deviceMemory&&navigator.deviceMemory<=4)||navigator.connection?.saveData||matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.toggle('low-spec',Boolean(lowSpec));

    const styles=['style-03b.css','style-05b.css','style-06.css','style-07.css','style-08.css','style-09.css','style-10.css','style-11.css','style-12.css','style-13.css','style-14.css','style-15.css','style-16.css','style-17.css','style-18.css','style-19.css','style-20.css','style-21.css','style-22.css','style-23.css','style-24.css','style-25.css','style-26.css','style-27.css','style-28.css','style-29.css','style-30.css','style-31.css','style-32.css','style-33.css','style-34.css','style-35.css','style-36.css','style-37.css','style-38.css','style-39.css','style-40.css','style-41.css','style-42.css','style-43.css','style-44.css','style-45.css','style-46.css','style-47.css','style-48.css'];
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
    const deferred=['app-03.js','app-03b.js','app-awb.js','app-print-logo.js','app-04.js','app-04b.js','app-analytics-fast.js','app-analytics-hover.js','app-monthly-report-graphs.js','app-import.js','app-report-export.js','app-report-pdf-v2.js','app-pdf.js','app-05.js','app-validation.js','app-tracking-tab.js','app-tracking-settings.js'];
    for(const file of deferred)await load('assets/'+file);
  }catch(error){
    document.body.innerHTML='<div class="boot">Unable to load KSB LabelPrint: '+String(error&&error.message||error)+'</div>';
  }
})();

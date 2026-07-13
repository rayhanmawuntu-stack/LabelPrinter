(async()=>{
  try{
    const version='20260713-jne-awb-tracking-55';
    let initialTheme='light',initialPalette='ksb';
    try{
      const savedTheme=localStorage.getItem('ksb-theme');
      initialTheme=savedTheme==='dark'||savedTheme==='light'?savedTheme:(window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light');
      const savedPalette=localStorage.getItem('ksb-color-scheme');
      initialPalette=['ksb','blood-mint','shilo-killarney','teal-coral','tokyo'].includes(savedPalette)?savedPalette:'ksb';
    }catch{initialTheme=window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'}
    const lowSpec=(Number.isFinite(navigator.hardwareConcurrency)&&navigator.hardwareConcurrency<=4)||(Number.isFinite(navigator.deviceMemory)&&navigator.deviceMemory<=4)||!!navigator.connection?.saveData||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.dataset.theme=initialTheme;
    document.documentElement.dataset.palette=initialPalette;
    document.documentElement.style.colorScheme=initialTheme;
    document.documentElement.classList.toggle('low-spec',!!lowSpec);
    const styles=['assets/style-03b.css','assets/style-05b.css','assets/style-06.css','assets/style-07.css','assets/style-08.css','assets/style-09.css','assets/style-10.css','assets/style-11.css','assets/style-12.css','assets/style-13.css','assets/style-14.css','assets/style-15.css','assets/style-16.css','assets/style-17.css','assets/style-18.css','assets/style-19.css','assets/style-20.css','assets/style-21.css','assets/style-22.css','assets/style-23.css','assets/style-24.css','assets/style-25.css','assets/style-26.css','assets/style-27.css','assets/style-28.css','assets/style-29.css','assets/style-30.css','assets/style-31.css','assets/style-32.css','assets/style-33.css','assets/style-34.css','assets/style-35.css','assets/style-36.css','assets/style-37.css','assets/style-38.css','assets/style-39.css','assets/style-40.css','assets/style-41.css','assets/style-42.css','assets/style-43.css','assets/style-44.css','assets/style-45.css','assets/style-46.css'];
    for(const href of styles){const link=document.createElement('link');link.rel='stylesheet';link.href=`${href}?v=${version}`;document.head.appendChild(link)}
    const files=['partials/body-01.html','partials/body-02.html','partials/body-03.html','partials/body-04.html'];
    const html=(await Promise.all(files.map(async path=>{const r=await fetch(`${path}?v=${version}`,{cache:'force-cache'});if(!r.ok)throw new Error(`Failed to load ${path}`);return r.text()}))).join('');
    document.body.innerHTML=html;
    const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Failed to load ${src}`));document.body.appendChild(s)});
    const criticalScripts=['assets/no-mock.js','assets/app-01.js','assets/app-sanitize.js','assets/app-theme.js','assets/app-palette.js','assets/app-performance.js','assets/app-02.js'];
    for(const src of criticalScripts)await loadScript(`${src}?v=${version}`);
    loadScript(`assets/app-favicon.js?v=${version}`).catch(error=>console.warn(error));
    const scripts=['assets/app-03.js','assets/app-03b.js','assets/app-awb.js','assets/app-print-logo.js','assets/app-04.js','assets/app-04b.js','assets/app-analytics-fast.js','assets/app-analytics-hover.js','assets/app-monthly-report-graphs.js','assets/app-import.js','assets/app-report-export.js','assets/app-report-pdf-v2.js','assets/app-pdf.js','assets/app-05.js','assets/app-validation.js'];
    for(const src of scripts)await loadScript(`${src}?v=${version}`);
  }catch(error){document.body.innerHTML=`<div class="boot">Unable to load KSB LabelPrint: ${String(error.message||error)}</div>`}
})();
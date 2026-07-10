(async()=>{
  try{
    const version='20260710-history-dark-list-fix-18';
    let initialTheme='light';
    try{
      const savedTheme=localStorage.getItem('ksb-theme');
      initialTheme=savedTheme==='dark'||savedTheme==='light'?savedTheme:(window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light');
    }catch{initialTheme=window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'}
    document.documentElement.dataset.theme=initialTheme;
    document.documentElement.style.colorScheme=initialTheme;
    for(const href of ['assets/style-03b.css','assets/style-05b.css','assets/style-06.css','assets/style-07.css','assets/style-08.css','assets/style-09.css','assets/style-10.css','assets/style-11.css','assets/style-12.css','assets/style-13.css','assets/style-14.css','assets/style-15.css','assets/style-16.css','assets/style-17.css','assets/style-18.css','assets/style-19.css','assets/style-20.css','assets/style-21.css','assets/style-22.css','assets/style-23.css','assets/style-24.css','assets/style-25.css','assets/style-26.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=`${href}?v=${version}`;document.head.appendChild(link)}
    const files=['partials/body-01.html','partials/body-02.html','partials/body-03.html','partials/body-04.html'];
    const html=(await Promise.all(files.map(async path=>{const r=await fetch(`${path}?v=${version}`,{cache:'no-store'});if(!r.ok)throw new Error(`Failed to load ${path}`);return r.text()}))).join('');
    document.body.innerHTML=html;
    const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Failed to load ${src}`));document.body.appendChild(s)});
    const scripts=['assets/no-mock.js','assets/app-01.js','assets/app-theme.js','assets/app-02.js','assets/app-03.js','assets/app-03b.js','assets/app-04.js','assets/app-04b.js','assets/app-import.js','assets/app-pdf.js','assets/app-05.js'];
    for(const src of scripts)await loadScript(`${src}?v=${version}`);
  }catch(error){document.body.innerHTML=`<div class="boot">Unable to load KSB LabelPrint: ${String(error.message||error)}</div>`}
})();
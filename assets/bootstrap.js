(async()=>{
  try{
    for(const href of ['assets/style-03b.css','assets/style-05b.css','assets/style-06.css','assets/style-07.css','assets/style-08.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link)}
    const files=['partials/body-01.html','partials/body-02.html','partials/body-03.html','partials/body-04.html'];
    const html=(await Promise.all(files.map(async path=>{const r=await fetch(path);if(!r.ok)throw new Error(`Failed to load ${path}`);return r.text()}))).join('');
    document.body.innerHTML=html;
    const scripts=['assets/no-mock.js','assets/app-01.js','assets/app-02.js','assets/app-03.js','assets/app-03b.js','assets/app-04.js','assets/app-04b.js','assets/app-05.js'];
    for(const src of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Failed to load ${src}`));document.body.appendChild(s)});
  }catch(error){document.body.innerHTML=`<div class="boot">Unable to load KSB LabelPrint: ${String(error.message||error)}</div>`}
})();

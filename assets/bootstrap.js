(async()=>{
  try{
    const files=['partials/body-01.html', 'partials/body-02.html', 'partials/body-03.html', 'partials/body-04.html'];
    const html=(await Promise.all(files.map(async path=>{const r=await fetch(path);if(!r.ok)throw new Error(`Failed to load ${path}`);return r.text()}))).join('');
    document.body.innerHTML=html;
    for(const src of ['assets/app-01.js', 'assets/app-02.js', 'assets/app-03.js', 'assets/app-04.js', 'assets/app-05.js']) await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Failed to load ${src}`));document.body.appendChild(s)});
  }catch(error){document.body.innerHTML=`<div class="boot">Unable to load KSB LabelPrint: ${String(error.message||error)}</div>`}
})();

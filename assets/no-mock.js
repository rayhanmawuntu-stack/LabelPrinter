(()=>{
  const legacyCompanies=new Set(['MANDARA PERMAI','MULTI SARANA MARITIM','SAIPEM INDONESIA']);
  const normalize=item=>String(item?.company||'').trim().toUpperCase();
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem('ksb-labels')||'null')}catch{saved=null}
  const savedIsLegacy=Array.isArray(saved)&&saved.length>0&&saved.every(item=>legacyCompanies.has(normalize(item)));
  if(Array.isArray(window.SAMPLE)) window.SAMPLE.splice(0);
  if(savedIsLegacy){
    localStorage.removeItem('ksb-labels');
    window.labels=[];
  }else if(!Array.isArray(saved)&&Array.isArray(window.labels)&&window.labels.every(item=>legacyCompanies.has(normalize(item)))){
    window.labels=[];
  }
  localStorage.setItem('ksb-no-mock-startup','2026-07-08-01');
})();

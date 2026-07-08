(()=>{
  const legacyCompanies=new Set(['MANDARA PERMAI','MULTI SARANA MARITIM','SAIPEM INDONESIA']);
  const normalize=item=>String((item&&item.company)||'').trim().toUpperCase();
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem('ksb-labels')||'null')}catch{saved=null}
  const hasLegacy=Array.isArray(saved)&&saved.length>0&&saved.some(item=>legacyCompanies.has(normalize(item)));
  if(!Array.isArray(saved)||hasLegacy){
    localStorage.setItem('ksb-labels','[]');
    localStorage.setItem('ksb-no-mock-cleaned','true');
  }
  localStorage.setItem('ksb-no-mock-startup','2026-07-08-02');
})();

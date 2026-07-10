const HISTORY_IMPORT_REVISION='2026-07-10-xlsx-history-import-01';
let xlsxLibraryPromise=null;
function ensureXlsxLibrary(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(xlsxLibraryPromise)return xlsxLibraryPromise;
  xlsxLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=setTimeout(()=>{script.remove();reject(new Error('Excel reader timed out'))},15000);
    script.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.async=true;
    script.onload=()=>{clearTimeout(timer);window.XLSX?resolve(window.XLSX):reject(new Error('Excel reader failed to initialize'))};
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Excel reader failed to load'))};
    document.head.appendChild(script);
  }).catch(error=>{xlsxLibraryPromise=null;throw error});
  return xlsxLibraryPromise;
}
function workbookSheet(book,name){
  const match=(book.SheetNames||[]).find(sheetName=>clean(sheetName).toLowerCase()===clean(name).toLowerCase());
  return match?book.Sheets[match]:null;
}
function workbookRows(book,name){
  const sheet=workbookSheet(book,name);
  return sheet?window.XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true}):[];
}
function importText(value){return clean(value)}
function importTimestamp(batchId,value){
  const match=String(batchId||'').match(/(\d{14})$/);
  if(match){
    const text=match[1],date=new Date(Date.UTC(Number(text.slice(0,4)),Number(text.slice(4,6))-1,Number(text.slice(6,8)),Number(text.slice(8,10)),Number(text.slice(10,12)),Number(text.slice(12,14))));
    if(!Number.isNaN(date.getTime()))return date.toISOString();
  }
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString();
  if(typeof value==='number'&&Number.isFinite(value)){
    const date=new Date(Date.UTC(1899,11,30)+value*86400000);
    if(!Number.isNaN(date.getTime()))return date.toISOString();
  }
  const date=new Date(value);
  return Number.isNaN(date.getTime())?new Date().toISOString():date.toISOString();
}
function importLayout(value,labelCount){
  const key=clean(value).toLowerCase().replace(/\s+/g,'').replace(/×/g,'x');
  const map={'3x3':'3x3','3x2':'3x2','2x3':'2x3','2x2':'2x2','2x1':'2x1','1x2':'2x1','1x1':'1x1','3x4':'3x3'};
  return map[key]||(labelCount<=6?'2x3':'3x3');
}
function buildImportedHistory(book){
  const labelRows=workbookRows(book,'Label History');
  if(!labelRows.length)throw new Error('The workbook does not contain a Label History sheet');
  const generationRows=workbookRows(book,'Generation Log');
  const userRows=workbookRows(book,'Users');
  const generation=new Map(generationRows.map(row=>[importText(row.batchId),row]).filter(entry=>entry[0]));
  const nicknames=new Map(userRows.map(row=>[importText(row.name||row.Name),importText(row.nickname||row.Nickname)]).filter(entry=>entry[0]));
  const grouped=new Map();
  labelRows.forEach(row=>{
    const id=importText(row.batchId);
    if(!id)return;
    if(!grouped.has(id))grouped.set(id,[]);
    grouped.get(id).push(row);
  });
  const batches=[];
  grouped.forEach((rows,id)=>{
    rows.sort((a,b)=>Number(a.labelNo||0)-Number(b.labelNo||0));
    const meta=generation.get(id)||{},first=rows[0]||{};
    const user=importText(meta.user||first.user)||'Unknown user';
    const nickname=importText(meta.nickname||nicknames.get(user))||user.split(/\s+/)[0]||'User';
    const labels=usableLabels(rows.map(row=>({
      prefix:importText(row.prefix).toUpperCase(),
      company:importText(row.companyName||row.penerima),
      attn:importText(row.attn),
      phone:importText(row.phone),
      address:importText(row.address),
      sender:importText(row.sender)||'KSB INDONESIA'
    })));
    if(!labels.length)return;
    batches.push({
      id,
      timestamp:importTimestamp(id,meta.timestamp||first.timestamp),
      user,
      nickname,
      layout:importLayout(meta.layout,labels.length),
      labels,
      source:'Imported Excel history',
      syncState:'pending'
    });
  });
  return batches.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
}
function addImportedUsers(book,batches){
  const candidates=new Map();
  workbookRows(book,'Users').forEach(row=>{
    const name=importText(row.name||row.Name),nickname=importText(row.nickname||row.Nickname)||name.split(/\s+/)[0];
    if(name)candidates.set(name.toLowerCase(),{name,nickname});
  });
  batches.forEach(batch=>{if(batch.user)candidates.set(batch.user.toLowerCase(),{name:batch.user,nickname:batch.nickname||batch.user.split(/\s+/)[0]})});
  let added=0;
  candidates.forEach(candidate=>{
    if(users.some(user=>clean(user.name).toLowerCase()===candidate.name.toLowerCase()))return;
    users.push(candidate);added++;
  });
  if(added){save('ksb-users',users);renderUsers()}
  return added;
}
async function importHistoryWorkbook(file){
  const button=$('importHistory');
  if(!file)return;
  if(button){button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Reading workbook…'}
  try{
    await ensureXlsxLibrary();
    const book=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    const incoming=buildImportedHistory(book),existing=new Set(history.map(batch=>batch.id)),added=incoming.filter(batch=>!existing.has(batch.id));
    addImportedUsers(book,incoming);
    if(!added.length){toast('No new history batches found in this workbook');return}
    history=[...added,...history].filter(batch=>batch?.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,1000);
    save('ksb-history',history);
    rebuildCompanyPrefixes();
    refreshDataSurfaces();
    const labelCount=added.reduce((sum,batch)=>sum+(batch.labels?.length||0),0);
    toast(`Imported ${added.length} batches · ${labelCount} labels`);
    if(connected){
      for(let index=0;index<added.length;index++){
        if(button)button.textContent=`Syncing ${index+1}/${added.length}…`;
        await syncBatch(added[index],false);
      }
      const synced=added.filter(batch=>batch.syncState==='synced').length;
      const pending=added.filter(batch=>batch.syncState==='pending').length;
      const failed=added.filter(batch=>batch.syncState==='failed').length;
      const parts=[`${synced} synced`];
      if(pending)parts.push(`${pending} pending`);
      if(failed)parts.push(`${failed} failed`);
      toast(`Imported ${added.length} batches · ${parts.join(' · ')}`);
    }else{
      toast(`Imported ${added.length} batches locally · sync will resume when connected`);
    }
  }catch(error){
    console.error('History import failed:',error);
    toast(`History import failed: ${error?.message||error}`);
  }finally{
    if(button){button.disabled=false;button.textContent=button.dataset.originalText||'Import history';delete button.dataset.originalText}
    const input=$('historyFile');if(input)input.value='';
  }
}
const importHistoryButton=$('importHistory'),historyFile=$('historyFile');
if(importHistoryButton&&historyFile){
  importHistoryButton.onclick=()=>historyFile.click();
  historyFile.onchange=()=>importHistoryWorkbook(historyFile.files?.[0]);
  const warm=()=>ensureXlsxLibrary().catch(()=>{});
  importHistoryButton.addEventListener('pointerenter',warm,{once:true,passive:true});
  importHistoryButton.addEventListener('focus',warm,{once:true,passive:true});
}
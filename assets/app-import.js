const HISTORY_IMPORT_REVISION='2026-07-13-tracking-history-import-03';
let xlsxLibraryPromise=null;
function ensureXlsxLibrary(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(xlsxLibraryPromise)return xlsxLibraryPromise;
  const sources=['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'];
  xlsxLibraryPromise=new Promise((resolve,reject)=>{
    const trySource=index=>{
      if(index>=sources.length)return reject(new Error('Excel reader failed to load'));
      const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();trySource(index+1)},15000);
      script.src=sources[index];script.async=true;script.dataset.labelprintXlsx='true';
      script.onload=()=>{clearTimeout(timer);if(window.XLSX)resolve(window.XLSX);else{script.remove();trySource(index+1)}};
      script.onerror=()=>{clearTimeout(timer);script.remove();trySource(index+1)};
      document.head.appendChild(script);
    };
    trySource(0);
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
function workbookRowsAny(book,names){
  for(const name of names){const rows=workbookRows(book,name);if(rows.length)return rows}
  return[];
}
const importRowCache=new WeakMap();
function importRowMap(row){
  if(!row||typeof row!=='object')return{};
  if(importRowCache.has(row))return importRowCache.get(row);
  const map={};Object.entries(row).forEach(([key,value])=>{map[clean(key).toLowerCase().replace(/[^a-z0-9]+/g,'')]=value});importRowCache.set(row,map);return map;
}
function importValue(row,names){
  const map=importRowMap(row);
  for(const name of names){const key=clean(name).toLowerCase().replace(/[^a-z0-9]+/g,'');if(Object.prototype.hasOwnProperty.call(map,key)&&map[key]!==''&&map[key]!=null)return map[key]}
  return'';
}
function importText(value){return clean(value)}
function validUtcDate(parts){
  const [year,month,day,hour,minute,second]=parts,date=new Date(Date.UTC(year,month-1,day,hour,minute,second));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day&&date.getUTCHours()===hour&&date.getUTCMinutes()===minute&&date.getUTCSeconds()===second?date:null;
}
function importTimestamp(batchId,value){
  const match=String(batchId||'').match(/(\d{14})$/);
  if(match){
    const text=match[1],parts=[Number(text.slice(0,4)),Number(text.slice(4,6)),Number(text.slice(6,8)),Number(text.slice(8,10)),Number(text.slice(10,12)),Number(text.slice(12,14))],date=validUtcDate(parts);
    if(date)return date.toISOString();
  }
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString();
  if(typeof value==='number'&&Number.isFinite(value)){
    const date=new Date(Date.UTC(1899,11,30)+value*86400000);
    if(!Number.isNaN(date.getTime()))return date.toISOString();
  }
  const text=clean(value),date=text?new Date(text):null;
  return date&&!Number.isNaN(date.getTime())?date.toISOString():new Date().toISOString();
}
function importRowTimestamp(row){
  const direct=importValue(row,['timestamp','datetime','date time']);
  if(direct)return direct;
  const date=importValue(row,['date']),time=importValue(row,['time']);
  return date&&time?`${date} ${time}`:date||time||'';
}
function importLayout(value,labelCount){
  const key=clean(value).toLowerCase().replace(/\s+/g,'').replace(/×/g,'x');
  const map={'3x3':'3x3','3x2':'3x2','2x3':'2x3','2x2':'2x2','2x1':'2x1','1x2':'2x1','1x1':'1x1','3x4':'3x3'};
  return map[key]||(labelCount<=6?'2x3':'3x3');
}
function buildImportedHistory(book){
  const labelRows=workbookRowsAny(book,['Label History','Label Detail']);
  if(!labelRows.length)throw new Error('The workbook does not contain a Label History or Label Detail sheet');
  const generationRows=workbookRowsAny(book,['Generation Log','Batch Detail']);
  const userRows=workbookRowsAny(book,['Users','User Summary']);
  const generation=new Map(generationRows.map(row=>[importText(importValue(row,['batchId','Batch ID','ID'])),row]).filter(entry=>entry[0]));
  const nicknames=new Map(userRows.map(row=>[importText(importValue(row,['name','user'])),importText(importValue(row,['nickname']))]).filter(entry=>entry[0]));
  const grouped=new Map();
  labelRows.forEach(row=>{const id=importText(importValue(row,['batchId','Batch ID','ID']));if(!id)return;if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(row)});
  const batches=[];
  grouped.forEach((rows,id)=>{
    rows.sort((a,b)=>Number(importValue(a,['labelNo','Label no.','Label number'])||0)-Number(importValue(b,['labelNo','Label no.','Label number'])||0));
    const meta=generation.get(id)||{},first=rows[0]||{};
    const user=importText(importValue(meta,['user','name'])||importValue(first,['user','name']))||'Unknown user';
    const nickname=importText(importValue(meta,['nickname'])||nicknames.get(user))||user.split(/\s+/)[0]||'User';
    const labels=usableLabels(rows.map(row=>({
      prefix:importText(importValue(row,['prefix'])).toUpperCase(),
      company:importText(importValue(row,['companyName','penerima','company','full recipient'])),
      invoice:importText(importValue(row,['invoice','invoice number','invoice no','invoiceNo'])),
      courier:importText(importValue(row,['courier','expedition','shipping courier']))||'JNE',
      awb:importText(importValue(row,['awb','resi','awb / resi','tracking number'])),
      attn:importText(importValue(row,['attn','attention'])),
      phone:importText(importValue(row,['phone','telephone'])),
      address:importText(importValue(row,['address'])),
      sender:importText(importValue(row,['sender']))||'KSB INDONESIA'
    })));
    if(!labels.length)return;
    batches.push({
      id,
      timestamp:importTimestamp(id,importRowTimestamp(meta)||importRowTimestamp(first)),
      user,
      nickname,
      layout:importLayout(importValue(meta,['layout'])||importValue(first,['layout']),labels.length),
      labels,
      source:'Imported Excel history',
      syncState:'pending'
    });
  });
  return batches.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
}
function addImportedUsers(book,batches){
  const candidates=new Map();
  workbookRowsAny(book,['Users','User Summary']).forEach(row=>{const name=importText(importValue(row,['name','user'])),nickname=importText(importValue(row,['nickname']))||name.split(/\s+/)[0];if(name)candidates.set(name.toLowerCase(),{name,nickname})});
  batches.forEach(batch=>{if(batch.user)candidates.set(batch.user.toLowerCase(),{name:batch.user,nickname:batch.nickname||batch.user.split(/\s+/)[0]})});
  let added=0;
  candidates.forEach(candidate=>{if(users.some(user=>clean(user.name).toLowerCase()===candidate.name.toLowerCase()))return;users.push(candidate);added++});
  if(added){save('ksb-users',users);renderUsers()}
  return added;
}
function readFileBuffer(file){
  if(typeof file?.arrayBuffer==='function')return file.arrayBuffer();
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('File could not be read'));reader.readAsArrayBuffer(file)});
}
async function importHistoryWorkbook(file){
  const button=$('importHistory');
  if(!file)return;
  if(button){button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Reading workbook…'}
  try{
    await ensureXlsxLibrary();
    const buffer=await readFileBuffer(file),book=window.XLSX.read(buffer,{type:'array',cellDates:true});
    const incoming=buildImportedHistory(book),existing=new Set(history.map(batch=>batch.id)),added=incoming.filter(batch=>!existing.has(batch.id));
    addImportedUsers(book,incoming);
    if(!added.length){toast('No new history batches found in this workbook');return}
    history=[...added,...history].filter(batch=>batch?.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,1000);
    save('ksb-history',history);rebuildCompanyPrefixes();refreshDataSurfaces();
    const labelCount=added.reduce((sum,batch)=>sum+(batch.labels?.length||0),0);toast(`Imported ${added.length} batches · ${labelCount} labels`);
    if(connected){
      for(let index=0;index<added.length;index++){if(button)button.textContent=`Syncing ${index+1}/${added.length}…`;await syncBatch(added[index],false)}
      const synced=added.filter(batch=>batch.syncState==='synced').length,pending=added.filter(batch=>batch.syncState==='pending').length,failed=added.filter(batch=>batch.syncState==='failed').length,parts=[`${synced} synced`];
      if(pending)parts.push(`${pending} pending`);if(failed)parts.push(`${failed} failed`);toast(`Imported ${added.length} batches · ${parts.join(' · ')}`);
    }else toast(`Imported ${added.length} batches locally · sync will resume when connected`);
  }catch(error){console.error('History import failed:',error);toast(`History import failed: ${error?.message||error}`)}finally{
    if(button){button.disabled=false;button.textContent=button.dataset.originalText||'Import history';delete button.dataset.originalText}
    const input=$('historyFile');if(input)input.value='';
  }
}
const importHistoryButton=$('importHistory'),historyFile=$('historyFile');
if(importHistoryButton&&historyFile){
  importHistoryButton.onclick=()=>historyFile.click();historyFile.onchange=()=>importHistoryWorkbook(historyFile.files?.[0]);
  if(!window.LabelPrintPerformance?.lowSpec){
    const warm=()=>ensureXlsxLibrary().catch(()=>{});importHistoryButton.addEventListener('pointerenter',warm,{once:true,passive:true});importHistoryButton.addEventListener('focus',warm,{once:true,passive:true});
  }
}
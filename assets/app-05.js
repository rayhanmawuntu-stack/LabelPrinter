function openModal(id){$(id).classList.add('show')}
function closeModals(){document.querySelectorAll('.modal').forEach(x=>x.classList.remove('show'))}
function review(){
  const rows=usableLabels(labels).slice(0,MAX_LABELS);
  if(!rows.length)return toast('Add at least one recipient before review');
  const wrap=$('reviewWrap');
  wrap.innerHTML=pagesHTML(rows);
  requestAnimationFrame(()=>fitText(wrap));
  openModal('reviewModal');
}
async function waitForPrintAssets(root){
  const images=[...root.querySelectorAll('img')];
  await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
    const done=()=>resolve();
    img.addEventListener('load',done,{once:true});
    img.addEventListener('error',done,{once:true});
    setTimeout(done,1500);
  })));
  if(document.fonts?.ready)await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,800))]);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
function printLabelSignature(rows){
  return JSON.stringify((rows||[]).map(r=>{const n=normalizeLabel(r);return[n.prefix,n.company,n.attn,n.phone,n.address,n.sender,n.courier,n.awb]}));
}
function resolvePrintBatchId(rows){
  const selectedBatch=history.find(b=>b?.id===historySelected);
  if(selectedBatch&&printLabelSignature(selectedBatch.labels)===printLabelSignature(rows))return selectedBatch.id;
  return 'KSB-'+Date.now().toString(36).toUpperCase();
}
function safePrintName(value){return clean(value).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()||'USER'}
function buildPrintTitle(rows){
  const batchId=resolvePrintBatchId(rows);
  const user=safePrintName(currentUser?.name||currentUser?.nickname||'Local User');
  return `LABEL-${safePrintName(batchId)}-${user}`;
}
let pdfLibraryPromise=null;
function ensurePdfLibrary(){
  if(window.jspdf?.jsPDF)return Promise.resolve(window.jspdf);
  if(pdfLibraryPromise)return pdfLibraryPromise;
  pdfLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=setTimeout(()=>{script.remove();reject(new Error('PDF library timed out'))},12000);
    script.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.async=true;
    script.dataset.labelprintPdf='true';
    script.onload=()=>{clearTimeout(timer);window.jspdf?.jsPDF?resolve(window.jspdf):reject(new Error('PDF library failed to initialize'))};
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('PDF library failed to load'))};
    document.head.appendChild(script);
  }).catch(error=>{pdfLibraryPromise=null;throw error});
  return pdfLibraryPromise;
}
let activePrintFrame=null,activePrintUrl='';
function disposePrintFrame(){
  if(activePrintFrame){activePrintFrame.remove();activePrintFrame=null}
  if(activePrintUrl){URL.revokeObjectURL(activePrintUrl);activePrintUrl=''}
}
function openPdfPrintPrompt(blob){
  if(!(blob instanceof Blob))return Promise.reject(new Error('Printable PDF was not created'));
  disposePrintFrame();
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');
    const url=URL.createObjectURL(blob);
    activePrintFrame=frame;
    activePrintUrl=url;
    frame.title='Label print document';
    frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;z-index:-1';
    let started=false;
    const fail=error=>{if(started)return;started=true;clearTimeout(loadTimer);disposePrintFrame();reject(error)};
    const startPrint=()=>{
      if(started)return;
      started=true;
      clearTimeout(loadTimer);
      setTimeout(()=>{
        try{
          const target=frame.contentWindow;
          if(!target)throw new Error('Print frame is unavailable');
          try{target.addEventListener('afterprint',disposePrintFrame,{once:true})}catch{}
          target.focus();
          target.print();
          resolve();
          setTimeout(disposePrintFrame,60000);
        }catch(error){disposePrintFrame();reject(error)}
      },500);
    };
    const loadTimer=setTimeout(startPrint,1800);
    frame.onload=startPrint;
    frame.onerror=()=>fail(new Error('Print document failed to load'));
    frame.src=url;
    document.body.appendChild(frame);
  });
}
async function browserPrintFallback(rows,title){
  const root=$('printRoot');
  root.innerHTML=pagesHTML(rows);
  await waitForPrintAssets(root);
  fitText(root);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const previousTitle=document.title;
  document.title=title;
  let restored=false;
  const restoreTitle=()=>{if(restored)return;restored=true;document.title=previousTitle};
  window.addEventListener('afterprint',restoreTitle,{once:true});
  setTimeout(restoreTitle,30000);
  window.print();
}
async function printNow(){
  const rows=usableLabels(labels).slice(0,MAX_LABELS).map(applyRememberedPrefix);
  if(!rows.length)return toast('Add at least one recipient before printing');
  const title=buildPrintTitle(rows);
  const controls=[$('print'),$('printDirect')].filter(Boolean);
  controls.forEach(button=>{button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Preparing print…'});
  try{
    await ensurePdfLibrary();
    if(typeof window.generateLabelPdf!=='function')throw new Error('PDF generator did not load');
    const result=await window.generateLabelPdf({rows,layoutKey:layout,layoutDef:LAYOUTS[layout],filename:title,logoUrl:CONFIG.logo,output:'blob'});
    await openPdfPrintPrompt(result.blob);
    toast(`Print dialog opened · ${result.pageCount} page${result.pageCount===1?'':'s'}`);
  }catch(error){
    console.error('PDF print prompt failed:',error);
    toast('Opening browser print dialog');
    await browserPrintFallback(rows,title);
  }finally{
    controls.forEach(button=>{button.disabled=false;button.textContent=button.dataset.originalText||'Print';delete button.dataset.originalText});
  }
}
function bulkDuplicateKey(row){
  const n=normalizeLabel(row);
  return[n.prefix,n.company,n.attn,n.phone,n.address,n.sender,n.courier,n.awb].map(value=>clean(value).toUpperCase().replace(/\s+/g,' ')).join('|');
}
function importRows(){
  const parsed=$('paste').value.split(/\r?\n/).filter(Boolean).map(line=>{
    const c=line.split('\t');
    const raw=(c[1]||'').trim();
    const companyMatch=raw.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i);
    const addressAndPhone=(c[5]||'').trim();
    const phoneMatch=addressAndPhone.match(/\(([^()]*)\)\s*$/);
    return{
      prefix:companyMatch?companyMatch[1].toUpperCase():'',
      company:companyMatch?companyMatch[2]:raw,
      courier:(c[3]||'').trim()||'JNE',
      awb:(c[4]||'').trim(),
      attn:(c[6]||'').trim(),
      phone:phoneMatch?phoneMatch[1].trim():'',
      address:phoneMatch?addressAndPhone.slice(0,phoneMatch.index).trim():addressAndPhone,
      sender:'KSB INDONESIA'
    };
  }).map(normalizeLabel).map(applyRememberedPrefix).filter(r=>r.company&&!/^(penerima|recipient|company)$/i.test(r.company));
  if(!parsed.length)return toast('No valid rows detected');
  const seen=new Set();
  const unique=parsed.filter(row=>{const key=bulkDuplicateKey(row);if(seen.has(key))return false;seen.add(key);return true});
  const duplicateCount=parsed.length-unique.length;
  const rows=unique.slice(0,MAX_LABELS);
  rows.forEach(row=>rememberCompanyPrefix(row,false));
  save(COMPANY_PREFIX_KEY,companyPrefixes);
  labels=rows;
  selected=0;
  save('ksb-labels',labels);
  closeModals();
  renderAll();
  const limited=unique.length>MAX_LABELS;
  const tracked=rows.filter(row=>clean(row.awb)).length;
  let message=limited?`Imported first ${MAX_LABELS} of ${unique.length} unique labels`:`${rows.length} labels imported`;
  if(tracked)message+=` · ${tracked} AWB${tracked===1?'':'s'}`;
  if(duplicateCount)message+=` · ${duplicateCount} duplicate${duplicateCount===1?'':'s'} removed`;
  toast(message);
}
function settings(){const e=$('endpoint');e.value=endpoint();$('connectionResult').textContent=connected?'Connected to Google Sheets.':(window.__lastSheetsError?`Last error: ${window.__lastSheetsError}`:'Connection not tested.');openModal('settingsModal')}
async function testConnection(){
  const result=$('connectionResult');
  try{const u=$('endpoint').value.trim();new URL(u);localStorage.setItem('ksb-endpoint',u);localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);result.textContent='Testing connection…';const r=await apiGet('ping');result.textContent=`Connected to ${r.spreadsheetName||'Google Sheets'} · API ${r.apiVersion||'unknown'}.`;window.__lastSheetsError=''}catch(e){window.__lastSheetsError=String(e?.message||e);result.textContent='Connection failed: '+window.__lastSheetsError}
}
async function saveConnection(){localStorage.setItem('ksb-endpoint',$('endpoint').value.trim());localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);closeModals();await sync()}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('avatar').onclick=()=>{$('entry').classList.remove('hidden');renderUsers()};
$('settings').onclick=$('status').onclick=settings;
$('addRecipient').onclick=addLabel;
$('clearAll').onclick=clearAllLabels;
$('fastInput').onclick=()=>openModal('inputModal');
$('importRows').onclick=importRows;
$('review').onclick=review;
$('generate').onclick=()=>{const b=saveBatch();if(!b)return;review();toast(`${b.id} generated`)};
$('print').onclick=printNow;
$('printDirect').onclick=printNow;
[$('print'),$('printDirect')].filter(Boolean).forEach(button=>{
  const warm=()=>ensurePdfLibrary().catch(()=>{});
  button.addEventListener('pointerenter',warm,{once:true,passive:true});
  button.addEventListener('focus',warm,{once:true,passive:true});
});
$('remove').onclick=removeLabel;
$('duplicate').onclick=duplicate;
$('newBatch').onclick=()=>switchView('create');
$('search').oninput=debounce(renderCards,90);
$('range').onchange=renderAnalytics;
$('testConnection').onclick=testConnection;
$('saveConnection').onclick=saveConnection;
document.querySelectorAll('.close,.closeModal').forEach(b=>b.onclick=closeModals);
document.querySelectorAll('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)closeModals()});
['prefix','company','attn','phone','address'].forEach(id=>$(id).oninput=e=>update(id,e.target.value));
$('sender').onchange=e=>{const custom=e.target.value==='__CUSTOM__';$('customField').classList.toggle('hidden',!custom);if(!custom)update('sender',e.target.value)};
$('customSender').oninput=e=>update('sender',e.target.value);
window.onresize=debounce(fitPreview,120);
window.onkeydown=e=>{if(e.key==='Escape')closeModals()};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!connected)sync()});
renderUsers();
renderAll();
refreshDataSurfaces();
$('entry').classList.add('show');
const scheduleSync=()=>sync();
if('requestIdleCallback'in window)requestIdleCallback(scheduleSync,{timeout:1200});else setTimeout(scheduleSync,120);
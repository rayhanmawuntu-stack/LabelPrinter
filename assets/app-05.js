function openModal(id){$(id).classList.add('show')}
function closeModals(){document.querySelectorAll('.modal').forEach(x=>x.classList.remove('show'))}
function review(){
  const rows=usableLabels(labels);
  if(!rows.length)return toast('Add at least one recipient before review');
  const wrap=$('reviewWrap');
  wrap.innerHTML=pagesHTML(rows);
  requestAnimationFrame(()=>fitText(wrap));
  openModal('reviewModal');
}
function printNow(){
  const rows=usableLabels(labels);
  if(!rows.length)return toast('Add at least one recipient before printing');
  $('printRoot').innerHTML=pagesHTML(rows);
  requestAnimationFrame(()=>{fitText($('printRoot'));window.print()});
}
function importRows(){
  const rows=$('paste').value.split(/\r?\n/).filter(Boolean).map(line=>{const c=line.split('\t'),raw=(c[1]||'').trim(),m=raw.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i),f=(c[5]||'').trim(),p=f.match(/\(([^()]*)\)\s*$/);return{prefix:m?m[1].toUpperCase():'',company:m?m[2]:raw,attn:(c[6]||'').trim(),phone:p?p[1].trim():'',address:p?f.slice(0,p.index).trim():f,sender:'KSB INDONESIA'}}).map(normalizeLabel).filter(r=>r.company&&!/^(penerima|recipient|company)$/i.test(r.company));
  if(!rows.length)return toast('No valid rows detected');
  labels=rows;
  selected=0;
  save('ksb-labels',labels);
  closeModals();
  renderAll();
  toast(`${rows.length} labels imported`);
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
$('fastInput').onclick=()=>openModal('inputModal');
$('importRows').onclick=importRows;
$('review').onclick=review;
$('generate').onclick=()=>{const b=saveBatch();if(!b)return;review();toast(`${b.id} generated`)};
$('print').onclick=printNow;
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
renderHistory();
renderAnalytics();
$('entry').classList.add('show');
sync();

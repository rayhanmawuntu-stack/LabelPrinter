function saveBatch(){
  const printable=usableLabels(labels).slice(0,MAX_LABELS).map(applyRememberedPrefix);
  if(!printable.length){toast('Add at least one recipient before generating');return null}
  printable.forEach(row=>rememberCompanyPrefix(row,false));
  save(COMPANY_PREFIX_KEY,companyPrefixes);
  const now=new Date(),batch={id:'KSB-'+now.getTime().toString(36).toUpperCase(),timestamp:now.toISOString(),user:currentUser?.name||'Local User',nickname:currentUser?.nickname||'User',layout,labels:clone(printable),syncState:'pending'};
  history=[batch,...history.filter(x=>x.id!==batch.id)].slice(0,1000);
  historySelected=batch.id;
  save('ksb-history',history);
  syncBatch(batch);
  refreshDataSurfaces();
  return batch;
}
function renderDashboardHistory(){
  const root=$('dashboardHistory');
  if(!root)return;
  const recent=history.slice(0,4);
  root.className='recent-list';
  root.innerHTML=recent.length?recent.map(b=>{const when=new Date(b.timestamp),state=b.syncState||'synced';return `<button class="recent-row" data-open-batch="${esc(b.id)}"><span class="recent-icon">▤</span><span><b>${esc(b.id)}</b><small>${isNaN(when)?'Unknown date':when.toLocaleDateString()} · ${b.labels.length} label${b.labels.length===1?'':'s'}</small></span><span><em class="sync ${state}" title="${esc(state)}" aria-label="${esc(state)}"></em></span></button>`}).join(''):'<div class="empty-mini">No generated batches yet.</div>';
  root.querySelectorAll('[data-open-batch]').forEach(btn=>btn.onclick=()=>{historySelected=btn.dataset.openBatch;switchView('history');renderHistory()});
}
function renderHistory(){
  history=(Array.isArray(history)?history:[]).filter(b=>b?.id).map(b=>({...b,labels:Array.isArray(b.labels)?b.labels:[]}));
  const total=history.reduce((s,b)=>s+b.labels.length,0),unique=new Set(history.flatMap(b=>b.labels.map(full).filter(Boolean))).size;
  $('historyBadge').textContent=history.length;
  $('historyCount').textContent=`${history.length} batches`;
  $('historyKpis').innerHTML=[['Saved batches',history.length,'dark'],['Total labels',total,'blue'],['Recipients',unique,'lime'],['Latest layout',history[0]?LAYOUTS[history[0].layout]?.label||history[0].layout:'—','']].map(x=>`<article class="metric ${x[2]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${connected?'Google Sheets + cache':'Local cache'}</small></article>`).join('');
  const list=$('historyList');
  list.innerHTML=history.length?history.map(b=>{const state=b.syncState||'synced';return `<button class="history-row ${b.id===historySelected?'active':''}" data-batch="${b.id}"><span class="batch-icon">${LAYOUTS[b.layout]?.label||b.layout}</span><span><b>${esc(b.id)} <em class="sync ${state}" title="${esc(state)}" aria-label="${esc(state)}"></em></b><small>${b.labels.slice(0,2).map(full).filter(Boolean).map(esc).join(' · ')||'No recipient preview'}</small></span><b>${b.labels.length}</b></button>`}).join(''):`<div class="empty">No generated batches yet.</div>`;
  list.querySelectorAll('[data-batch]').forEach(b=>b.onclick=()=>{historySelected=b.dataset.batch;renderHistory()});
  renderDetail();
  renderDashboardHistory();
}
function loadHistoryBatch(batch){
  const restored=usableLabels(clone(batch?.labels||[])).slice(0,MAX_LABELS).map(applyRememberedPrefix);
  if(!restored.length)return toast('This batch has no usable labels to load');
  restored.forEach(row=>rememberCompanyPrefix(row,false));
  save(COMPANY_PREFIX_KEY,companyPrefixes);
  labels=restored;
  selected=0;
  if(batch.layout&&LAYOUTS[batch.layout]){
    layout=batch.layout;
    localStorage.setItem('ksb-layout',layout);
  }
  save('ksb-labels',labels);
  switchView('create');
  renderAll();
  requestAnimationFrame(()=>requestAnimationFrame(fitPreview));
  toast(`Loaded ${labels.length} label${labels.length===1?'':'s'} from ${batch.id}`);
}
function renderDetail(){
  const detail=$('historyDetail');
  const b=history.find(x=>x.id===historySelected)||history[0];
  if(!b){detail.innerHTML='<div class="empty">Select a batch to inspect it.</div>';return}
  const when=new Date(b.timestamp);
  detail.innerHTML=`<div class="detail-top"><div><span class="detail-kicker">Batch details</span><h2>${esc(b.id)}</h2><p>${isNaN(when)?'Unknown date':when.toLocaleString()} · ${esc(b.user||'Unknown user')}</p></div><span class="detail-count">${(b.labels||[]).length} label${(b.labels||[]).length===1?'':'s'}</span></div><div class="detail-list">${(b.labels||[]).map((r,i)=>`<div class="detail-line"><span><b>${String(i+1).padStart(2,'0')} · ${esc(full(r)||'Blank recipient')}</b><br>${esc(r.attn||r.address||'')}</span><span>${esc(r.phone||'')}</span></div>`).join('')}</div><div class="modal-actions"><button class="btn light" id="deleteBatch" type="button">Delete</button><button class="btn dark" id="loadBatch" type="button">Load batch</button></div>`;
  const loadButton=detail.querySelector('#loadBatch');
  const deleteButton=detail.querySelector('#deleteBatch');
  loadButton.onclick=()=>loadHistoryBatch(b);
  deleteButton.onclick=async()=>{history=history.filter(x=>x.id!==b.id);save('ksb-history',history);if(connected)post('deleteBatch',{id:b.id}).catch(()=>{});historySelected=null;refreshDataSurfaces()};
}
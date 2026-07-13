function historySyncState(value){return['synced','pending','failed'].includes(value)?value:'pending'}
function saveBatch(){
  const printable=usableLabels(labels).slice(0,MAX_LABELS).map(row=>applyRememberedCompanyDefaults(row,false));
  if(!printable.length){toast('Add at least one recipient before generating');return null}
  printable.forEach(row=>rememberCompanyDefaults(row,false));
  persistCompanyMemory();
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
  root.innerHTML=recent.length?recent.map(b=>{const when=new Date(b.timestamp),state=historySyncState(b.syncState),tracked=(b.labels||[]).filter(r=>clean(r.awb)).length;return `<button class="recent-row" data-open-batch="${esc(b.id)}"><span class="recent-icon">▤</span><span><b>${esc(b.id)}</b><small>${isNaN(when)?'Unknown date':when.toLocaleDateString()} · ${b.labels.length} label${b.labels.length===1?'':'s'}${tracked?` · ${tracked} tracked`:''}</small></span><span><em class="sync ${state}" title="${state}" aria-label="${state}"></em></span></button>`}).join(''):'<div class="empty-mini">No generated batches yet.</div>';
  root.querySelectorAll('[data-open-batch]').forEach(btn=>btn.onclick=()=>{historySelected=btn.dataset.openBatch;switchView('history');renderHistory()});
}
function renderHistory(){
  history=(Array.isArray(history)?history:[]).filter(b=>b?.id).map(b=>({...b,labels:Array.isArray(b.labels)?b.labels.map(normalizeLabel):[]}));
  const total=history.reduce((s,b)=>s+b.labels.length,0),unique=new Set(history.flatMap(b=>b.labels.map(full).filter(Boolean))).size,tracked=history.reduce((s,b)=>s+b.labels.filter(r=>clean(r.awb)).length,0);
  $('historyBadge').textContent=history.length;
  $('historyCount').textContent=`${history.length} batches`;
  $('historyKpis').innerHTML=[['Saved batches',history.length,'primary'],['Total labels',total,'accent'],['Recipients',unique,'soft'],['Tracked AWBs',tracked,'neutral']].map(x=>`<article class="metric ${x[2]}"><span>${x[0]}</span><strong>${esc(x[1])}</strong><small>${connected?'Google Sheets + cache':'Local cache'}</small></article>`).join('');
  const list=$('historyList');
  list.innerHTML=history.length?history.map(b=>{const state=historySyncState(b.syncState),layoutName=LAYOUTS[b.layout]?.label||clean(b.layout)||'Unknown',trackedCount=b.labels.filter(r=>clean(r.awb)).length;return `<button class="history-row ${b.id===historySelected?'active':''}" data-batch="${esc(b.id)}"><span class="batch-icon">${esc(layoutName)}</span><span><b>${esc(b.id)} <em class="sync ${state}" title="${state}" aria-label="${state}"></em></b><small>${b.labels.slice(0,2).map(full).filter(Boolean).map(esc).join(' · ')||'No recipient preview'}${trackedCount?` · ${trackedCount} AWB${trackedCount===1?'':'s'}`:''}</small></span><b>${b.labels.length}</b></button>`}).join(''):`<div class="empty">No generated batches yet.</div>`;
  list.querySelectorAll('[data-batch]').forEach(b=>b.onclick=()=>{historySelected=b.dataset.batch;renderHistory()});
  renderDetail();
  renderDashboardHistory();
}
function loadHistoryBatch(batch){
  const restored=usableLabels(clone(batch?.labels||[])).slice(0,MAX_LABELS).map(row=>applyRememberedCompanyDefaults(row,false));
  if(!restored.length)return toast('This batch has no usable labels to load');
  restored.forEach(row=>rememberCompanyDefaults(row,false));
  persistCompanyMemory();
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
  detail.innerHTML=`<div class="detail-top"><div><span class="detail-kicker">Batch details</span><h2>${esc(b.id)}</h2><p>${isNaN(when)?'Unknown date':when.toLocaleString()} · ${esc(b.user||'Unknown user')}</p></div><span class="detail-count">${(b.labels||[]).length} label${(b.labels||[]).length===1?'':'s'}</span></div><div class="detail-list">${(b.labels||[]).map((raw,i)=>{const r=normalizeLabel(raw),tracking=r.awb?`<div class="detail-tracking"><span class="awb-chip">${esc(r.courier)} · ${esc(r.awb)}</span>${window.LabelPrintAwb?.buttonHTML?.(r,'Track')||''}</div>`:'';return `<div class="detail-line"><span><b>${String(i+1).padStart(2,'0')} · ${esc(full(r)||'Blank recipient')}</b><br>${esc(r.attn||r.address||'')}</span><span class="detail-phone">${esc(r.phone||'')}</span>${tracking}</div>`}).join('')}</div><div class="modal-actions"><button class="btn light" id="deleteBatch" type="button">Delete</button><button class="btn dark" id="loadBatch" type="button">Load batch</button></div>`;
  const loadButton=detail.querySelector('#loadBatch');
  const deleteButton=detail.querySelector('#deleteBatch');
  loadButton.onclick=()=>loadHistoryBatch(b);
  deleteButton.onclick=async()=>{
    const deleted=deletedBatchIds();
    deleted.add(b.id);
    save(DELETED_BATCHES_KEY,[...deleted]);
    history=history.filter(x=>x.id!==b.id);
    save('ksb-history',history);
    historySelected=null;
    refreshDataSurfaces();
    if(connected)await flushDeletedBatches();
    toast('Batch deleted');
  };
}

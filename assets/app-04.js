function saveBatch(){
  const printable=usableLabels(labels);
  if(!printable.length){toast('Add at least one recipient before generating');return null}
  const now=new Date(),batch={id:'KSB-'+now.getTime().toString(36).toUpperCase(),timestamp:now.toISOString(),user:currentUser?.name||'Local User',nickname:currentUser?.nickname||'User',layout,labels:clone(printable),syncState:'pending'};
  history=[batch,...history.filter(x=>x.id!==batch.id)].slice(0,1000);
  historySelected=batch.id;
  save('ksb-history',history);
  syncBatch(batch);
  renderHistory();
  renderAnalytics();
  return batch;
}
function renderHistory(){
  history=(Array.isArray(history)?history:[]).filter(b=>b?.id).map(b=>({...b,labels:Array.isArray(b.labels)?b.labels:[]}));
  const total=history.reduce((s,b)=>s+b.labels.length,0),unique=new Set(history.flatMap(b=>b.labels.map(full).filter(Boolean))).size;
  $('historyBadge').textContent=history.length;
  $('historyCount').textContent=`${history.length} batches`;
  $('historyKpis').innerHTML=[['Saved batches',history.length,'dark'],['Total labels',total,'blue'],['Recipients',unique,'lime'],['Latest layout',history[0]?LAYOUTS[history[0].layout]?.label||history[0].layout:'—','']].map(x=>`<article class="metric ${x[2]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${connected?'Google Sheets + cache':'Local cache'}</small></article>`).join('');
  $('historyList').innerHTML=history.length?history.map(b=>`<button class="history-row ${b.id===historySelected?'active':''}" data-batch="${b.id}"><span class="batch-icon">${LAYOUTS[b.layout]?.label||b.layout}</span><span><b>${esc(b.id)} <em class="sync ${b.syncState||'synced'}">${b.syncState||'synced'}</em></b><small>${b.labels.slice(0,2).map(full).filter(Boolean).map(esc).join(' · ')||'No recipient preview'}</small></span><b>${b.labels.length}</b></button>`).join(''):`<div class="empty">No generated batches yet.</div>`;
  document.querySelectorAll('[data-batch]').forEach(b=>b.onclick=()=>{historySelected=b.dataset.batch;renderHistory()});
  renderDetail();
}
function renderDetail(){
  const b=history.find(x=>x.id===historySelected)||history[0];
  if(!b)return $('historyDetail').innerHTML='<div class="empty">Select a batch to inspect it.</div>';
  const when=new Date(b.timestamp);
  $('historyDetail').innerHTML=`<h2>${esc(b.id)}</h2><p>${isNaN(when)?'Unknown date':when.toLocaleString()} · ${esc(b.user||'Unknown user')}</p><div class="detail-list">${(b.labels||[]).map((r,i)=>`<div class="detail-line"><span><b>${String(i+1).padStart(2,'0')} · ${esc(full(r)||'Blank recipient')}</b><br>${esc(r.attn||'')}</span><span>${esc(r.phone||'')}</span></div>`).join('')}</div><div class="modal-actions"><button class="btn light" id="deleteBatch">Delete</button><button class="btn dark" id="loadBatch">Load batch</button></div>`;
  $('loadBatch').onclick=()=>{labels=clone(b.labels||[]);layout=b.layout||layout;selected=0;save('ksb-labels',labels);renderAll();switchView('create')};
  $('deleteBatch').onclick=async()=>{history=history.filter(x=>x.id!==b.id);save('ksb-history',history);if(connected)post('deleteBatch',{id:b.id}).catch(()=>{});historySelected=null;renderHistory();renderAnalytics()};
}

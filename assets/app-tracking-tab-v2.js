(()=>{
  const nav=document.querySelector('.nav');
  const analyticsButton=nav?.querySelector('[data-view="analytics"]');
  if(nav&&!nav.querySelector('[data-view="tracking"]')){
    const button=document.createElement('button');
    button.type='button';
    button.dataset.view='tracking';
    button.title='Tracking';
    button.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 10h15v12H5zM20 14h4l3 4v4h-7zM9 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM23 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg><span>Tracking</span><span class="badge" id="trackingBadge">0</span>';
    nav.insertBefore(button,analyticsButton||null);
  }

  const analyticsView=$('analyticsView');
  if(analyticsView&&!$('trackingView')){
    const section=document.createElement('section');
    section.className='view hidden';
    section.id='trackingView';
    section.innerHTML=`
      <div class="page-head tracking-page-head">
        <div>
          <p class="kicker">Shipment workspace</p>
          <h1 class="page-title">Tracking</h1>
          <p>Filter saved AWBs by Penerima, invoice number, or AWB number.</p>
        </div>
        <div class="actions tracking-head-actions">
          <button class="btn light" id="copyVisibleAwbs" type="button">Copy visible AWBs</button>
          <button class="btn dark" id="refreshTracking" type="button">Refresh list</button>
        </div>
      </div>
      <div class="tracking-kpis" id="trackingKpis"></div>
      <section class="panel tracking-list-panel">
        <div class="panel-head tracking-list-head">
          <div class="tracking-list-copy"><p class="kicker">Shipment register</p><h2>Saved shipments</h2><p id="trackingCount">0 shipments</p></div>
          <div class="tracking-filters">
            <label class="tracking-search"><span>⌕</span><input id="trackingSearch" type="search" placeholder="Search Penerima, invoice, or AWB…" autocomplete="off"></label>
            <select class="control" id="trackingScope" aria-label="Tracking source"><option value="all">All sources</option><option value="current">Current batch</option><option value="history">Saved history</option></select>
            <select class="control" id="trackingCourier" aria-label="Courier filter"><option value="all">All couriers</option></select>
            <select class="control" id="trackingStatus" aria-label="Shipment status filter"><option value="all">All statuses</option><option value="pending">Not marked</option><option value="processing">On process</option><option value="delivered">Delivered</option></select>
          </div>
        </div>
        <div class="tracking-table-shell">
          <table class="tracking-table">
            <thead><tr><th>Shipment</th><th>Invoice</th><th>Courier</th><th>AWB / resi</th><th>Source</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
            <tbody id="trackingList"></tbody>
          </table>
          <div class="tracking-empty hidden" id="trackingEmpty"><span>⌕</span><h3>No shipments found</h3><p>Search by Penerima, invoice number, or AWB number.</p></div>
        </div>
        <nav class="tracking-pagination hidden" id="trackingPagination" aria-label="Shipment pages"></nav>
      </section>`;
    analyticsView.parentNode.insertBefore(section,analyticsView);
  }

  const lowSpec=!!window.LabelPrintPerformance?.lowSpec;
  // Keep the table deliberately small. Rendering hundreds of interactive rows at
  // once is the largest avoidable cost on low-spec PCs.
  const pageSize=lowSpec?12:15;
  const TRACKING_STATUS_STORAGE_KEY='ksb-tracking-statuses-v1';
  const TRACKING_STATUS_VALUES=new Set(['processing','delivered']);
  let trackingPage=1;
  let refreshedAt=null;
  let visibleShipments=[];
  let trackingDataRevision=0;
  let shipmentCache={revision:-1,shipments:[]};
  let kpiSignature='';
  let badgeRefreshId=0;
  let remoteStatusSupported=null;
  let statusRefreshPromise=null;

  function normalizeTrackingStatus(value){
    const raw=typeof value==='string'?{status:value}:(value&&typeof value==='object'?value:{});
    const status=clean(raw.status).toLowerCase();
    if(!TRACKING_STATUS_VALUES.has(status))return null;
    return{
      status,
      updatedAt:clean(raw.updatedAt),
      updatedBy:clean(raw.updatedBy),
      syncState:raw.syncState==='pending'?'pending':'synced'
    };
  }

  function normalizeTrackingStatusMap(source){
    const next={};
    if(!source||typeof source!=='object'||Array.isArray(source))return next;
    Object.entries(source).forEach(([key,value])=>{const record=normalizeTrackingStatus(value);if(record&&clean(key))next[clean(key)]=record});
    return next;
  }

  let trackingStatuses=normalizeTrackingStatusMap(load(TRACKING_STATUS_STORAGE_KEY,{}));

  function persistTrackingStatuses(){save(TRACKING_STATUS_STORAGE_KEY,trackingStatuses)}
  function trackingStatusRecord(shipment){return trackingStatuses[shipment?.key]||{status:'pending',updatedAt:'',updatedBy:'',syncState:'synced'}}
  function trackingStatusLabel(status){return status==='processing'?'On process':status==='delivered'?'Delivered':'Not marked'}
  function statusTimestamp(value){const time=new Date(value||0).getTime();return Number.isFinite(time)?time:0}

  function applyRemoteTrackingStatuses(rows){
    let changed=false;
    (Array.isArray(rows)?rows:[]).forEach(item=>{
      const courier=clean(item?.courier).toUpperCase()||'JNE';
      const awb=normalizeAwb(item?.awb);
      const key=clean(item?.key)||(awb?`${courier}|${awb}`:'');
      const remote=normalizeTrackingStatus({...item,syncState:'synced'});
      if(!key||!remote)return;
      const local=trackingStatuses[key];
      const remoteTime=statusTimestamp(remote.updatedAt),localTime=statusTimestamp(local?.updatedAt);
      if(!local||remoteTime>localTime||(remoteTime===localTime&&local.syncState!=='pending')){
        if(JSON.stringify(local)!==JSON.stringify(remote)){trackingStatuses[key]=remote;changed=true}
      }
    });
    if(changed)persistTrackingStatuses();
    return changed;
  }

  async function syncPendingTrackingStatuses(){
    if(!connected||remoteStatusSupported!==true)return false;
    let changed=false;
    for(const [key,record] of Object.entries(trackingStatuses)){
      if(record.syncState!=='pending')continue;
      const separator=key.indexOf('|');
      const courier=separator>=0?key.slice(0,separator):'JNE';
      const awb=separator>=0?key.slice(separator+1):key;
      try{
        const result=await post('saveShipmentStatus',{key,courier,awb,status:record.status,updatedAt:record.updatedAt,updatedBy:record.updatedBy});
        const current=trackingStatuses[key];
        if(!result?.queued&&current?.status===record.status&&current?.updatedAt===record.updatedAt){
          const server=normalizeTrackingStatus({...result?.shipmentStatus,syncState:'synced'});
          trackingStatuses[key]=server&&statusTimestamp(server.updatedAt)>=statusTimestamp(current.updatedAt)?server:{...current,syncState:'synced'};
          changed=true;
        }else if(!result?.queued&&result?.shipmentStatus)changed=applyRemoteTrackingStatuses([result.shipmentStatus])||changed;
      }catch(error){console.warn('Shipment status sync failed:',error)}
    }
    if(changed)persistTrackingStatuses();
    return changed;
  }

  async function refreshTrackingStatuses(){
    if(statusRefreshPromise)return statusRefreshPromise;
    statusRefreshPromise=(async()=>{
      try{
        const result=await apiGet('getShipmentStatuses');
        remoteStatusSupported=true;
        const changed=applyRemoteTrackingStatuses(result?.shipmentStatuses);
        const synced=await syncPendingTrackingStatuses();
        if((changed||synced)&&active==='tracking')renderTracking();
        return true;
      }catch(error){
        if(/Unknown GET action/i.test(String(error?.message||error)))remoteStatusSupported=false;
        else console.warn('Shipment statuses could not be refreshed:',error);
        return false;
      }finally{statusRefreshPromise=null}
    })();
    return statusRefreshPromise;
  }

  function markShipmentStatus(shipment,status){
    if(!shipment||!TRACKING_STATUS_VALUES.has(status))return;
    const current=trackingStatusRecord(shipment);
    if(current.status===status)return toast(`Shipment is already marked ${trackingStatusLabel(status).toLowerCase()}`);
    trackingStatuses[shipment.key]={status,updatedAt:new Date().toISOString(),updatedBy:clean(currentUser?.name||currentUser?.nickname||'Local user'),syncState:'pending'};
    persistTrackingStatuses();
    renderTracking();
    toast(status==='processing'?'Shipment marked as on process':'Shipment marked as delivered');
    if(connected){
      if(remoteStatusSupported===true)syncPendingTrackingStatuses();
      else if(remoteStatusSupported===null)refreshTrackingStatuses();
    }
  }

  function trackingKey(row){
    const r=normalizeLabel(row||{});
    return `${r.courier||'JNE'}|${r.awb}`;
  }

  function invalidateTracking(){
    trackingDataRevision++;
    shipmentCache={revision:-1,shipments:[]};
  }

  function collectShipments(force=false){
    if(!force&&shipmentCache.revision===trackingDataRevision)return shipmentCache.shipments;

    const map=new Map();
    const absorb=(raw,meta)=>{
      const row=normalizeLabel(raw||{});
      if(!row.awb)return;
      const key=trackingKey(row);
      let shipment=map.get(key);
      if(!shipment){
        shipment={key,row,current:false,currentIndex:null,batches:new Set(),recipients:new Set(),invoices:new Set(),awbs:new Set(),latestBatch:'',latestTimestamp:'',latestUser:'',occurrences:0,searchText:''};
        map.set(key,shipment);
      }
      shipment.occurrences++;
      if(full(row))shipment.recipients.add(full(row));
      if(row.invoice)shipment.invoices.add(row.invoice);
      shipment.awbs.add(row.awb);
      if(meta.source==='current'){
        shipment.current=true;
        shipment.currentIndex=meta.index;
        shipment.row=row;
      }else{
        if(meta.batchId)shipment.batches.add(meta.batchId);
        const incomingTime=new Date(meta.timestamp||0).getTime()||0;
        const storedTime=new Date(shipment.latestTimestamp||0).getTime()||0;
        if(!shipment.latestTimestamp||incomingTime>=storedTime){
          shipment.latestTimestamp=meta.timestamp||'';
          shipment.latestBatch=meta.batchId||'';
          shipment.latestUser=meta.user||'';
          if(!shipment.current)shipment.row=row;
        }
      }
    };

    (Array.isArray(labels)?labels:[]).forEach((row,index)=>absorb(row,{source:'current',index}));
    (Array.isArray(history)?history:[]).forEach(batch=>{
      (Array.isArray(batch?.labels)?batch.labels:[]).forEach(row=>absorb(row,{source:'history',batchId:clean(batch.id),timestamp:batch.timestamp,user:batch.user}));
    });

    const shipments=[...map.values()].map(shipment=>{
      shipment.searchText=[...shipment.recipients,...shipment.invoices,...shipment.awbs].join(' ').toLowerCase();
      return shipment;
    }).sort((a,b)=>{
      if(a.current!==b.current)return a.current?-1:1;
      return(new Date(b.latestTimestamp||0).getTime()||0)-(new Date(a.latestTimestamp||0).getTime()||0);
    });

    shipmentCache={revision:trackingDataRevision,shipments};
    return shipments;
  }

  function updateTrackingBadge(shipments=collectShipments()){
    const badge=$('trackingBadge');
    if(badge)badge.textContent=shipments.length>99?'99+':String(shipments.length);
  }

  function scheduleTrackingBadge(){
    if(lowSpec||active==='tracking'||badgeRefreshId)return;
    const run=()=>{badgeRefreshId=0;updateTrackingBadge()};
    badgeRefreshId=window.LabelPrintPerformance?.schedule?.(run,1800)||setTimeout(run,900);
  }

  function sourceLabel(shipment){
    if(shipment.current&&shipment.batches.size)return `Current batch · ${shipment.batches.size} saved batch${shipment.batches.size===1?'':'es'}`;
    if(shipment.current)return'Current batch';
    return shipment.batches.size===1?'Saved history':`${shipment.batches.size} saved batches`;
  }

  function dateLabel(value){
    const date=new Date(value);
    return value&&!isNaN(date)?date.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'No saved date';
  }

  function filteredShipments(shipments){
    const query=clean($('trackingSearch')?.value).toLowerCase();
    const terms=query.split(/\s+/).filter(Boolean);
    const scope=$('trackingScope')?.value||'all';
    const courier=$('trackingCourier')?.value||'all';
    const status=$('trackingStatus')?.value||'all';
    return shipments.filter(shipment=>{
      if(scope==='current'&&!shipment.current)return false;
      if(scope==='history'&&!shipment.batches.size)return false;
      if(courier!=='all'&&shipment.row.courier!==courier)return false;
      if(status!=='all'&&trackingStatusRecord(shipment).status!==status)return false;
      return !terms.length||terms.every(term=>shipment.searchText.includes(term));
    });
  }

  function renderCourierOptions(shipments){
    const select=$('trackingCourier');
    if(!select)return;
    const selected=select.value||'all';
    const couriers=[...new Set(shipments.map(item=>item.row.courier).filter(Boolean))].sort();
    const next='<option value="all">All couriers</option>'+couriers.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    if(select.innerHTML!==next)select.innerHTML=next;
    select.value=couriers.includes(selected)?selected:'all';
  }

  function invoiceLabel(shipment,{prefix=true}={}){
    const values=[...shipment.invoices];
    if(!values.length)return'—';
    const text=values.length<=2?values.join(' · '):`${values.slice(0,2).join(' · ')} +${values.length-2}`;
    return prefix?`Invoice ${text}`:text;
  }

  function icon(name){
    const paths={
      copy:'<rect x="8" y="8" width="10" height="10" rx="2"></rect><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path>',
      track:'<path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5Z"></path><circle cx="10" cy="10" r="2"></circle>',
      edit:'<path d="m4 14 1-4 7.8-7.8a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L8 13l-4 1Z"></path><path d="m11.8 3.2 3 3"></path>',
      batch:'<path d="M4 2.5h8l4 4v11H4z"></path><path d="M12 2.5v4h4M7 10h6M7 13h6"></path>'
    };
    return `<svg viewBox="0 0 20 20" aria-hidden="true">${paths[name]||''}</svg>`;
  }

  function pageItems(total,current){
    if(total<=5)return Array.from({length:total},(_,index)=>index+1);
    let start=Math.max(1,current-2),end=Math.min(total,start+4);
    start=Math.max(1,end-4);
    return Array.from({length:end-start+1},(_,index)=>start+index);
  }

  function renderPagination(totalPages){
    const pagination=$('trackingPagination');
    if(!pagination)return;
    pagination.classList.toggle('hidden',totalPages<=1);
    if(totalPages<=1){pagination.innerHTML='';return}
    const pages=pageItems(totalPages,trackingPage);
    pagination.innerHTML=`
      <button type="button" class="tracking-page-step" data-tracking-page="${trackingPage-1}" ${trackingPage===1?'disabled':''}>← <span>Previous</span></button>
      <div class="tracking-page-numbers">${pages.map(page=>`<button type="button" data-tracking-page="${page}" class="${page===trackingPage?'active':''}" aria-current="${page===trackingPage?'page':'false'}">${page}</button>`).join('')}</div>
      <button type="button" class="tracking-page-step" data-tracking-page="${trackingPage+1}" ${trackingPage===totalPages?'disabled':''}><span>Next</span> →</button>`;
  }

  function renderTracking(options={}){
    if(options.reset)trackingPage=1;
    const shipments=collectShipments(!!options.force);
    updateTrackingBadge(shipments);
    renderCourierOptions(shipments);
    visibleShipments=filteredShipments(shipments);
    const totalPages=Math.max(1,Math.ceil(visibleShipments.length/pageSize));
    trackingPage=Math.min(Math.max(1,trackingPage),totalPages);
    const pageStart=(trackingPage-1)*pageSize;
    const rendered=visibleShipments.slice(pageStart,pageStart+pageSize);

    let processingCount=0,processingCurrentCount=0,deliveredCount=0;
    const couriers=new Set();
    shipments.forEach(item=>{
      couriers.add(item.row.courier);
      const status=trackingStatusRecord(item).status;
      if(status==='processing'){processingCount++;if(item.current)processingCurrentCount++}
      else if(status==='delivered')deliveredCount++;
    });
    const courierCount=couriers.size;
    const kpis=$('trackingKpis');
    const nextKpiSignature=[shipments.length,processingCount,processingCurrentCount,deliveredCount,courierCount].join('|');
    if(kpis&&kpiSignature!==nextKpiSignature){
      kpiSignature=nextKpiSignature;
      kpis.innerHTML=[
      ['Unique AWBs',shipments.length,'primary','Across current and saved labels'],
      ['On process',processingCount,'accent',`${processingCurrentCount} in the current batch`],
      ['Delivered',deliveredCount,'soft','Marked as received'],
      ['Couriers',courierCount,'neutral','Detected automatically']
      ].map(([label,value,tone,note])=>`<article class="metric ${tone}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
    }

    const count=$('trackingCount');
    if(count){
      const rangeStart=visibleShipments.length?pageStart+1:0;
      const rangeEnd=Math.min(pageStart+rendered.length,visibleShipments.length);
      count.textContent=visibleShipments.length===shipments.length?`${rangeStart}–${rangeEnd} of ${shipments.length} shipments`:`${rangeStart}–${rangeEnd} of ${visibleShipments.length} matches · ${shipments.length} total`;
    }
    const refreshed=$('trackingRefreshedAt');
    if(refreshed)refreshed.textContent=refreshedAt?refreshedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'On opening Tracking tab';

    const list=$('trackingList'),empty=$('trackingEmpty');
    if(!list)return;
    const hasRows=visibleShipments.length>0;
    empty?.classList.toggle('hidden',hasRows);
    list.closest('table')?.classList.toggle('hidden',!hasRows);
    renderPagination(hasRows?totalPages:0);
    if(!hasRows){list.innerHTML='';return}
    const rows=rendered.map((shipment,index)=>{
      const row=shipment.row;
      const recipient=full(row)||'Unnamed recipient';
      const latest=shipment.current?'Unsaved current data':dateLabel(shipment.latestTimestamp);
      const location=row.address||row.attn||'No address saved';
      const source=sourceLabel(shipment);
      const status=trackingStatusRecord(shipment);
      const statusTitle=status.updatedAt?`Updated ${dateLabel(status.updatedAt)}${status.updatedBy?` by ${status.updatedBy}`:''}`:'Shipment status has not been marked';
      const batchAction=shipment.latestBatch?`<button type="button" class="tracking-icon-action" data-open-tracking-batch="${esc(shipment.latestBatch)}" title="Open saved batch" aria-label="Open saved batch">${icon('batch')}</button>`:'';
      const editAction=shipment.current&&Number.isInteger(shipment.currentIndex)?`<button type="button" class="tracking-icon-action" data-edit-tracking-index="${shipment.currentIndex}" title="Edit label" aria-label="Edit label">${icon('edit')}</button>`:'';
      const statusOptions=status.status==='pending'?'<option value="" selected disabled>Not marked</option>':'';
      return `<tr class="tracking-row" data-tracking-index="${index}">
        <td data-label="Shipment"><div class="tracking-shipment-cell"><span class="tracking-courier-mark">${esc((row.courier||'JNE').slice(0,4))}</span><span class="tracking-recipient"><b>${esc(recipient)}</b><span>${esc(location)}</span></span></div></td>
        <td data-label="Invoice"><span class="tracking-cell-main">${esc(invoiceLabel(shipment,{prefix:false}))}</span></td>
        <td data-label="Courier"><span class="tracking-courier-name">${esc(row.courier||'JNE')}</span></td>
        <td data-label="AWB / resi"><span class="tracking-awb"><strong>${esc(row.awb)}</strong><small>${shipment.occurrences>1?`${shipment.occurrences} records`:'1 record'}</small></span></td>
        <td data-label="Source"><span class="tracking-source"><b>${esc(source)}</b><small>${esc(latest)}</small></span></td>
        <td data-label="Status"><label class="tracking-status-control ${esc(status.status)}" title="${esc(statusTitle)}"><span class="tracking-status-dot"></span><select data-set-tracking-status data-tracking-status-key="${esc(shipment.key)}" aria-label="Status for ${esc(row.awb)}">${statusOptions}<option value="processing" ${status.status==='processing'?'selected':''}>On process</option><option value="delivered" ${status.status==='delivered'?'selected':''}>Delivered</option></select></label></td>
        <td data-label="Actions"><div class="tracking-row-actions">
          <button type="button" class="tracking-icon-action" data-copy-tracking-awb="${esc(row.awb)}" title="Copy AWB" aria-label="Copy AWB">${icon('copy')}</button>
          ${editAction}${batchAction}
          <button type="button" class="tracking-icon-action primary" data-track-shipment="${index}" title="Open courier tracking" aria-label="Open courier tracking">${icon('track')}</button>
        </div></td>
      </tr>`;
    }).join('');
    list.innerHTML=rows;
  }

  async function copyText(value){
    const text=String(value||'');
    if(!text)return false;
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch{}
    const area=document.createElement('textarea');
    area.value=text;
    area.style.cssText='position:fixed;left:-9999px;top:0';
    document.body.appendChild(area);
    area.select();
    let copied=false;
    try{copied=document.execCommand('copy')}catch{}
    area.remove();
    return copied;
  }

  const trackingView=$('trackingView');
  document.querySelector('[data-view="tracking"]')?.addEventListener('click',()=>switchView('tracking'));
  $('trackingSearch')?.addEventListener('input',debounce(()=>renderTracking({reset:true}),lowSpec?180:90));
  $('trackingScope')?.addEventListener('change',()=>renderTracking({reset:true}));
  $('trackingCourier')?.addEventListener('change',()=>renderTracking({reset:true}));
  $('trackingStatus')?.addEventListener('change',()=>renderTracking({reset:true}));
  $('refreshTracking')?.addEventListener('click',async()=>{refreshedAt=new Date();invalidateTracking();await refreshTrackingStatuses();renderTracking({reset:true,force:true});toast('Tracking list refreshed')});
  $('copyVisibleAwbs')?.addEventListener('click',async()=>{
    const text=visibleShipments.map(item=>item.row.awb).join('\n');
    if(!text)return toast('No visible AWBs to copy');
    const copied=await copyText(text);
    toast(copied?`${visibleShipments.length} AWB${visibleShipments.length===1?'':'s'} copied`:'Unable to copy AWBs');
  });
  $('trackingList')?.addEventListener('click',async event=>{
    const trackButton=event.target.closest('[data-track-shipment]');
    if(trackButton){
      const shipment=visibleShipments[(trackingPage-1)*pageSize+Number(trackButton.dataset.trackShipment)];
      if(shipment)window.LabelPrintAwb?.open?.(shipment.row);
      return;
    }
    const copyButton=event.target.closest('[data-copy-tracking-awb]');
    if(copyButton){
      const copied=await copyText(copyButton.dataset.copyTrackingAwb);
      toast(copied?'AWB copied':'Unable to copy AWB');
      return;
    }
    const editButton=event.target.closest('[data-edit-tracking-index]');
    if(editButton){
      selected=Number(editButton.dataset.editTrackingIndex)||0;
      switchView('create');
      renderAll();
      requestAnimationFrame(()=>$('awb')?.focus());
      return;
    }
    const batchButton=event.target.closest('[data-open-tracking-batch]');
    if(batchButton){
      historySelected=batchButton.dataset.openTrackingBatch;
      switchView('history');
      renderHistory();
    }
  });
  $('trackingList')?.addEventListener('change',event=>{
    const statusControl=event.target.closest('[data-set-tracking-status]');
    if(!statusControl)return;
    const shipment=visibleShipments.find(item=>item.key===statusControl.dataset.trackingStatusKey);
    markShipmentStatus(shipment,statusControl.value);
  });
  $('trackingPagination')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-tracking-page]');
    if(!button||button.disabled)return;
    trackingPage=Number(button.dataset.trackingPage)||1;
    renderTracking();
    $('trackingList')?.closest('.tracking-list-panel')?.scrollIntoView({block:'start',behavior:lowSpec?'auto':'smooth'});
  });

  const baseSwitchView=switchView;
  switchView=function(view){
    if(view==='tracking'){
      active='tracking';
      ['create','history','analytics'].forEach(name=>$(name+'View')?.classList.add('hidden'));
      trackingView?.classList.remove('hidden');
      document.querySelectorAll('.nav button').forEach(button=>button.classList.toggle('active',button.dataset.view==='tracking'));
      const subtitle=$('subtitle');
      if(subtitle)subtitle.textContent='Filter shipments by Penerima, invoice, or AWB.';
      renderTracking({reset:true});
      refreshTrackingStatuses();
      return;
    }
    trackingView?.classList.add('hidden');
    return baseSwitchView(view);
  };

  const baseRefreshDataSurfaces=refreshDataSurfaces;
  refreshDataSurfaces=function(){
    invalidateTracking();
    const result=baseRefreshDataSurfaces();
    if(active==='tracking')renderTracking();else scheduleTrackingBadge();
    return result;
  };

  const baseRenderAll=renderAll;
  renderAll=function(){
    invalidateTracking();
    const result=baseRenderAll();
    if(active==='tracking')renderTracking();else scheduleTrackingBadge();
    return result;
  };

  const baseUpdate=update;
  update=function(...args){
    invalidateTracking();
    return baseUpdate(...args);
  };
  const initialBadge=$('trackingBadge');
  if(initialBadge)initialBadge.textContent=lowSpec?'–':'…';
  scheduleTrackingBadge();
  window.LabelPrintTracking={render:renderTracking,collect:collectShipments,invalidate:invalidateTracking};
})();

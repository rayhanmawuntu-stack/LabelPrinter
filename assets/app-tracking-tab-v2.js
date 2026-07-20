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
          <div><h2>Saved shipments</h2><p id="trackingCount">0 shipments</p></div>
          <div class="tracking-filters">
            <label class="tracking-search"><span>⌕</span><input id="trackingSearch" type="search" placeholder="Search Penerima, invoice, or AWB…" autocomplete="off"></label>
            <select class="control" id="trackingScope" aria-label="Tracking source"><option value="all">All sources</option><option value="current">Current batch</option><option value="history">Saved history</option></select>
            <select class="control" id="trackingCourier" aria-label="Courier filter"><option value="all">All couriers</option></select>
            <select class="control" id="trackingStatus" aria-label="Shipment status filter"><option value="all">All statuses</option><option value="pending">Not marked</option><option value="processing">On process</option><option value="delivered">Delivered</option></select>
          </div>
        </div>
        <div class="tracking-list" id="trackingList"></div>
      </section>`;
    analyticsView.parentNode.insertBefore(section,analyticsView);
  }

  const lowSpec=!!window.LabelPrintPerformance?.lowSpec;
  const pageSize=lowSpec?80:180;
  const TRACKING_STATUS_STORAGE_KEY='ksb-tracking-statuses-v1';
  const TRACKING_STATUS_VALUES=new Set(['processing','delivered']);
  let renderLimit=pageSize;
  let refreshedAt=null;
  let visibleShipments=[];
  let shipmentCache={labelsRef:null,historyRef:null,labelSignature:'',shipments:[]};
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

  function currentLabelSignature(){
    return(Array.isArray(labels)?labels:[]).map(raw=>{
      const row=normalizeLabel(raw||{});
      return[row.prefix,row.company,row.invoice,row.courier,row.awb].join('\u001f');
    }).join('\u001e');
  }

  function invalidateTracking(){
    shipmentCache={labelsRef:null,historyRef:null,labelSignature:'',shipments:[]};
  }

  function collectShipments(force=false){
    const signature=currentLabelSignature();
    if(!force&&shipmentCache.labelsRef===labels&&shipmentCache.historyRef===history&&shipmentCache.labelSignature===signature)return shipmentCache.shipments;

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

    shipmentCache={labelsRef:labels,historyRef:history,labelSignature:signature,shipments};
    return shipments;
  }

  function updateTrackingBadge(shipments=collectShipments()){
    const badge=$('trackingBadge');
    if(badge)badge.textContent=shipments.length>99?'99+':String(shipments.length);
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

  function invoiceLabel(shipment){
    const values=[...shipment.invoices];
    if(!values.length)return'No invoice number';
    if(values.length<=2)return`Invoice ${values.join(' · ')}`;
    return`Invoice ${values.slice(0,2).join(' · ')} +${values.length-2}`;
  }

  function renderTracking(options={}){
    if(options.reset)renderLimit=pageSize;
    const shipments=collectShipments(!!options.force);
    updateTrackingBadge(shipments);
    renderCourierOptions(shipments);
    visibleShipments=filteredShipments(shipments);
    const rendered=visibleShipments.slice(0,renderLimit);

    const processingCount=shipments.filter(item=>trackingStatusRecord(item).status==='processing').length;
    const processingCurrentCount=shipments.filter(item=>item.current&&trackingStatusRecord(item).status==='processing').length;
    const deliveredCount=shipments.filter(item=>trackingStatusRecord(item).status==='delivered').length;
    const courierCount=new Set(shipments.map(item=>item.row.courier)).size;
    const kpis=$('trackingKpis');
    if(kpis)kpis.innerHTML=[
      ['Unique AWBs',shipments.length,'primary','Across current and saved labels'],
      ['On process',processingCount,'accent',`${processingCurrentCount} in the current batch`],
      ['Delivered',deliveredCount,'soft','Marked as received'],
      ['Couriers',courierCount,'neutral','Detected automatically']
    ].map(([label,value,tone,note])=>`<article class="metric ${tone}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');

    const count=$('trackingCount');
    if(count){
      const showing=Math.min(rendered.length,visibleShipments.length);
      count.textContent=visibleShipments.length>rendered.length?`Showing ${showing} of ${visibleShipments.length} matches · ${shipments.length} total`:`${visibleShipments.length} of ${shipments.length} shipment${shipments.length===1?'':'s'}`;
    }
    const refreshed=$('trackingRefreshedAt');
    if(refreshed)refreshed.textContent=refreshedAt?refreshedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'On opening Tracking tab';

    const list=$('trackingList');
    if(!list)return;
    if(!visibleShipments.length){
      list.innerHTML='<div class="tracking-empty"><span>⌕</span><h3>No shipments found</h3><p>Search by Penerima, invoice number, or AWB number.</p></div>';
      return;
    }
    const rows=rendered.map((shipment,index)=>{
      const row=shipment.row;
      const recipient=full(row)||'Unnamed recipient';
      const latest=shipment.current?'Unsaved current data':dateLabel(shipment.latestTimestamp);
      const location=row.address||row.attn||'No address saved';
      const source=sourceLabel(shipment);
      const status=trackingStatusRecord(shipment);
      const statusLabel=trackingStatusLabel(status.status);
      const statusTitle=status.updatedAt?`Updated ${dateLabel(status.updatedAt)}${status.updatedBy?` by ${status.updatedBy}`:''}`:'Shipment status has not been marked';
      const batchAction=shipment.latestBatch?`<button type="button" class="tracking-action secondary" data-open-tracking-batch="${esc(shipment.latestBatch)}">Open batch</button>`:'';
      const editAction=shipment.current&&Number.isInteger(shipment.currentIndex)?`<button type="button" class="tracking-action secondary" data-edit-tracking-index="${shipment.currentIndex}">Edit label</button>`:'';
      return `<article class="tracking-row" data-tracking-index="${index}">
        <div class="tracking-courier-mark">${esc((row.courier||'JNE').slice(0,4))}</div>
        <div class="tracking-recipient"><b>${esc(recipient)}</b><span>${esc(location)}</span><small>${esc(source)} · ${esc(latest)}</small></div>
        <div class="tracking-awb"><span>AWB / resi</span><strong>${esc(row.awb)}</strong><small>${esc(invoiceLabel(shipment))} · ${esc(row.courier||'JNE')}</small><span class="tracking-status-badge ${esc(status.status)}" title="${esc(statusTitle)}">${esc(statusLabel)}</span></div>
        <div class="tracking-row-actions">
          <div class="tracking-status-actions" role="group" aria-label="Shipment status for ${esc(row.awb)}">
            <button type="button" class="tracking-action tracking-status-action processing${status.status==='processing'?' active':''}" data-set-tracking-status="processing" data-tracking-status-key="${esc(shipment.key)}" aria-pressed="${status.status==='processing'}"${status.status==='processing'?' disabled':''}>On process</button>
            <button type="button" class="tracking-action tracking-status-action delivered${status.status==='delivered'?' active':''}" data-set-tracking-status="delivered" data-tracking-status-key="${esc(shipment.key)}" aria-pressed="${status.status==='delivered'}"${status.status==='delivered'?' disabled':''}>Delivered</button>
          </div>
          <button type="button" class="tracking-action secondary" data-copy-tracking-awb="${esc(row.awb)}">Copy</button>
          ${editAction}${batchAction}
          <button type="button" class="tracking-action primary" data-track-shipment="${index}">Track</button>
        </div>
      </article>`;
    }).join('');
    const more=rendered.length<visibleShipments.length?`<button type="button" class="tracking-show-more" data-show-more-tracking>Show ${Math.min(pageSize,visibleShipments.length-rendered.length)} more</button>`:'';
    list.innerHTML=rows+more;
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
    const moreButton=event.target.closest('[data-show-more-tracking]');
    if(moreButton){renderLimit+=pageSize;renderTracking();return}
    const statusButton=event.target.closest('[data-set-tracking-status]');
    if(statusButton){
      const shipment=visibleShipments.find(item=>item.key===statusButton.dataset.trackingStatusKey);
      markShipmentStatus(shipment,statusButton.dataset.setTrackingStatus);
      return;
    }
    const trackButton=event.target.closest('[data-track-shipment]');
    if(trackButton){
      const shipment=visibleShipments[Number(trackButton.dataset.trackShipment)];
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
    const result=baseRefreshDataSurfaces();
    updateTrackingBadge();
    if(active==='tracking')renderTracking();
    return result;
  };

  const baseRenderAll=renderAll;
  renderAll=function(){
    const result=baseRenderAll();
    updateTrackingBadge();
    if(active==='tracking')renderTracking();
    return result;
  };

  $('awb')?.addEventListener('input',()=>updateTrackingBadge());
  $('courier')?.addEventListener('change',()=>updateTrackingBadge());
  updateTrackingBadge();
  window.LabelPrintTracking={render:renderTracking,collect:collectShipments,invalidate:invalidateTracking};
})();

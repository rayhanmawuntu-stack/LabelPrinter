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
          <p>Find every saved AWB in one place, copy tracking numbers, and open courier tracking without exposing an API key in the browser.</p>
        </div>
        <div class="actions tracking-head-actions">
          <button class="btn light" id="copyVisibleAwbs" type="button">Copy visible AWBs</button>
          <button class="btn dark" id="refreshTracking" type="button">Refresh list</button>
        </div>
      </div>
      <div class="tracking-kpis" id="trackingKpis"></div>
      <section class="tracking-api-panel panel">
        <div class="tracking-api-copy">
          <span class="tracking-mode"><i></i> External tracking mode</span>
          <h2>Live courier API not configured</h2>
          <p>Tracking buttons open CekResi for JNE and a universal tracking page for other couriers. The interface is ready for a secure Apps Script API proxy later.</p>
        </div>
        <div class="tracking-api-meta">
          <span>Provider</span><strong>Courier web tracking</strong>
          <span>Credential exposure</span><strong>None</strong>
          <span>Last refreshed</span><strong id="trackingRefreshedAt">—</strong>
        </div>
      </section>
      <section class="panel tracking-list-panel">
        <div class="panel-head tracking-list-head">
          <div><h2>Saved shipments</h2><p id="trackingCount">0 shipments</p></div>
          <div class="tracking-filters">
            <label class="tracking-search"><span>⌕</span><input id="trackingSearch" type="search" placeholder="Search recipient, AWB, batch…" autocomplete="off"></label>
            <select class="control" id="trackingScope" aria-label="Tracking source"><option value="all">All sources</option><option value="current">Current batch</option><option value="history">Saved history</option></select>
            <select class="control" id="trackingCourier" aria-label="Courier filter"><option value="all">All couriers</option></select>
          </div>
        </div>
        <div class="tracking-list" id="trackingList"></div>
      </section>`;
    analyticsView.parentNode.insertBefore(section,analyticsView);
  }

  let refreshedAt=null;
  let visibleShipments=[];

  function trackingKey(row){
    const r=normalizeLabel(row||{});
    return `${r.courier||'JNE'}|${r.awb}`;
  }

  function collectShipments(){
    const map=new Map();
    const absorb=(raw,meta)=>{
      const row=normalizeLabel(raw||{});
      if(!row.awb)return;
      const key=trackingKey(row);
      let shipment=map.get(key);
      if(!shipment){
        shipment={key,row,current:false,currentIndex:null,batches:new Set(),latestBatch:'',latestTimestamp:'',latestUser:'',occurrences:0};
        map.set(key,shipment);
      }
      shipment.occurrences++;
      if(meta.source==='current'){
        shipment.current=true;
        shipment.currentIndex=meta.index;
        shipment.row=row;
      }else{
        shipment.batches.add(meta.batchId);
        if(!shipment.latestTimestamp||new Date(meta.timestamp)>new Date(shipment.latestTimestamp)){
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

    return[...map.values()].sort((a,b)=>{
      if(a.current!==b.current)return a.current?-1:1;
      return new Date(b.latestTimestamp||0)-new Date(a.latestTimestamp||0);
    });
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
    const scope=$('trackingScope')?.value||'all';
    const courier=$('trackingCourier')?.value||'all';
    return shipments.filter(shipment=>{
      if(scope==='current'&&!shipment.current)return false;
      if(scope==='history'&&!shipment.batches.size)return false;
      if(courier!=='all'&&shipment.row.courier!==courier)return false;
      if(!query)return true;
      const haystack=[full(shipment.row),shipment.row.attn,shipment.row.address,shipment.row.phone,shipment.row.awb,shipment.row.courier,shipment.latestBatch,shipment.latestUser].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderCourierOptions(shipments){
    const select=$('trackingCourier');
    if(!select)return;
    const selected=select.value||'all';
    const couriers=[...new Set(shipments.map(x=>x.row.courier).filter(Boolean))].sort();
    select.innerHTML='<option value="all">All couriers</option>'+couriers.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    select.value=couriers.includes(selected)?selected:'all';
  }

  function renderTracking(){
    const shipments=collectShipments();
    updateTrackingBadge(shipments);
    renderCourierOptions(shipments);
    visibleShipments=filteredShipments(shipments);

    const currentCount=shipments.filter(x=>x.current).length;
    const historyCount=shipments.filter(x=>x.batches.size).length;
    const courierCount=new Set(shipments.map(x=>x.row.courier)).size;
    const batchCount=new Set(shipments.flatMap(x=>[...x.batches])).size;
    const kpis=$('trackingKpis');
    if(kpis)kpis.innerHTML=[
      ['Unique AWBs',shipments.length,'primary','Across current and saved labels'],
      ['Current batch',currentCount,'accent','Ready to track now'],
      ['Saved history',historyCount,'soft',`${batchCount} batch${batchCount===1?'':'es'} represented`],
      ['Couriers',courierCount,'neutral','Detected automatically']
    ].map(([label,value,tone,note])=>`<article class="metric ${tone}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');

    const count=$('trackingCount');
    if(count)count.textContent=`${visibleShipments.length} of ${shipments.length} shipment${shipments.length===1?'':'s'}`;
    const refreshed=$('trackingRefreshedAt');
    if(refreshed)refreshed.textContent=refreshedAt?refreshedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'On opening this tab';

    const list=$('trackingList');
    if(!list)return;
    list.innerHTML=visibleShipments.length?visibleShipments.map((shipment,index)=>{
      const row=shipment.row;
      const recipient=full(row)||'Unnamed recipient';
      const latest=shipment.current?'Unsaved current data':dateLabel(shipment.latestTimestamp);
      const location=row.address||row.attn||'No address saved';
      const source=sourceLabel(shipment);
      const batchAction=shipment.latestBatch?`<button type="button" class="tracking-action secondary" data-open-tracking-batch="${esc(shipment.latestBatch)}">Open batch</button>`:'';
      const editAction=shipment.current&&Number.isInteger(shipment.currentIndex)?`<button type="button" class="tracking-action secondary" data-edit-tracking-index="${shipment.currentIndex}">Edit label</button>`:'';
      return `<article class="tracking-row" data-tracking-index="${index}">
        <div class="tracking-courier-mark">${esc((row.courier||'JNE').slice(0,4))}</div>
        <div class="tracking-recipient"><b>${esc(recipient)}</b><span>${esc(location)}</span><small>${esc(source)} · ${esc(latest)}</small></div>
        <div class="tracking-awb"><span>AWB / resi</span><strong>${esc(row.awb)}</strong><small>${esc(row.courier||'JNE')}</small></div>
        <div class="tracking-row-actions">
          <button type="button" class="tracking-action secondary" data-copy-tracking-awb="${esc(row.awb)}">Copy</button>
          ${editAction}${batchAction}
          <button type="button" class="tracking-action primary" data-track-shipment="${index}">Track</button>
        </div>
      </article>`;
    }).join(''):`<div class="tracking-empty"><span>⌕</span><h3>No shipments found</h3><p>Add an AWB to a label or adjust the tracking filters.</p></div>`;
  }

  async function copyText(value){
    const text=String(value||'');
    if(!text)return false;
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}
    }catch{}
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
  const trackingButton=document.querySelector('[data-view="tracking"]');
  trackingButton?.addEventListener('click',()=>switchView('tracking'));
  $('trackingSearch')?.addEventListener('input',debounce(renderTracking,90));
  $('trackingScope')?.addEventListener('change',renderTracking);
  $('trackingCourier')?.addEventListener('change',renderTracking);
  $('refreshTracking')?.addEventListener('click',()=>{refreshedAt=new Date();renderTracking();toast('Tracking list refreshed')});
  $('copyVisibleAwbs')?.addEventListener('click',async()=>{
    const text=visibleShipments.map(x=>x.row.awb).join('\n');
    if(!text)return toast('No visible AWBs to copy');
    const copied=await copyText(text);
    toast(copied?`${visibleShipments.length} AWB${visibleShipments.length===1?'':'s'} copied`:'Unable to copy AWBs');
  });
  $('trackingList')?.addEventListener('click',async event=>{
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
      if(subtitle)subtitle.textContent='Track current and previously generated shipments.';
      renderTracking();
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
  window.LabelPrintTracking={render:renderTracking,collect:collectShipments};
})();

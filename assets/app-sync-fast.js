(()=>{
  const NORMAL_HISTORY_LIMIT=1000;
  const FULL_HISTORY_LIMIT=2000;
  const RECENT_SYNC_TTL=15000;
  const VERIFY_DELAY=320;
  const LAST_FULL_SYNC_KEY='ksb-sync-last-full-v2';
  const CONCURRENCY=window.LabelPrintPerformance?.lowSpec?2:3;
  let activePromise=null;

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const batchId=batch=>clean(batch?.id);
  const stateOf=batch=>historySyncState(batch?.syncState);
  const unsynced=source=>(Array.isArray(source)?source:[]).filter(batch=>batchId(batch)&&stateOf(batch)!=='synced');

  function lastFullSync(){
    try{return Number(localStorage.getItem(LAST_FULL_SYNC_KEY)||0)||0}catch{return 0}
  }
  function rememberFullSync(){
    try{localStorage.setItem(LAST_FULL_SYNC_KEY,String(Date.now()))}catch{}
  }
  function uniqueBatches(rows){
    const map=new Map();
    (Array.isArray(rows)?rows:[]).forEach(batch=>{const id=batchId(batch);if(id)map.set(id,batch)});
    return[...map.values()];
  }
  function remoteLimit(force){
    if(force)return FULL_HISTORY_LIMIT;
    return Math.min(NORMAL_HISTORY_LIMIT,Math.max(250,(Array.isArray(history)?history.length:0)+100));
  }
  async function fetchRemoteHistory(force){
    return apiGet('getHistory',{limit:remoteLimit(force)});
  }

  async function runPool(items,worker){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return[];
    const results=new Array(rows.length);
    let cursor=0,completed=0;
    async function runner(){
      while(true){
        const index=cursor++;
        if(index>=rows.length)return;
        try{results[index]=await worker(rows[index],index)}catch(error){results[index]={ok:false,error}}
        completed++;
        if(rows.length>1)setStatus('syncing',`Syncing ${completed}/${rows.length} label batches…`);
      }
    }
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,rows.length)},runner));
    return results;
  }

  async function uploadQueue(queue){
    const summary={confirmed:0,queued:0,failed:0};
    const rows=uniqueBatches(queue);
    await runPool(rows,async batch=>{
      const ok=await syncBatch(batch,false,{refresh:false});
      const stored=history.find(item=>batchId(item)===batchId(batch));
      if(ok)summary.confirmed++;
      else if(stored?.syncState==='failed')summary.failed++;
      else summary.queued++;
      return{ok,id:batchId(batch)};
    });
    return summary;
  }

  function addSummary(target,source){
    target.confirmed+=source.confirmed||0;
    target.queued+=source.queued||0;
    target.failed+=source.failed||0;
    return target;
  }

  async function optimizedSync(force=false){
    if(activePromise&&!force)return activePromise;
    if(activePromise&&force){try{await activePromise}catch{}}

    activePromise=(async()=>{
      syncInFlight=true;
      const startingHistory=(Array.isArray(history)?history:[]).map(batch=>clone(batch));
      const startingQueue=uniqueBatches(unsynced(startingHistory));
      const deletedCount=deletedBatchIds().size;
      const recentNoWork=!force&&!startingQueue.length&&!deletedCount&&(Date.now()-lastFullSync()<RECENT_SYNC_TTL);
      const totals={confirmed:0,queued:0,failed:0};
      setStatus('syncing',force?'Reconciling all label batches…':'Connecting to Google Sheets…');

      const pingPromise=apiGet('ping');
      const usersPromise=fetchUsersFast(force).catch(error=>({ok:false,error}));
      const earlyHistoryPromise=!recentNoWork&&!startingQueue.length?fetchRemoteHistory(force):null;

      try{
        const ping=await pingPromise;
        if(!ping?.success)throw new Error('Invalid LabelPrint API response');
        connected=true;
        setStatus('connected',`Sheets connected${ping.spreadsheetName?` · ${ping.spreadsheetName}`:''}`);

        if(deletedCount)await flushDeletedBatches();

        if(startingQueue.length){
          setStatus('syncing',`Uploading ${startingQueue.length} pending batch${startingQueue.length===1?'':'es'}…`);
          addSummary(totals,await uploadQueue(startingQueue));
        }

        if(!recentNoWork){
          if(totals.queued)await wait(VERIFY_DELAY);
          setStatus('syncing','Refreshing batch history…');
          const response=earlyHistoryPromise?await earlyHistoryPromise:await fetchRemoteHistory(force);
          window.LabelPrintSync?.reconcile?.(response,history);
          rememberFullSync();
        }

        const attempted=new Set(startingQueue.map(batchId));
        const discoveredQueue=uniqueBatches(unsynced(history).filter(batch=>!attempted.has(batchId(batch))));
        if(discoveredQueue.length){
          setStatus('syncing',`Uploading ${discoveredQueue.length} changed batch${discoveredQueue.length===1?'':'es'}…`);
          addSummary(totals,await uploadQueue(discoveredQueue));
        }

        if(totals.queued){
          await wait(VERIFY_DELAY);
          setStatus('syncing','Confirming Google Sheets updates…');
          const verification=await fetchRemoteHistory(force);
          window.LabelPrintSync?.reconcile?.(verification,history);
          rememberFullSync();
        }

        usersPromise.then(result=>{if(result?.error)console.warn('User refresh failed:',result.error)});
        const pending=unsynced(history).length;
        const synced=Math.max(0,history.length-pending);
        refreshDataSurfaces();

        if(pending){
          setStatus('connected',`Sheets connected · ${synced} synced · ${pending} pending`);
          window.__lastSheetsError=`${pending} batch${pending===1?'':'es'} awaiting synchronization`;
        }else{
          setStatus('connected',`Sheets connected · all ${synced} batches synced`);
          window.__lastSheetsError='';
        }
        if(force)toast(pending?`${synced} batches synced · ${pending} pending`:`All ${synced} label batches synced`);
        return{success:pending===0,synced,pending,...totals,fastPath:recentNoWork};
      }catch(error){
        connected=false;
        window.__lastSheetsError=String(error?.message||error);
        setStatus('error','Sheets sync failed · tap for details');
        console.warn('Fast Google Sheets sync failed:',error);
        if(force)toast(`Sync failed: ${window.__lastSheetsError}`);
        return{success:false,error};
      }finally{
        syncInFlight=false;
        activePromise=null;
      }
    })();

    return activePromise;
  }

  sync=optimizedSync;
  if(window.LabelPrintSync)window.LabelPrintSync.run=optimizedSync;

  const syncButton=$('saveConnection');
  if(syncButton){
    syncButton.disabled=false;
    syncButton.textContent='Sync all history';
    syncButton.onclick=async()=>{
      if(syncButton.disabled)return;
      const original=syncButton.textContent;
      syncButton.disabled=true;
      syncButton.textContent='Syncing…';
      try{await optimizedSync(true)}finally{syncButton.disabled=false;syncButton.textContent=original}
    };
  }

  window.LabelPrintFastSync={run:optimizedSync,upload:uploadQueue,historyLimit:remoteLimit};
})();
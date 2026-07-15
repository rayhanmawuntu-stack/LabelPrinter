(()=>{
  const HISTORY_LIMIT=2000;
  const SYNC_RECHECK_DELAY=650;
  let activeSyncPromise=null;

  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
  function normalizedBatch(raw,state){
    const batch=raw&&typeof raw==='object'?raw:{};
    const id=clean(batch.id);
    const enrich=window.LabelPrintInvoiceMemory?.enrichRow;
    const rows=usableLabels(batch.labels||[]).map(row=>enrich?enrich(row):normalizeLabel(row));
    if(!id||!rows.length)return null;
    return{
      ...batch,
      id,
      timestamp:batch.timestamp||new Date().toISOString(),
      user:clean(batch.user)||'Local User',
      nickname:clean(batch.nickname)||clean(batch.user).split(/\s+/)[0]||'User',
      layout:LAYOUTS[batch.layout]?batch.layout:'3x2',
      labels:rows,
      syncState:state||historySyncState(batch.syncState)
    };
  }
  function batchSignature(raw){
    const batch=normalizedBatch(raw,'pending');
    if(!batch)return'';
    return JSON.stringify({
      id:batch.id,
      layout:batch.layout,
      labels:batch.labels.map(row=>{const r=normalizeLabel(row);return[r.prefix,r.company,r.invoice,r.attn,r.phone,r.address,r.sender,r.courier,r.awb]})
    });
  }
  function remoteBatches(response){
    return(Array.isArray(response?.history)?response.history:[]).map(batch=>normalizedBatch(batch,'synced')).filter(Boolean);
  }
  function persistHistory(next){
    const deleted=deletedBatchIds();
    history=next.filter(batch=>batch?.id&&!deleted.has(batch.id)).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,1000);
    save('ksb-history',history);
    rebuildCompanyPrefixes();
    refreshDataSurfaces();
    return history;
  }
  function reconcileHistory(response,localSource=history){
    const deleted=deletedBatchIds();
    const remote=remoteBatches(response).filter(batch=>!deleted.has(batch.id));
    const remoteMap=new Map(remote.map(batch=>[batch.id,batch]));
    const merged=new Map(remote.map(batch=>[batch.id,batch]));

    (Array.isArray(localSource)?localSource:[]).forEach(raw=>{
      const local=normalizedBatch(raw);
      if(!local||deleted.has(local.id))return;
      const matchingRemote=remoteMap.get(local.id);
      if(matchingRemote&&batchSignature(local)===batchSignature(matchingRemote)){
        merged.set(local.id,{...local,syncState:'synced'});
      }else{
        merged.set(local.id,{...local,syncState:'pending'});
      }
    });

    persistHistory([...merged.values()]);
    return{remoteMap,pending:history.filter(batch=>batch.syncState!=='synced')};
  }

  applyRemoteHistory=function(response){
    if(!Array.isArray(response?.history))return false;
    reconcileHistory(response,history);
    return true;
  };

  syncBatch=async function(batch,announce=true,options={}){
    const refresh=options.refresh!==false;
    const target=normalizedBatch(batch);
    if(!target)return false;
    const index=history.findIndex(item=>clean(item?.id)===target.id);
    const stored=index>=0?history[index]:target;
    if(!connected){
      stored.syncState='pending';
      if(index<0)history.unshift(stored);
      save('ksb-history',history);
      if(refresh)refreshDataSurfaces();
      if(announce)toast('Saved locally · sync pending');
      return false;
    }
    try{
      stored.labels=target.labels;
      stored.syncState='pending';
      stored.labels.forEach(row=>rememberCompanyDefaults(row,false));
      persistCompanyMemory();
      window.LabelPrintInvoiceMemory?.rememberRows?.(stored.labels,{backfill:false,queueSync:false});
      const result=await post('saveBatch',stored);
      stored.syncState=result?.queued?'pending':'synced';
      save('ksb-history',history);
      if(refresh)refreshDataSurfaces();
      if(announce)toast(result?.queued?'Saved locally · verifying Google Sheets':'Saved to Google Sheets');
      return !result?.queued;
    }catch(error){
      stored.syncState='failed';
      save('ksb-history',history);
      if(refresh)refreshDataSurfaces();
      if(announce)toast(`Saved locally; sync failed: ${error?.message||error}`);
      return false;
    }
  };

  sync=async function(force=false){
    if(activeSyncPromise&&!force)return activeSyncPromise;
    if(activeSyncPromise&&force){try{await activeSyncPromise}catch{}}
    activeSyncPromise=(async()=>{
      syncInFlight=true;
      setStatus('syncing','Checking all label batches…');
      const localSnapshot=(Array.isArray(history)?history:[]).map(batch=>clone(batch));
      try{
        const ping=await apiGet('ping');
        if(!ping?.success)throw new Error('Invalid LabelPrint API response');
        connected=true;

        const [usersResult,historyResponse]=await Promise.all([
          fetchUsersFast(true).catch(error=>({ok:false,error})),
          apiGet('getHistory',{limit:HISTORY_LIMIT})
        ]);
        if(usersResult?.error)console.warn('User sync failed:',usersResult.error);

        await flushDeletedBatches();
        let reconciliation=reconcileHistory(historyResponse,localSnapshot);
        const queue=reconciliation.pending.slice();
        let uploaded=0;
        for(const batch of queue){
          if(await syncBatch(batch,false,{refresh:false}))uploaded++;
        }

        if(queue.length){
          await delay(SYNC_RECHECK_DELAY);
          const verified=await apiGet('getHistory',{limit:HISTORY_LIMIT});
          reconciliation=reconcileHistory(verified,history);
        }

        const pending=history.filter(batch=>batch.syncState!=='synced').length;
        const synced=history.length-pending;
        if(pending){
          setStatus('connected',`Sheets connected · ${synced} synced · ${pending} pending`);
          window.__lastSheetsError=`${pending} batch${pending===1?'':'es'} awaiting backend confirmation`;
        }else{
          setStatus('connected',`Sheets connected · all ${synced} batches synced`);
          window.__lastSheetsError='';
        }
        if(force)toast(pending?`${synced} batches synced · ${pending} still pending`:`All ${synced} label batches synced`);
        return{success:pending===0,synced,pending,uploaded};
      }catch(error){
        connected=false;
        window.__lastSheetsError=String(error?.message||error);
        setStatus('error','Sheets sync failed · tap for details');
        console.warn('Google Sheets history sync failed:',error);
        if(force)toast(`Sync failed: ${window.__lastSheetsError}`);
        return{success:false,error};
      }finally{
        syncInFlight=false;
        activeSyncPromise=null;
      }
    })();
    return activeSyncPromise;
  };

  function parseClipboardTable(text){
    const rows=[];
    let row=[],cell='',quoted=false;
    const source=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    for(let i=0;i<source.length;i++){
      const char=source[i];
      if(char==='"'){
        if(quoted&&source[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
      }else if(char==='\t'&&!quoted){row.push(cell);cell=''}
      else if(char==='\n'&&!quoted){row.push(cell);if(row.some(value=>clean(value)))rows.push(row);row=[];cell=''}
      else cell+=char;
    }
    row.push(cell);
    if(row.some(value=>clean(value)))rows.push(row);
    return rows;
  }
  function isHeaderRow(columns){
    const values=columns.map(value=>clean(value).toLowerCase());
    return /penerima|recipient|company/.test(values[1]||'')||/awb|resi|tracking/.test(values[4]||'');
  }
  function rowFromColumns(columns){
    const raw=clean(columns[1]);
    const companyMatch=raw.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i);
    const addressAndPhone=clean(columns[5]);
    const phoneMatch=addressAndPhone.match(/\(([^()]*)\)\s*$/);
    return normalizeLabel({
      prefix:companyMatch?companyMatch[1].toUpperCase():'',
      company:companyMatch?companyMatch[2]:raw,
      invoice:clean(columns[2]),
      courier:clean(columns[3])||'JNE',
      awb:clean(columns[4]),
      address:phoneMatch?addressAndPhone.slice(0,phoneMatch.index).trim():addressAndPhone,
      phone:phoneMatch?clean(phoneMatch[1]):'',
      attn:clean(columns[6]),
      sender:''
    });
  }
  function forceSelectedAwbIntoForm(){
    const row=normalizeLabel(labels[selected]||{});
    const awbField=$('awb'),courierField=$('courier');
    if(awbField)awbField.value=row.awb||'';
    if(courierField)courierField.value=row.courier==='JNE'?'JNE':'OTHER';
    window.LabelPrintAwb?.sync?.(row);
  }
  function importRowsWithAwb(){
    const paste=$('paste');
    if(!paste)return;
    const parsed=parseClipboardTable(paste.value).filter(columns=>!isHeaderRow(columns)).map(rowFromColumns).map(row=>applyRememberedCompanyDefaults(row,false)).filter(row=>row.company&&!/^(penerima|recipient|company)$/i.test(row.company));
    if(!parsed.length)return toast('No valid rows detected. Paste columns A–G from Excel.');
    const seen=new Set();
    const unique=parsed.filter(row=>{const key=bulkDuplicateKey(row);if(seen.has(key))return false;seen.add(key);return true});
    const rows=unique.slice(0,MAX_LABELS);
    rows.forEach(row=>rememberCompanyDefaults(row,false));
    persistCompanyMemory();
    window.LabelPrintInvoiceMemory?.rememberRows?.(rows,{backfill:false,queueSync:false});
    labels=rows;
    selected=0;
    historySelected=null;
    save('ksb-labels',labels);
    closeModals();
    renderAll();
    forceSelectedAwbIntoForm();
    requestAnimationFrame(()=>{forceSelectedAwbIntoForm();requestAnimationFrame(forceSelectedAwbIntoForm)});
    const tracked=rows.filter(row=>row.awb).length;
    const invoices=rows.filter(row=>row.invoice).length;
    const missingAwb=rows.length-tracked;
    let message=`${rows.length} labels imported · ${tracked} AWB${tracked===1?'':'s'}`;
    if(invoices)message+=` · ${invoices} invoice${invoices===1?'':'s'}`;
    if(missingAwb)message+=` · ${missingAwb} missing column E`;
    if(unique.length>MAX_LABELS)message+=` · first ${MAX_LABELS} used`;
    toast(message);
  }

  const baseRenderForm=renderForm;
  renderForm=function(){const result=baseRenderForm();forceSelectedAwbIntoForm();return result};
  const importButton=$('importRows');
  if(importButton)importButton.onclick=importRowsWithAwb;

  const saveButton=$('saveConnection');
  if(saveButton){
    saveButton.disabled=false;
    saveButton.textContent='Sync all history';
    saveButton.title='Reconcile every local label batch with Google Sheets';
    saveButton.onclick=async()=>{saveButton.disabled=true;try{await sync(true)}finally{saveButton.disabled=false}};
  }

  window.LabelPrintSync={run:sync,reconcile:reconcileHistory,signature:batchSignature};
  window.LabelPrintBulkInput={parse:parseClipboardTable,import:importRowsWithAwb};
})();
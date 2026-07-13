(()=>{
  const KEY='ksb-awb-invoice-map-v1';
  let memory={};
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
    if(saved&&typeof saved==='object'&&!Array.isArray(saved))memory=saved;
  }catch{}

  function invoiceKey(raw){
    const row=normalizeLabel(raw||{});
    return row.awb?`${row.courier||'JNE'}|${row.awb}`:'';
  }

  function lookup(raw){
    const row=normalizeLabel(raw||{});
    if(!row.awb)return'';
    return clean(memory[invoiceKey(row)]||memory[`*|${row.awb}`]);
  }

  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(memory))}catch(error){console.warn('Invoice memory save failed:',error)}
  }

  function rememberRows(rows,options={}){
    let changed=false;
    (Array.isArray(rows)?rows:[]).forEach(raw=>{
      const row=normalizeLabel(raw||{});
      if(!row.awb||!row.invoice)return;
      const specific=invoiceKey(row),fallback=`*|${row.awb}`;
      if(memory[specific]!==row.invoice){memory[specific]=row.invoice;changed=true}
      if(memory[fallback]!==row.invoice){memory[fallback]=row.invoice;changed=true}
    });
    if(changed)persist();
    if(options.backfill!==false)backfillState({queueSync:options.queueSync!==false});
    return changed;
  }

  function enrichRow(raw){
    const row=normalizeLabel(raw||{});
    if(row.invoice){
      const specific=invoiceKey(row),fallback=row.awb?`*|${row.awb}`:'';
      if(specific)memory[specific]=row.invoice;
      if(fallback)memory[fallback]=row.invoice;
      return row;
    }
    const remembered=lookup(row);
    if(remembered)row.invoice=remembered;
    return row;
  }

  let repairInFlight=false;
  function backfillState(options={}){
    let labelsChanged=false;
    labels=(Array.isArray(labels)?labels:[]).map(raw=>{
      const original=normalizeLabel(raw||{}),next=enrichRow(original);
      if(next.invoice!==original.invoice)labelsChanged=true;
      return next;
    });

    const changedBatches=[];
    history=(Array.isArray(history)?history:[]).map(batch=>{
      let batchChanged=false;
      const nextLabels=(Array.isArray(batch?.labels)?batch.labels:[]).map(raw=>{
        const original=normalizeLabel(raw||{}),next=enrichRow(original);
        if(next.invoice!==original.invoice)batchChanged=true;
        return next;
      });
      if(!batchChanged)return batch;
      const next={...batch,labels:nextLabels,syncState:'pending'};
      changedBatches.push(next);
      return next;
    });

    persist();
    if(labelsChanged)save('ksb-labels',labels);
    if(changedBatches.length)save('ksb-history',history);
    if(labelsChanged||changedBatches.length){
      window.LabelPrintTracking?.invalidate?.();
      if(active==='tracking')window.LabelPrintTracking?.render?.({force:true});
      else refreshDataSurfaces?.();
    }

    if(options.queueSync&&connected&&changedBatches.length&&!repairInFlight){
      repairInFlight=true;
      setTimeout(async()=>{
        try{for(const batch of changedBatches)await syncBatch(batch,false)}
        finally{repairInFlight=false}
      },0);
    }
    return{labelsChanged,batchesChanged:changedBatches.length};
  }

  rememberRows(labels,{backfill:false});
  (Array.isArray(history)?history:[]).forEach(batch=>rememberRows(batch?.labels||[],{backfill:false}));
  backfillState({queueSync:false});

  const baseApplyRemoteHistory=applyRemoteHistory;
  applyRemoteHistory=function(response){
    const enriched=response?.history?{...response,history:response.history.map(batch=>({...batch,labels:(batch.labels||[]).map(enrichRow)}))}:response;
    const result=baseApplyRemoteHistory(enriched);
    rememberRows((Array.isArray(history)?history:[]).flatMap(batch=>batch?.labels||[]),{backfill:false});
    backfillState({queueSync:false});
    return result;
  };

  const baseSyncBatch=syncBatch;
  syncBatch=async function(batch,announce=true){
    if(batch?.labels){
      batch.labels=batch.labels.map(enrichRow);
      rememberRows(batch.labels,{backfill:false});
    }
    return baseSyncBatch(batch,announce);
  };

  window.LabelPrintInvoiceMemory={lookup,rememberRows,enrichRow,backfillState};
})();
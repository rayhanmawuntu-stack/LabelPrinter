(()=>{
  function endpointField(){return document.getElementById('endpoint')}
  function connectionResult(){return document.getElementById('connectionResult')}

  function validateEndpoint(value){
    const raw=clean(value);
    if(!raw)throw new Error('Enter an Apps Script web-app URL');
    const url=new URL(raw);
    if(url.protocol!=='https:')throw new Error('The backend URL must use HTTPS');
    if(!/\/exec\/?$/i.test(url.pathname))throw new Error('Use the deployed Apps Script URL ending in /exec');
    return url.toString();
  }

  async function testEndpointSafely(){
    const field=endpointField(),result=connectionResult(),testButton=document.getElementById('testConnection');
    if(!field||!result)return;
    const previousUrl=localStorage.getItem('ksb-endpoint');
    const previousRevision=localStorage.getItem('ksb-endpoint-revision');
    if(testButton)testButton.disabled=true;
    try{
      const url=validateEndpoint(field.value);
      result.textContent='Testing connection…';
      localStorage.setItem('ksb-endpoint',url);
      localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);
      const response=await apiGet('ping');
      if(!response?.success)throw new Error('Invalid LabelPrint API response');
      field.value=url;
      result.textContent=`Connected to ${response.spreadsheetName||'Google Sheets'} · API ${response.apiVersion||'unknown'}.`;
      window.__lastSheetsError='';
    }catch(error){
      if(previousUrl===null)localStorage.removeItem('ksb-endpoint');else localStorage.setItem('ksb-endpoint',previousUrl);
      if(previousRevision===null)localStorage.removeItem('ksb-endpoint-revision');else localStorage.setItem('ksb-endpoint-revision',previousRevision);
      window.__lastSheetsError=String(error?.message||error);
      result.textContent='Connection failed: '+window.__lastSheetsError;
      field.focus();
    }finally{
      if(testButton)testButton.disabled=false;
    }
  }

  async function saveEndpointSafely(){
    const field=endpointField(),result=connectionResult(),saveButton=document.getElementById('saveConnection');
    if(!field)return;
    if(saveButton)saveButton.disabled=true;
    try{
      const url=validateEndpoint(field.value);
      localStorage.setItem('ksb-endpoint',url);
      localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);
      field.value=url;
      closeModals();
      await sync();
    }catch(error){
      const message=String(error?.message||error);
      if(result)result.textContent='Connection failed: '+message;
      toast(message);
      field.focus();
    }finally{
      if(saveButton)saveButton.disabled=false;
    }
  }

  function importRowsWithCompanyDefaults(){
    const paste=document.getElementById('paste');
    if(!paste)return;
    const parsed=paste.value.split(/\r?\n/).filter(Boolean).map(line=>{
      const columns=line.split('\t'),raw=(columns[1]||'').trim(),match=raw.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i),addressPhone=(columns[5]||'').trim(),phoneMatch=addressPhone.match(/\(([^()]*)\)\s*$/);
      return{prefix:match?match[1].toUpperCase():'',company:match?match[2]:raw,attn:(columns[6]||'').trim(),phone:phoneMatch?phoneMatch[1].trim():'',address:phoneMatch?addressPhone.slice(0,phoneMatch.index).trim():addressPhone,sender:''};
    }).map(normalizeLabel).map(row=>applyRememberedCompanyDefaults(row,true)).filter(row=>row.company&&!/^(penerima|recipient|company)$/i.test(row.company));
    if(!parsed.length)return toast('No valid rows detected');
    const seen=new Set();
    const unique=parsed.filter(row=>{const key=bulkDuplicateKey(row);if(seen.has(key))return false;seen.add(key);return true});
    const duplicateCount=parsed.length-unique.length;
    const rows=unique.slice(0,MAX_LABELS);
    rows.forEach(row=>rememberCompanyDefaults(row,false));
    persistCompanyMemory();
    labels=rows;
    selected=0;
    save('ksb-labels',labels);
    closeModals();
    renderAll();
    const limited=unique.length>MAX_LABELS;
    let message=limited?`Imported first ${MAX_LABELS} of ${unique.length} unique labels`:`${rows.length} labels imported`;
    if(duplicateCount)message+=` · ${duplicateCount} duplicate${duplicateCount===1?'':'s'} removed`;
    toast(message);
  }

  const testButton=document.getElementById('testConnection');
  const saveButton=document.getElementById('saveConnection');
  const importButton=document.getElementById('importRows');
  if(testButton)testButton.onclick=testEndpointSafely;
  if(saveButton)saveButton.onclick=saveEndpointSafely;
  if(importButton)importButton.onclick=importRowsWithCompanyDefaults;

  window.addEventListener('unhandledrejection',event=>{
    const message=String(event.reason?.message||event.reason||'Unexpected error');
    console.error('Unhandled LabelPrint error:',event.reason);
    if(!/AbortError/i.test(message))toast('Something went wrong. Your local data is still safe.');
  });
})();
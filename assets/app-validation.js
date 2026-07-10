(()=>{
  function endpointField(){return document.getElementById('endpoint')}
  function connectionResult(){return document.getElementById('connectionResult')}

  function validateEndpoint(value){
    const raw=clean(value);
    if(!raw)throw new Error('Enter an Apps Script web-app URL');
    const url=new URL(raw);
    if(!/^https?:$/.test(url.protocol))throw new Error('The backend URL must use HTTPS');
    if(!/\/exec\/?$/i.test(url.pathname))throw new Error('Use the deployed Apps Script URL ending in /exec');
    return url.toString();
  }

  async function testEndpointSafely(){
    const field=endpointField(),result=connectionResult();
    if(!field||!result)return;
    const previousUrl=localStorage.getItem('ksb-endpoint');
    const previousRevision=localStorage.getItem('ksb-endpoint-revision');
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
    }
  }

  async function saveEndpointSafely(){
    const field=endpointField(),result=connectionResult();
    if(!field)return;
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
    }
  }

  const testButton=document.getElementById('testConnection');
  const saveButton=document.getElementById('saveConnection');
  if(testButton)testButton.onclick=testEndpointSafely;
  if(saveButton)saveButton.onclick=saveEndpointSafely;

  window.addEventListener('unhandledrejection',event=>{
    const message=String(event.reason?.message||event.reason||'Unexpected error');
    console.error('Unhandled LabelPrint error:',event.reason);
    if(!/AbortError/i.test(message))toast('Something went wrong. Your local data is still safe.');
  });
})();
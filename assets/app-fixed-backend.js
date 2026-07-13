(()=>{
  const FIXED_BACKEND_URL='https://script.google.com/macros/s/AKfycbwVOHKp4BIbj0rbMNV-y543i7L-175E8CbjFlz2f5kA6RYqpt9aj2crriQ-unsW9RO9/exec';

  try{CONFIG.endpoint=FIXED_BACKEND_URL}catch{}
  try{
    localStorage.removeItem('ksb-endpoint');
    localStorage.removeItem('ksb-endpoint-revision');
  }catch{}

  endpoint=function(){return FIXED_BACKEND_URL};

  const field=document.getElementById('endpoint');
  const result=document.getElementById('connectionResult');
  const testButton=document.getElementById('testConnection');
  const saveButton=document.getElementById('saveConnection');

  if(field){
    field.value=FIXED_BACKEND_URL;
    field.readOnly=true;
    field.setAttribute('aria-readonly','true');
    field.title='This backend is fixed by the LabelPrint deployment';
  }

  async function testFixedBackend(){
    if(!result)return;
    if(testButton)testButton.disabled=true;
    try{
      result.textContent='Testing fixed backend…';
      const response=await apiGet('ping');
      if(!response?.success)throw new Error('Invalid LabelPrint API response');
      result.textContent=`Connected to ${response.spreadsheetName||'Google Sheets'} · API ${response.apiVersion||'unknown'}.`;
      window.__lastSheetsError='';
    }catch(error){
      window.__lastSheetsError=String(error?.message||error);
      result.textContent='Connection failed: '+window.__lastSheetsError;
    }finally{
      if(testButton)testButton.disabled=false;
    }
  }

  if(testButton)testButton.onclick=testFixedBackend;
  if(saveButton){
    saveButton.textContent='Backend locked';
    saveButton.disabled=true;
    saveButton.title='The Google Sheets backend is hardcoded in this deployment';
  }

  window.LabelPrintBackend={url:FIXED_BACKEND_URL,test:testFixedBackend,locked:true};
})();

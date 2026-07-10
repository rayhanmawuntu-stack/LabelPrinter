const MAX_LABELS=20;
if(labels.length>MAX_LABELS){labels=labels.slice(0,MAX_LABELS);save('ksb-labels',labels)}
function renderCards(){
  const searchInput=$('search');
  const q=clean(searchInput?.value).toLowerCase();
  const shown=labels.map((r,i)=>({r,i})).filter(x=>!q||[full(x.r),x.r.attn,x.r.address,x.r.phone,x.r.sender].join(' ').toLowerCase().includes(q));
  const atLimit=labels.length>=MAX_LABELS;
  const cards=$('cards');
  cards.innerHTML=shown.map(x=>`<button type="button" class="recipient ${x.i===selected?'active':''}" data-label="${x.i}"><span class="num">${String(x.i+1).padStart(2,'0')}</span><b>${esc(full(x.r)||'Blank recipient')}</b><span>${esc(x.r.attn||x.r.address||'Ready to edit')}</span></button>`).join('')+`<button type="button" class="recipient add" id="addCard" ${atLimit?'disabled':''}><b>${atLimit?`${MAX_LABELS} label limit reached`:'＋ Add recipient'}</b></button>`;
  cards.querySelectorAll('[data-label]').forEach(button=>button.onclick=()=>{selected=Number(button.dataset.label);renderAll()});
  const addCard=cards.querySelector('#addCard');
  if(addCard)addCard.onclick=addLabel;
  $('batchCount').textContent=`${labels.length} / ${MAX_LABELS}`;
  $('statCount').textContent=labels.length;
  const addTop=$('addRecipient'),clearButton=$('clearAll');
  if(addTop){addTop.disabled=atLimit;addTop.title=atLimit?`Maximum ${MAX_LABELS} labels per batch`:''}
  if(clearButton)clearButton.disabled=!labels.length;
}
function syncSenderControls(value){
  const sender=clean(value)||'KSB INDONESIA';
  const custom=!['KSB INDONESIA','KSB SALES INDONESIA'].includes(sender);
  const senderControl=$('sender'),customField=$('customField'),customSender=$('customSender');
  if(senderControl)senderControl.value=custom?'__CUSTOM__':sender;
  if(customField)customField.classList.toggle('hidden',!custom);
  if(customSender)customSender.value=custom?sender:'';
}
function renderForm(){
  selected=Math.max(0,Math.min(selected,Math.max(0,labels.length-1)));
  const hasLabel=labels.length>0;
  if(hasLabel)labels[selected]=applyRememberedCompanyDefaults(labels[selected],false);
  const r=hasLabel?labels[selected]:blankLabel();
  $('editIndex').textContent=hasLabel?String(selected+1).padStart(2,'0'):'00';
  ['prefix','company','attn','phone','address'].forEach(id=>$(id).value=r[id]||'');
  syncSenderControls(r.sender);
  const removeButton=$('remove'),duplicateButton=$('duplicate');
  if(removeButton)removeButton.disabled=!hasLabel;
  if(duplicateButton)duplicateButton.disabled=!hasLabel;
  if(hasLabel)rememberCompanyDefaults(r);
  saveSoon('ksb-labels',labels);
}
const renderPreviewSoon=debounce(()=>renderPreview(),80);
function update(id,val){
  if(!labels[selected])labels[selected]=blankLabel();
  labels[selected][id]=val;
  labels[selected]=normalizeLabel(labels[selected]);
  if(id==='company'){
    const remembered=companyDefaultsFromHistory(labels[selected].company);
    if(remembered.prefix){
      labels[selected].prefix=remembered.prefix;
      const prefixControl=$('prefix');
      if(prefixControl)prefixControl.value=remembered.prefix;
    }
    if(remembered.sender){
      labels[selected].sender=remembered.sender;
      syncSenderControls(remembered.sender);
    }
  }
  if(id==='prefix'||id==='sender')rememberCompanyDefaults(labels[selected]);
  saveSoon('ksb-labels',labels);
  renderCards();
  renderPreviewSoon();
}
function addLabel(event){
  event?.preventDefault?.();
  labels=Array.isArray(labels)?labels:[];
  if(labels.length>=MAX_LABELS)return toast(`Maximum ${MAX_LABELS} labels per batch`);
  const searchInput=$('search');
  if(searchInput)searchInput.value='';
  labels.push(blankLabel());
  selected=labels.length-1;
  historySelected=null;
  save('ksb-labels',labels);
  if(active!=='create')switchView('create');
  renderAll();
  requestAnimationFrame(()=>$('company')?.focus());
}
function removeLabel(){
  if(!labels.length)return;
  if(labels.length===1){labels=[];selected=0;save('ksb-labels',labels);renderAll();return toast('Recipient removed')}
  labels.splice(selected,1);
  selected=Math.max(0,selected-1);
  save('ksb-labels',labels);
  renderAll();
}
function clearAllLabels(){
  if(!labels.length)return toast('Current batch is already empty');
  if(!window.confirm(`Remove all ${labels.length} label${labels.length===1?'':'s'} from the current batch?`))return;
  labels=[];
  selected=0;
  historySelected=null;
  save('ksb-labels',labels);
  renderAll();
  toast('Current batch cleared');
}
function duplicate(){
  if(labels.length>=MAX_LABELS)return toast(`Maximum ${MAX_LABELS} labels per batch`);
  if(!labels[selected])return addLabel();
  labels.splice(selected+1,0,clone(labels[selected]));
  selected++;
  save('ksb-labels',labels);
  renderAll();
}
const MAX_LABELS=20;
if(labels.length>MAX_LABELS){labels=labels.slice(0,MAX_LABELS);save('ksb-labels',labels)}
function renderCards(){
  const q=$('search').value.trim().toLowerCase();
  const shown=labels.map((r,i)=>({r,i})).filter(x=>!q||[full(x.r),x.r.attn,x.r.address,x.r.phone].join(' ').toLowerCase().includes(q));
  const atLimit=labels.length>=MAX_LABELS;
  $('cards').innerHTML=shown.map(x=>`<button class="recipient ${x.i===selected?'active':''}" data-label="${x.i}"><span class="num">${String(x.i+1).padStart(2,'0')}</span><b>${esc(full(x.r)||'Blank recipient')}</b><span>${esc(x.r.attn||x.r.address||'Ready to edit')}</span></button>`).join('')+`<button class="recipient add" id="addCard" ${atLimit?'disabled':''}><b>${atLimit?`${MAX_LABELS} label limit reached`:'＋ Add recipient'}</b></button>`;
  document.querySelectorAll('[data-label]').forEach(b=>b.onclick=()=>{selected=+b.dataset.label;renderAll()});
  $('addCard').onclick=addLabel;
  $('batchCount').textContent=`${labels.length} / ${MAX_LABELS}`;
  $('statCount').textContent=labels.length;
  const addTop=$('addRecipient'),clearButton=$('clearAll');
  if(addTop){addTop.disabled=atLimit;addTop.title=atLimit?`Maximum ${MAX_LABELS} labels per batch`:''}
  if(clearButton)clearButton.disabled=!labels.length;
}
function renderForm(){
  selected=Math.max(0,Math.min(selected,Math.max(0,labels.length-1)));
  const hasLabel=labels.length>0;
  if(hasLabel)labels[selected]=applyRememberedPrefix(labels[selected]);
  const r=hasLabel?labels[selected]:blankLabel();
  $('editIndex').textContent=hasLabel?String(selected+1).padStart(2,'0'):'00';
  ['prefix','company','attn','phone','address'].forEach(id=>$(id).value=r[id]||'');
  const custom=!!r.sender&&!['KSB INDONESIA','KSB SALES INDONESIA'].includes(r.sender);
  $('sender').value=custom?'__CUSTOM__':r.sender||'KSB INDONESIA';
  $('customField').classList.toggle('hidden',!custom);
  $('customSender').value=custom?r.sender:'';
  const removeButton=$('remove'),duplicateButton=$('duplicate');
  if(removeButton)removeButton.disabled=!hasLabel;
  if(duplicateButton)duplicateButton.disabled=!hasLabel;
  if(hasLabel)rememberCompanyPrefix(r);
  saveSoon('ksb-labels',labels);
}
const renderPreviewSoon=debounce(()=>renderPreview(),80);
function update(id,val){
  if(!labels[selected])labels[selected]=blankLabel();
  labels[selected][id]=val;
  labels[selected]=normalizeLabel(labels[selected]);
  if(id==='company'){
    const remembered=prefixFromHistory(labels[selected].company);
    if(remembered&&labels[selected].prefix!==remembered){
      labels[selected].prefix=remembered;
      const prefixControl=$('prefix');
      if(prefixControl)prefixControl.value=remembered;
    }
  }
  if(id==='prefix'||id==='company')rememberCompanyPrefix(labels[selected]);
  saveSoon('ksb-labels',labels);
  renderCards();
  renderPreviewSoon();
}
function addLabel(){
  if(labels.length>=MAX_LABELS)return toast(`Maximum ${MAX_LABELS} labels per batch`);
  labels.push(blankLabel());
  selected=labels.length-1;
  save('ksb-labels',labels);
  renderAll();
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
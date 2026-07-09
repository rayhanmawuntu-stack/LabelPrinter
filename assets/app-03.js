function renderCards(){
  const q=$('search').value.trim().toLowerCase();
  const shown=labels.map((r,i)=>({r,i})).filter(x=>!q||[full(x.r),x.r.attn,x.r.address,x.r.phone].join(' ').toLowerCase().includes(q));
  $('cards').innerHTML=shown.map(x=>`<button class="recipient ${x.i===selected?'active':''}" data-label="${x.i}"><span class="num">${String(x.i+1).padStart(2,'0')}</span><b>${esc(full(x.r)||'Blank recipient')}</b><span>${esc(x.r.attn||x.r.address||'Ready to edit')}</span></button>`).join('')+`<button class="recipient add" id="addCard"><b>＋ Add recipient</b></button>`;
  document.querySelectorAll('[data-label]').forEach(b=>b.onclick=()=>{selected=+b.dataset.label;renderAll()});
  $('addCard').onclick=addLabel;
  $('batchCount').textContent=$('statCount').textContent=labels.length;
}
function renderForm(){
  if(!labels.length)labels=[blankLabel()];
  selected=Math.max(0,Math.min(selected,labels.length-1));
  labels[selected]=normalizeLabel(labels[selected]);
  const r=labels[selected];
  $('editIndex').textContent=String(selected+1).padStart(2,'0');
  ['prefix','company','attn','phone','address'].forEach(id=>$(id).value=r[id]||'');
  const custom=!!r.sender&&!['KSB INDONESIA','KSB SALES INDONESIA'].includes(r.sender);
  $('sender').value=custom?'__CUSTOM__':r.sender||'KSB INDONESIA';
  $('customField').classList.toggle('hidden',!custom);
  $('customSender').value=custom?r.sender:'';
  saveSoon('ksb-labels',labels);
}
const renderPreviewSoon=debounce(()=>renderPreview(),80);
function update(id,val){
  if(!labels[selected])labels[selected]=blankLabel();
  labels[selected][id]=val;
  labels[selected]=normalizeLabel(labels[selected]);
  saveSoon('ksb-labels',labels);
  renderCards();
  renderPreviewSoon();
}
function addLabel(){
  labels.push(blankLabel());
  selected=labels.length-1;
  save('ksb-labels',labels);
  renderAll();
}
function removeLabel(){
  if(labels.length===1){labels=[blankLabel()];selected=0;save('ksb-labels',labels);renderAll();return toast('Cleared recipient')}
  labels.splice(selected,1);
  selected=Math.max(0,selected-1);
  save('ksb-labels',labels);
  renderAll();
}
function duplicate(){
  if(!labels[selected])return addLabel();
  labels.splice(selected+1,0,clone(labels[selected]));
  selected++;
  save('ksb-labels',labels);
  renderAll();
}

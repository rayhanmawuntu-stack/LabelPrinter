function labelHTML(r){
  r=normalizeLabel(r||{});
  const name=full(r);
  const attn=clean(r.attn);
  const address=clean(r.address);
  const phone=clean(r.phone);
  return `<div class="slot"><article class="physical"><img class="label-logo" src="${CONFIG.logo}" alt="KSB"><div class="copy"><p class="field-label">Penerima :</p><div class="recipient-name">${name?esc(name):'&nbsp;'}</div><div class="attn">${attn?`Attn: ${esc(attn)}`:'&nbsp;'}</div><div class="address">${address?esc(address):'&nbsp;'} ${phone?`<i>(${esc(phone)})</i>`:''}</div></div><div class="divider"></div><div class="sender"><p class="field-label">Pengirim :</p><div class="sender-name">${esc(r.sender||'KSB INDONESIA')}</div></div></article></div>`;
}
function previewEmptySlotHTML(index){
  return `<div class="slot preview-empty-slot" aria-hidden="true"><span>${String(index+1).padStart(2,'0')}</span></div>`;
}
function sheetHTML(rows=labels,previewMode=false){
  const l=LAYOUTS[layout],chunk=(rows.length?rows:[blankLabel()]).slice(0,l.n),slots=chunk.map(labelHTML),scale=l.s||1,scaleX=l.sx||scale,scaleY=l.sy||scale;
  if(previewMode){
    while(slots.length<l.n)slots.push(previewEmptySlotHTML(slots.length));
  }
  const classes=['sheet',`layout-${layout}`,previewMode?'preview-sheet':'',l.adaptive?'adaptive-labels':''].filter(Boolean).join(' ');
  return `<div class="${classes}" style="--cols:${l.c};--rows:${l.r};--cw:${l.w}mm;--ch:${l.h}mm;--scale:${scale};--scale-x:${scaleX};--scale-y:${scaleY}">${slots.join('')}</div>`;
}
function pagesHTML(rows=labels){
  const l=LAYOUTS[layout],printRows=rows.length?rows:[blankLabel()];
  let out='';
  for(let i=0;i<Math.max(1,printRows.length);i+=l.n){
    out+=`<section class="print-page">${sheetHTML(printRows.slice(i,i+l.n),false)}</section>`;
  }
  return out;
}
function fitText(root=document){
  const lowSpec=!!window.LabelPrintPerformance?.lowSpec;
  const iterations=lowSpec?5:7;
  root.querySelectorAll('.physical').forEach(el=>{
    const targets=[el.querySelector('.copy'),el.querySelector('.sender'),el.querySelector('.recipient-name')].filter(Boolean);
    const overflows=()=>targets.some(x=>x.scrollHeight>x.clientHeight+1||x.scrollWidth>x.clientWidth+1);
    el.style.setProperty('--fit','1');
    if(!overflows())return;
    let low=.52,high=1,best=.52;
    for(let i=0;i<iterations;i++){
      const mid=(low+high)/2;
      el.style.setProperty('--fit',mid.toFixed(3));
      if(overflows())high=mid;else{best=mid;low=mid}
    }
    el.style.setProperty('--fit',best.toFixed(3));
  });
}
function previewSignature(rows){
  return `${layout}|${rows.map(row=>{const r=normalizeLabel(row);return[r.prefix,r.company,r.attn,r.phone,r.address,r.sender].join('\u001f')}).join('\u001e')}`;
}
function renderPreview(){
  const rows=labels.length?labels:[blankLabel()];
  const page=$('page'),stage=$('stage');
  const signature=previewSignature(rows);
  const changed=page.dataset.previewSignature!==signature;
  if(changed){
    page.style.transform='none';
    page.innerHTML=sheetHTML(rows,true);
    page.dataset.previewSignature=signature;
    if(stage)delete stage.dataset.previewScale;
  }
  const l=LAYOUTS[layout];
  $('statLayout').textContent=l.label;
  $('statSize').textContent=`${l.w} × ${l.h} mm`;
  $('layoutCaption').textContent=`${l.label} layout`;
  $('pageCount').textContent=`${Math.max(1,Math.ceil(rows.length/l.n))} page${rows.length>l.n?'s':''}`;
  requestAnimationFrame(()=>{
    if(changed)fitText(page);
    fitPreview();
  });
}
function fitPreview(){
  const page=$('page'),viewport=$('viewport'),stage=$('stage'),sheet=page?.querySelector('.sheet');
  if(!sheet||!stage||!viewport)return;
  const naturalWidth=sheet.offsetWidth,naturalHeight=sheet.offsetHeight;
  if(!naturalWidth||!naturalHeight)return;
  const styles=getComputedStyle(stage);
  const horizontalPadding=(parseFloat(styles.paddingLeft)||0)+(parseFloat(styles.paddingRight)||0);
  const verticalPadding=(parseFloat(styles.paddingTop)||0)+(parseFloat(styles.paddingBottom)||0);
  const availableWidth=Math.max(1,stage.clientWidth-horizontalPadding-18);
  const availableHeight=Math.max(1,stage.clientHeight-verticalPadding-18);
  const scale=Math.max(.12,Math.min(.72,availableWidth/naturalWidth,availableHeight/naturalHeight));
  const scaleKey=scale.toFixed(3);
  if(stage.dataset.previewScale===scaleKey&&page.style.transform)return;
  page.style.transformOrigin='top left';
  page.style.transform=`scale(${scale})`;
  viewport.style.width=`${Math.ceil(naturalWidth*scale)}px`;
  viewport.style.height=`${Math.ceil(naturalHeight*scale)}px`;
  viewport.style.margin='auto';
  stage.scrollTop=0;
  stage.scrollLeft=0;
  stage.dataset.previewScale=scaleKey;
}
function renderLayouts(){
  $('layouts').innerHTML=Object.entries(LAYOUTS).map(([k,v])=>`<button class="layout ${k===layout?'active':''}" data-layout="${k}">${v.label}</button>`).join('');
  document.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>{layout=b.dataset.layout;localStorage.setItem('ksb-layout',layout);const page=$('page'),stage=$('stage');if(page)delete page.dataset.previewSignature;if(stage)delete stage.dataset.previewScale;renderLayouts();renderPreview()});
}
function renderAll(){renderCards();renderForm();renderLayouts();renderPreview()}
function labelHTML(r){
  r=normalizeLabel(r||{});
  const name=full(r);
  const attn=clean(r.attn);
  const address=clean(r.address);
  const phone=clean(r.phone);
  return `<div class="slot"><article class="physical"><img class="label-logo" src="${CONFIG.logo}" alt="KSB"><div class="copy"><p class="field-label">Penerima :</p><div class="recipient-name">${name?esc(name):'&nbsp;'}</div><div class="attn">${attn?`Attn: ${esc(attn)}`:'&nbsp;'}</div><div class="address">${address?esc(address):'&nbsp;'} ${phone?`<i>(${esc(phone)})</i>`:''}</div></div><div class="divider"></div><div class="sender"><p class="field-label">Pengirim :</p><div class="sender-name">${esc(r.sender||'KSB INDONESIA')}</div></div></article></div>`;
}
function sheetHTML(rows=labels){
  const l=LAYOUTS[layout],chunk=(rows.length?rows:[blankLabel()]).slice(0,l.n);
  return `<div class="sheet" style="--cols:${l.c};--rows:${l.r};--cw:${l.w}mm;--ch:${l.h}mm;--scale:${l.s}">${chunk.map(labelHTML).join('')}</div>`;
}
function pagesHTML(rows=labels){
  const l=LAYOUTS[layout],printRows=rows.length?rows:[blankLabel()];
  let out='';
  for(let i=0;i<Math.max(1,printRows.length);i+=l.n)out+=sheetHTML(printRows.slice(i,i+l.n));
  return out;
}
function fitText(root=document){
  root.querySelectorAll('.physical').forEach(el=>{
    const targets=[el.querySelector('.copy'),el.querySelector('.sender'),el.querySelector('.recipient-name')];
    let s=1,g=0;
    el.style.setProperty('--fit',s);
    while(targets.some(x=>x&&(x.scrollHeight>x.clientHeight+1||x.scrollWidth>x.clientWidth+1))&&s>.52&&g<25){s-=.02;el.style.setProperty('--fit',s.toFixed(2));g++}
  });
}
function renderPreview(){
  const rows=labels.length?labels:[blankLabel()];
  const page=$('page');
  page.style.transform='none';
  page.innerHTML=sheetHTML(rows);
  const l=LAYOUTS[layout];
  $('statLayout').textContent=l.label;
  $('statSize').textContent=`${l.w} × ${l.h} mm`;
  $('layoutCaption').textContent=`${l.label} layout`;
  $('pageCount').textContent=`${Math.max(1,Math.ceil(rows.length/l.n))} page${rows.length>l.n?'s':''}`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{fitText(page);fitPreview()}));
}
function fitPreview(){
  const page=$('page'),viewport=$('viewport'),stage=$('stage'),sheet=page?.querySelector('.sheet');
  if(!sheet||!stage||!viewport)return;
  const naturalWidth=sheet.offsetWidth,naturalHeight=sheet.offsetHeight;
  if(!naturalWidth||!naturalHeight)return;
  const styles=getComputedStyle(stage);
  const horizontalPadding=(parseFloat(styles.paddingLeft)||0)+(parseFloat(styles.paddingRight)||0);
  const verticalPadding=(parseFloat(styles.paddingTop)||0)+(parseFloat(styles.paddingBottom)||0);
  const availableWidth=Math.max(1,stage.clientWidth-horizontalPadding-10);
  const availableHeight=Math.max(1,stage.clientHeight-verticalPadding-10);
  const widthScale=availableWidth/naturalWidth;
  const heightScale=availableHeight/naturalHeight;
  const scale=Math.max(.12,Math.min(.72,widthScale,heightScale));
  page.style.transformOrigin='top left';
  page.style.transform=`scale(${scale})`;
  viewport.style.width=`${Math.ceil(naturalWidth*scale)}px`;
  viewport.style.height=`${Math.ceil(naturalHeight*scale)}px`;
  viewport.style.margin='auto';
  stage.scrollTop=0;
  stage.scrollLeft=0;
  stage.dataset.previewScale=scale.toFixed(3);
}
function renderLayouts(){
  $('layouts').innerHTML=Object.entries(LAYOUTS).map(([k,v])=>`<button class="layout ${k===layout?'active':''}" data-layout="${k}">${v.label}</button>`).join('');
  document.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>{layout=b.dataset.layout;localStorage.setItem('ksb-layout',layout);renderLayouts();renderPreview()});
}
function renderAll(){renderCards();renderForm();renderLayouts();renderPreview()}

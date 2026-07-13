(()=>{
  const KEY='ksb-print-logo';
  let enabled=true;
  try{
    const saved=localStorage.getItem(KEY);
    if(saved==='0'||saved==='false')enabled=false;
  }catch{}

  window.printLogoEnabled=enabled;

  window.labelHTML=function(r){
    r=normalizeLabel(r||{});
    const name=full(r),attn=clean(r.attn),address=clean(r.address),phone=clean(r.phone);
    const logo=enabled?`<img class="label-logo" src="${CONFIG.logo}" alt="KSB">`:'';
    return `<div class="slot"><article class="physical ${enabled?'with-logo':'no-logo'}">${logo}<div class="copy"><p class="field-label">Penerima :</p><div class="recipient-name">${name?esc(name):'&nbsp;'}</div><div class="attn">${attn?`Attn: ${esc(attn)}`:'&nbsp;'}</div><div class="address">${address?esc(address):'&nbsp;'} ${phone?`<i>(${esc(phone)})</i>`:''}</div></div><div class="divider"></div><div class="sender"><p class="field-label">Pengirim :</p><div class="sender-name">${esc(r.sender||'KSB INDONESIA')}</div></div></article></div>`;
  };

  window.previewSignature=function(rows){
    return `${layout}|logo:${enabled?1:0}|${rows.map(row=>{const r=normalizeLabel(row);return[r.prefix,r.company,r.attn,r.phone,r.address,r.sender].join('\u001f')}).join('\u001e')}`;
  };

  const layouts=document.getElementById('layouts');
  if(!layouts)return;
  const control=document.createElement('button');
  control.type='button';
  control.id='printLogoToggle';
  control.className='print-logo-toggle';
  control.setAttribute('role','switch');
  control.innerHTML='<span class="print-logo-copy"><b>KSB logo</b><small id="printLogoState"></small></span><span class="print-logo-switch" aria-hidden="true"><i></i></span>';
  layouts.insertAdjacentElement('afterend',control);

  function syncControl(){
    control.setAttribute('aria-checked',String(enabled));
    control.classList.toggle('active',enabled);
    const state=document.getElementById('printLogoState');
    if(state)state.textContent=enabled?'Included on preview and print':'Hidden from preview and print';
  }

  function apply(value,persist=true,announce=true){
    enabled=!!value;
    window.printLogoEnabled=enabled;
    if(persist){try{localStorage.setItem(KEY,enabled?'1':'0')}catch{}}
    syncControl();
    const page=document.getElementById('page'),stage=document.getElementById('stage');
    if(page)delete page.dataset.previewSignature;
    if(stage)delete stage.dataset.previewScale;
    if(typeof renderPreview==='function')renderPreview();
    if(announce&&typeof toast==='function')toast(enabled?'KSB logo enabled for print':'KSB logo hidden from print');
    window.dispatchEvent(new CustomEvent('labelprint:printlogochange',{detail:{enabled}}));
  }

  control.addEventListener('click',()=>apply(!enabled,true,true));
  syncControl();
  window.LabelPrintLogo={get:()=>enabled,set:value=>apply(value,true,false)};
})();
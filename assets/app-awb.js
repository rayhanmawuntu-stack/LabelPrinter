(()=>{
  const JNE_TRACKING_URL='https://www.jne.co.id/id/tracking/trace';
  const UNIVERSAL_TRACKING_URL='https://www.17track.net/en';

  function selectedRow(){return labels[selected]||blankLabel()}
  function trackingUrl(row){
    const r=normalizeLabel(row||{}),awb=encodeURIComponent(r.awb);
    return r.courier==='JNE'?JNE_TRACKING_URL:`${UNIVERSAL_TRACKING_URL}?nums=${awb}`;
  }
  async function copyAwb(awb){
    if(!navigator.clipboard?.writeText)return false;
    try{await navigator.clipboard.writeText(awb);return true}catch{return false}
  }
  async function openAwbTracking(row=selectedRow()){
    const r=normalizeLabel(row||{});
    if(!r.awb){$('awb')?.focus();toast('Enter an AWB / resi number first');return false}
    const copied=await copyAwb(r.awb);
    const opened=window.open(trackingUrl(r),'_blank','noopener,noreferrer');
    if(!opened)toast('Allow pop-ups to open tracking');
    else toast(`${r.courier==='JNE'?'JNE':'Package'} tracking opened${copied?' · AWB copied':''}`);
    return !!opened;
  }
  function trackButtonHTML(row,label='Track'){
    const r=normalizeLabel(row||{});
    if(!r.awb)return'';
    return `<button class="awb-track-link" type="button" data-track-awb="${esc(r.awb)}" data-track-courier="${esc(r.courier)}">${esc(label)}</button>`;
  }
  function syncAwbTrackingControl(row=selectedRow()){
    const r=normalizeLabel(row||{}),button=$('trackAwb'),help=$('awbHelp');
    if(button){button.disabled=!r.awb;button.textContent=r.courier==='JNE'?'Track JNE':'Track package';button.title=r.awb?`Track ${r.awb}`:'Enter an AWB / resi number first'}
    if(help)help.textContent=r.courier==='JNE'?'Opens JNE tracking and copies the AWB':'Opens a universal tracking page';
  }

  const phoneField=$('phone')?.closest('.field'),form=phoneField?.parentElement;
  if(form&&!$('awb')){
    phoneField.insertAdjacentHTML('afterend',`<div class="field awb-courier-field"><label>Courier</label><select class="control" id="courier"><option value="JNE">JNE</option><option value="OTHER">Other courier</option></select></div><div class="field two awb-number-field"><label>AWB / resi</label><div class="awb-control-row"><input class="control" id="awb" inputmode="text" autocomplete="off" spellcheck="false" placeholder="Enter tracking number"><button class="awb-track-button" id="trackAwb" type="button">Track JNE</button></div><small class="awb-help" id="awbHelp">Opens JNE tracking and copies the AWB</small></div>`);
  }

  $('awb')?.addEventListener('input',event=>{update('awb',normalizeAwb(event.target.value));event.target.value=normalizeAwb(event.target.value);syncAwbTrackingControl()});
  $('courier')?.addEventListener('change',event=>{update('courier',event.target.value);syncAwbTrackingControl()});
  $('trackAwb')?.addEventListener('click',()=>openAwbTracking());
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-track-awb]');
    if(!button)return;
    event.preventDefault();
    openAwbTracking({awb:button.dataset.trackAwb,courier:button.dataset.trackCourier||'JNE'});
  });

  window.LabelPrintAwb={open:openAwbTracking,buttonHTML:trackButtonHTML,sync:syncAwbTrackingControl,url:trackingUrl};
})();

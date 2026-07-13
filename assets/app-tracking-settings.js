(()=>{
  const CARD_HTML=`
    <div class="tracking-api-panel tracking-settings-card">
      <div class="tracking-api-copy">
        <span class="tracking-mode"><i></i> External tracking mode</span>
        <h2>Live courier API not configured</h2>
        <p>Tracking buttons open CekResi for JNE and a universal tracking page for other couriers. The interface is ready for a secure Apps Script API proxy later.</p>
      </div>
      <div class="tracking-api-meta">
        <span>Provider</span><strong>Courier web tracking</strong>
        <span>Credential exposure</span><strong>None</strong>
        <span>Last refreshed</span><strong id="trackingRefreshedAt">On opening Tracking tab</strong>
      </div>
    </div>`;

  function installTrackingSettings(){
    const settingsModal=$('settingsModal');
    if(!settingsModal)return false;

    let section=settingsModal.querySelector('.tracking-settings-section');
    if(!section){
      section=document.createElement('section');
      section.className='settings-section tracking-settings-section';
      section.innerHTML=`
        <h4 class="settings-section-title">Shipment tracking</h4>
        <p class="settings-section-copy">Review the active tracking method and how shipment links are handled.</p>
        ${CARD_HTML}`;

      const backendSection=$('endpoint')?.closest('.settings-section');
      if(backendSection)backendSection.before(section);
      else settingsModal.querySelector('.modal-card')?.appendChild(section);
    }

    document.querySelectorAll('#trackingView .tracking-api-panel').forEach(panel=>panel.remove());
    return true;
  }

  if(installTrackingSettings())return;

  const observer=new MutationObserver(()=>{
    if(installTrackingSettings())observer.disconnect();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),5000);
})();

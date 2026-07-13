(()=>{
  const settingsModal=$('settingsModal');
  const trackingPanel=document.querySelector('.tracking-api-panel');
  if(!settingsModal||!trackingPanel||settingsModal.querySelector('.tracking-settings-section'))return;

  const section=document.createElement('section');
  section.className='settings-section tracking-settings-section';
  section.innerHTML=`
    <h4 class="settings-section-title">Shipment tracking</h4>
    <p class="settings-section-copy">Review the active tracking method and how shipment links are handled.</p>`;

  trackingPanel.classList.remove('panel');
  trackingPanel.classList.add('tracking-settings-card');
  const refreshed=trackingPanel.querySelector('#trackingRefreshedAt');
  if(refreshed&&refreshed.textContent.trim()==='—')refreshed.textContent='On opening Tracking tab';
  section.appendChild(trackingPanel);

  const backendSection=$('endpoint')?.closest('.settings-section');
  if(backendSection)backendSection.before(section);
  else settingsModal.querySelector('.modal-card')?.appendChild(section);
})();

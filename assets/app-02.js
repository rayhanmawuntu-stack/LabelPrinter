document.documentElement.classList.toggle('profile-selected',!!currentUser);
async function sync(){
  if(syncInFlight)return;
  syncInFlight=true;
  setStatus('syncing','Connecting to Sheets…');
  try{
    const p=await apiGet('ping');
    if(!p?.success)throw Error('Invalid LabelPrint API response');
    setStatus('connected',`Sheets connected${p.spreadsheetName?` · ${p.spreadsheetName}`:''}`);
    const [u,h]=await Promise.all([apiGet('getUsers'),apiGet('getHistory',{limit:500})]);
    if(u?.users?.length){
      users=u.users.filter(x=>x&&x.name).map(x=>({name:clean(x.name),nickname:clean(x.nickname)||clean(x.name).split(/\s+/)[0]}));
      save('ksb-users',users);
      renderUsers();
    }
    if(h?.history){
      const merged=new Map(history.map(x=>[x.id,x]));
      h.history.forEach(x=>merged.set(x.id,{...x,labels:usableLabels(x.labels||[]),syncState:'synced'}));
      history=[...merged.values()].filter(x=>x?.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,1000);
      save('ksb-history',history);
      rebuildCompanyPrefixes();
      refreshDataSurfaces();
    }
    for(const batch of history.filter(x=>x.syncState==='pending'||x.syncState==='failed'))await syncBatch(batch,false);
    window.__lastSheetsError='';
  }catch(e){
    console.warn('Google Sheets connection failed:',e);
    connected=false;
    setStatus('error','Sheets error · tap for details');
    window.__lastSheetsError=String(e?.message||e);
    toast(window.__lastSheetsError);
  }finally{
    syncInFlight=false;
  }
}
async function syncBatch(batch,announce=true){
  if(!connected){
    batch.syncState='pending';
    save('ksb-history',history);
    if(announce)toast('Saved locally · sync pending');
    return false;
  }
  try{
    batch.labels=usableLabels(batch.labels||[]);
    if(!batch.labels.length)throw new Error('Batch has no printable labels');
    batch.labels.forEach(row=>rememberCompanyPrefix(row,false));
    save(COMPANY_PREFIX_KEY,companyPrefixes);
    const result=await post('saveBatch',batch);
    if(result?.queued){
      batch.syncState='pending';
      save('ksb-history',history);
      refreshDataSurfaces();
      if(announce)toast('Saved locally · backend confirmation pending');
      return false;
    }
    batch.syncState='synced';
    save('ksb-history',history);
    refreshDataSurfaces();
    if(announce)toast('Saved to Google Sheets');
    return true;
  }catch(e){
    batch.syncState='failed';
    save('ksb-history',history);
    refreshDataSurfaces();
    if(announce)toast(`Saved locally; sync failed: ${e?.message||e}`);
    return false;
  }
}
function updateProfilePreview(index){
  const avatar=$('pickerAvatar');
  if(!avatar)return;
  const user=Number.isInteger(index)&&users[index]?users[index]:null;
  avatar.textContent=user?initials(user.name):'?';
  avatar.classList.toggle('selected',!!user);
}
function renderUsers(){
  const select=$('userSelect'),continueButton=$('continueUser'),addButton=$('addUser');
  if(!select||!continueButton||!addButton)return;
  const activeName=currentUser?.name||'';
  select.innerHTML='<option value="">Select a profile</option>'+users.map((u,i)=>`<option value="${i}">${esc(u.name)}${u.nickname&&u.nickname!==u.name?` — ${esc(u.nickname)}`:''}</option>`).join('');
  const activeIndex=activeName?users.findIndex(u=>u.name===activeName):-1;
  if(activeIndex>=0){currentUser=users[activeIndex];select.value=String(activeIndex);updateProfilePreview(activeIndex)}else{select.value='';updateProfilePreview(-1)}
  select.onchange=()=>updateProfilePreview(select.value===''?-1:Number(select.value));
  continueButton.onclick=e=>{
    e.preventDefault();
    if(select.value==='')return toast('Select a profile to continue');
    selectUser(Number(select.value));
  };
  select.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();continueButton.click()}};
  addButton.onclick=async e=>{
    e.preventDefault();
    const name=clean(prompt('Full name'));
    if(!name)return;
    const nickname=clean(prompt('Nickname'))||name.split(/\s+/)[0];
    let index=users.findIndex(u=>u.name.toLowerCase()===name.toLowerCase());
    if(index<0){users.push({name,nickname});index=users.length-1;save('ksb-users',users);if(connected)await post('addUser',{name,nickname}).catch(()=>{})}
    renderUsers();
    $('userSelect').value=String(index);
    updateProfilePreview(index);
  };
}
function selectUser(i){
  if(!Number.isInteger(i)||!users[i])return toast('Select a valid profile');
  currentUser=users[i];
  document.documentElement.classList.add('profile-selected');
  const nick=currentUser.nickname||currentUser.name.split(' ')[0];
  const greeting=$('greeting'),heroName=$('heroName'),avatar=$('avatar'),entry=$('entry');
  if(greeting)greeting.textContent=`Hi, ${nick}!`;
  if(heroName)heroName.textContent=nick;
  if(avatar)avatar.textContent=initials(currentUser.name);
  if(entry){entry.classList.add('hidden');entry.classList.remove('show')}
  if(connected)post('logLogin',{name:currentUser.name,nickname:nick,source:'github-pages',userAgent:navigator.userAgent}).catch(()=>{});
}
function switchView(v){
  active=v;
  ['create','history','analytics'].forEach(n=>$(n+'View').classList.toggle('hidden',n!==v));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  $('subtitle').textContent={create:'Build and review today’s shipping labels.',history:'Review previously generated label batches.',analytics:'Track label usage and recurring recipients.'}[v];
  if(v==='history')renderHistory();
  if(v==='analytics')renderAnalytics();
  if(v==='create')requestAnimationFrame(fitPreview);
}
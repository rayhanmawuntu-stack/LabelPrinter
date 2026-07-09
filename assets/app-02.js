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
      renderHistory();
      renderAnalytics();
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
  if(!connected){batch.syncState='pending';save('ksb-history',history);return}
  try{
    batch.labels=usableLabels(batch.labels||[]);
    if(!batch.labels.length)throw new Error('Batch has no printable labels');
    await post('saveBatch',batch);
    batch.syncState='synced';
    save('ksb-history',history);
    renderHistory();
    if(announce)toast('Saved to Google Sheets');
  }catch(e){
    batch.syncState='failed';
    save('ksb-history',history);
    renderHistory();
    if(announce)toast(`Saved locally; sync failed: ${e?.message||e}`);
  }
}
function renderUsers(){
  $('users').innerHTML=users.map((u,i)=>`<button class="user" data-user="${i}"><div class="user-avatar">${initials(u.name)}</div><b>${esc(u.name)}</b><span>Continue as ${esc(u.nickname||u.name.split(' ')[0])}</span></button>`).join('')+`<button class="user" id="addUser"><div class="user-avatar">＋</div><b>Add profile</b><span>Save to Google Sheets</span></button>`;
  document.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>selectUser(+b.dataset.user));
  $('addUser').onclick=async()=>{const name=clean(prompt('Full name'));if(!name)return;const nickname=clean(prompt('Nickname'))||name.split(/\s+/)[0];if(!users.some(u=>u.name.toLowerCase()===name.toLowerCase()))users.push({name,nickname});save('ksb-users',users);renderUsers();if(connected)await post('addUser',{name,nickname})};
}
function selectUser(i){
  currentUser=users[i];
  const nick=currentUser.nickname||currentUser.name.split(' ')[0];
  $('greeting').textContent=`Hi, ${nick}!`;
  $('heroName').textContent=nick;
  $('avatar').textContent=initials(currentUser.name);
  $('entry').classList.add('hidden');
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

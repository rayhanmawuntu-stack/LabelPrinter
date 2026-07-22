/* Source: no-mock.js */
(()=>{
  const legacyCompanies=new Set(['MANDARA PERMAI','MULTI SARANA MARITIM','SAIPEM INDONESIA']);
  const normalize=item=>String((item&&item.company)||'').trim().toUpperCase();
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem('ksb-labels')||'null')}catch{saved=null}
  const hasLegacy=Array.isArray(saved)&&saved.length>0&&saved.some(item=>legacyCompanies.has(normalize(item)));
  if(!Array.isArray(saved)||hasLegacy){
    localStorage.setItem('ksb-labels','[]');
    localStorage.setItem('ksb-no-mock-cleaned','true');
  }
  localStorage.setItem('ksb-no-mock-startup','2026-07-08-02');
})();

;
/* Source: app-01.js */
const CONFIG={endpoint:'https://script.google.com/macros/s/AKfycbwVOHKp4BIbj0rbMNV-y543i7L-175E8CbjFlz2f5kA6RYqpt9aj2crriQ-unsW9RO9/exec',logo:'https://file.garden/ad-wGPVIV3ilAD_L/WORK%20PROJECT/LABEL%20MAKER/KSB_SVG.svg.png'};
const APP_REVISION='2026-07-13-invoice-awb-filter';
const ENDPOINT_REVISION='2026-07-08-03';
const LEGACY_ENDPOINTS=['https://script.google.com/macros/s/AKfycbwohEPF9QkHyX7FO2VpnFtzHwbx3kZawul3uZXHNtqk4QbHlMYQkp_J78pV46DjOzFd/exec'];
const LEGACY_SAMPLE_COMPANIES=new Set();
const LAYOUTS={'3x3':{c:3,r:3,n:9,w:91,h:62,s:1,label:'3 × 3'},'3x2':{c:3,r:2,n:6,w:91,h:62,s:1,label:'3 × 2'},'2x3':{c:2,r:3,n:6,w:139.5,h:62,s:1,adaptive:true,label:'2 × 3'},'2x2':{c:2,r:2,n:4,w:138.5,h:95,s:138.5/91,label:'2 × 2'},'2x1':{c:2,r:1,n:2,w:138.5,h:95,s:138.5/91,label:'2 × 1'},'1x1':{c:1,r:1,n:1,w:281,h:194,s:281/91,label:'1 × 1'}};
const SAMPLE=[];
const domCache=new Map();
function $(id){const cached=domCache.get(id);if(cached&&cached.isConnected&&cached.id===id)return cached;const node=document.getElementById(id);if(node)domCache.set(id,node);else domCache.delete(id);return node}
const clean=v=>String(v??'').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
function load(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch{return f}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.warn('Local save failed:',e)}}
const saveTimers={};
function saveSoon(k,v,delay=180){clearTimeout(saveTimers[k]);saveTimers[k]=setTimeout(()=>save(k,v),delay)}
function debounce(fn,delay=120){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),delay)}}
function normalizeAwb(value){return clean(value).replace(/\s+/g,'').toUpperCase()}
function blankLabel(){return{prefix:'',company:'',invoice:'',attn:'',phone:'',address:'',sender:'KSB INDONESIA',courier:'JNE',awb:''}}
function normalizeLabel(r={}){let prefix=clean(r.prefix).toUpperCase(),company=clean(r.company);const combined=company.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i);if(combined){if(!prefix)prefix=combined[1].toUpperCase();company=clean(combined[2])}const courier=clean(r.courier||r.shippingCourier||r.expedition||'JNE').toUpperCase()||'JNE';const awb=normalizeAwb(r.awb||r.resi||r.trackingNumber||r.tracking_number);const invoice=clean(r.invoice||r.invoiceNumber||r.invoice_number||r.invoiceNo||r.invoice_no);return{prefix,company,invoice,attn:clean(r.attn),phone:clean(r.phone),address:clean(r.address),sender:clean(r.sender)||'KSB INDONESIA',courier,awb}}
function isLegacySample(r){return LEGACY_SAMPLE_COMPANIES.has(clean(r?.company).toUpperCase())}
function hasLabelContent(r){return !![r?.company,r?.attn,r?.phone,r?.address].some(v=>clean(v))}
function usableLabels(rows=labels){return(Array.isArray(rows)?rows:[]).map(normalizeLabel).filter(r=>hasLabelContent(r)&&!isLegacySample(r))}
function startupLabels(){const rows=Array.isArray(load('ksb-labels',[]))?load('ksb-labels',[]):[];const filtered=rows.map(normalizeLabel).filter(r=>!isLegacySample(r));if(filtered.length!==rows.length)save('ksb-labels',filtered);return filtered}
function startupHistory(){const rows=Array.isArray(load('ksb-history',[]))?load('ksb-history',[]):[];const filtered=rows.map(b=>({...b,labels:usableLabels(b?.labels||[])})).filter(b=>b?.id&&b.labels.length).slice(0,1000);if(filtered.length!==rows.length)save('ksb-history',filtered);return filtered}
const COMPANY_PREFIX_KEY='ksb-company-prefixes';
const COMPANY_DEFAULTS_KEY='ksb-company-defaults';
let companyPrefixes=load(COMPANY_PREFIX_KEY,{});
let companyDefaults=load(COMPANY_DEFAULTS_KEY,{});
function companyKey(value){return clean(value).replace(/^(PT|CV|YAYASAN)\.?\s+/i,'').toUpperCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,' ').trim()}
function normalizeCompanyDefault(value){if(typeof value==='string')return{prefix:clean(value).toUpperCase(),sender:''};if(!value||typeof value!=='object'||Array.isArray(value))return{prefix:'',sender:''};return{prefix:clean(value.prefix).toUpperCase(),sender:clean(value.sender)}}
function persistCompanyMemory(){save(COMPANY_PREFIX_KEY,companyPrefixes);save(COMPANY_DEFAULTS_KEY,companyDefaults)}
function rememberCompanyPrefix(row,persist=true){const r=normalizeLabel(row||{}),key=companyKey(r.company);if(!key||!r.prefix)return false;const existing=normalizeCompanyDefault(companyDefaults[key]);const changed=companyPrefixes[key]!==r.prefix||existing.prefix!==r.prefix;companyPrefixes[key]=r.prefix;companyDefaults[key]={...existing,prefix:r.prefix};if(persist&&changed)persistCompanyMemory();return changed}
function rememberCompanySender(row,persist=true){const r=normalizeLabel(row||{}),key=companyKey(r.company),sender=clean(row?.sender)||r.sender;if(!key||!sender)return false;const existing=normalizeCompanyDefault(companyDefaults[key]);const changed=existing.sender!==sender;companyDefaults[key]={...existing,sender};if(persist&&changed)persistCompanyMemory();return changed}
function rememberCompanyDefaults(row,persist=true){const prefixChanged=rememberCompanyPrefix(row,false),senderChanged=rememberCompanySender(row,false),changed=prefixChanged||senderChanged;if(persist&&changed)persistCompanyMemory();return changed}
function rebuildCompanyPrefixes(){
  const nextPrefixes=companyPrefixes&&typeof companyPrefixes==='object'&&!Array.isArray(companyPrefixes)?{...companyPrefixes}:{};
  const nextDefaults={};
  if(companyDefaults&&typeof companyDefaults==='object'&&!Array.isArray(companyDefaults))Object.entries(companyDefaults).forEach(([key,value])=>{const normalized=normalizeCompanyDefault(value);if(normalized.prefix||normalized.sender)nextDefaults[key]=normalized});
  Object.entries(nextPrefixes).forEach(([key,prefix])=>{const value=normalizeCompanyDefault(nextDefaults[key]);value.prefix=clean(prefix).toUpperCase()||value.prefix;if(value.prefix||value.sender)nextDefaults[key]=value});
  const absorb=row=>{const raw=row||{},r=normalizeLabel(raw),key=companyKey(r.company);if(!key)return;const value=normalizeCompanyDefault(nextDefaults[key]);if(r.prefix){value.prefix=r.prefix;nextPrefixes[key]=r.prefix}if(clean(raw.sender))value.sender=clean(raw.sender);if(value.prefix||value.sender)nextDefaults[key]=value};
  [...history].reverse().forEach(batch=>(batch?.labels||[]).forEach(absorb));
  labels.forEach(absorb);
  companyPrefixes=nextPrefixes;
  companyDefaults=nextDefaults;
  persistCompanyMemory();
}
function companyDefaultsFromHistory(company){
  const key=companyKey(company);if(!key)return{prefix:'',sender:''};
  const found=normalizeCompanyDefault(companyDefaults[key]);
  if(!found.prefix&&companyPrefixes[key])found.prefix=clean(companyPrefixes[key]).toUpperCase();
  if(!found.prefix||!found.sender){
    for(const batch of history){
      for(const row of batch?.labels||[]){
        if(companyKey(row?.company)!==key)continue;
        const normalized=normalizeLabel(row);
        if(!found.prefix&&normalized.prefix)found.prefix=normalized.prefix;
        if(!found.sender&&clean(row?.sender))found.sender=clean(row.sender);
        if(found.prefix&&found.sender)break;
      }
      if(found.prefix&&found.sender)break;
    }
  }
  if(found.prefix||found.sender){companyDefaults[key]=found;if(found.prefix)companyPrefixes[key]=found.prefix;persistCompanyMemory()}
  return found;
}
function prefixFromHistory(company){return companyDefaultsFromHistory(company).prefix||''}
function senderFromHistory(company){return companyDefaultsFromHistory(company).sender||''}
function applyRememberedCompanyDefaults(row,overwrite=false){const raw=row||{},r=normalizeLabel(raw),remembered=companyDefaultsFromHistory(r.company);if(remembered.prefix&&(overwrite||!r.prefix))r.prefix=remembered.prefix;if(remembered.sender&&(overwrite||!clean(raw.sender)))r.sender=remembered.sender;return r}
function applyRememberedPrefix(row){return applyRememberedCompanyDefaults(row,false)}
let users=load('ksb-users',[{name:'Rayhan Ardhana',nickname:'Rayhan'}]),currentUser=null,labels=startupLabels(),selected=0,layout=localStorage.getItem('ksb-layout')||'3x2',history=startupHistory(),active='create',connected=false,historySelected=null,cb=0,syncInFlight=false;
rebuildCompanyPrefixes();
function refreshDataSurfaces(){const badge=$('historyBadge');if(badge)badge.textContent=history.length;if(active==='history')renderHistory();else renderDashboardHistory();if(active==='analytics')renderAnalytics();else renderDashboardAnalytics()}
function initials(n){return clean(n||'U').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function full(r){return[r?.prefix,r?.company].filter(Boolean).join(' ').trim()}
function toast(m){const t=$('toast');if(!t)return;const msg=String(m||'');t.textContent=msg.length>140?msg.slice(0,137)+'…':msg;t.style.opacity=1;t.style.transform='translate(-50%,0)';clearTimeout(window.tt);window.tt=setTimeout(()=>{t.style.opacity=0;t.style.transform='translate(-50%,20px)'},2600)}
function endpoint(){const revision=localStorage.getItem('ksb-endpoint-revision');const saved=localStorage.getItem('ksb-endpoint');if(revision!==ENDPOINT_REVISION||!saved||LEGACY_ENDPOINTS.includes(saved)){localStorage.setItem('ksb-endpoint',CONFIG.endpoint);localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);return CONFIG.endpoint}return saved}
function setStatus(state,text){connected=state==='connected';const s=$('status'),label=$('statusText'),statusText=String(text||'');if(s){s.dataset.state=state;s.title=statusText;s.setAttribute('aria-label',statusText)}if(label)label.textContent=statusText}
function buildApiUrl(action,params={}){const u=new URL(endpoint());u.searchParams.set('action',action);u.searchParams.set('_',Date.now());Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));return u}
function jsonp(action,params={}){return new Promise((resolve,reject)=>{const name='__ksb'+Date.now().toString(36)+(++cb),s=document.createElement('script'),timer=setTimeout(()=>done(new Error('Apps Script API timed out. Check web-app deployment access.')),15000);function done(e,v){clearTimeout(timer);s.remove();delete window[name];e?reject(e):resolve(v)}window[name]=v=>v?.success===false?done(new Error(v.message||'Backend error')):done(null,v);try{const u=buildApiUrl(action,params);u.searchParams.set('callback',name);s.src=u;s.onerror=()=>done(new Error('Apps Script endpoint could not be loaded. Check deployment access.'));document.head.appendChild(s)}catch(e){done(e)}})}
async function apiGet(action,params={}){try{const r=await fetch(buildApiUrl(action,params),{cache:'no-store',redirect:'follow'});const text=await r.text();if(/^\s*</.test(text))throw new Error('Apps Script returned HTML instead of JSON. Redeploy the API Code.gs as a web app.');const data=JSON.parse(text);if(data?.success===false)throw new Error(data.message||'Backend error');return data}catch(e){if(/returned HTML|Unknown GET action|Unexpected token/.test(String(e.message||e)))throw e;return jsonp(action,params)}}
async function post(action,payload){const body=new URLSearchParams({action,payload:JSON.stringify(payload)});let primaryError=null;try{const response=await fetch(endpoint(),{method:'POST',body,redirect:'follow'});if(!response.ok)throw new Error(`Backend request failed (${response.status})`);const text=await response.text();if(/^\s*</.test(text))throw new Error('Apps Script returned HTML for POST.');if(!text.trim())throw new Error('Apps Script returned an empty POST response.');const data=JSON.parse(text);if(data?.success===false)throw new Error(data.message||'Backend error');return data}catch(error){primaryError=error}try{await fetch(endpoint(),{method:'POST',body,mode:'no-cors',keepalive:true});return{success:false,queued:true,message:'Request sent without confirmation'}}catch(fallbackError){throw primaryError||fallbackError}}

;
/* Source: app-sanitize.js */
(()=>{
  let repaired=false;

  if(!Array.isArray(users)){
    users=[{name:'Rayhan Ardhana',nickname:'Rayhan'}];
    save('ksb-users',users);
    repaired=true;
  }else{
    const normalizedUsers=users
      .filter(user=>user&&clean(user.name))
      .map(user=>({name:clean(user.name),nickname:clean(user.nickname)||clean(user.name).split(/\s+/)[0]}));
    if(!normalizedUsers.length)normalizedUsers.push({name:'Rayhan Ardhana',nickname:'Rayhan'});
    if(JSON.stringify(normalizedUsers)!==JSON.stringify(users)){
      users=normalizedUsers;
      save('ksb-users',users);
      repaired=true;
    }
  }

  if(!LAYOUTS[layout]){
    layout='3x2';
    try{localStorage.setItem('ksb-layout',layout)}catch{}
    repaired=true;
  }

  if(!companyPrefixes||typeof companyPrefixes!=='object'||Array.isArray(companyPrefixes)){
    companyPrefixes={};
    save(COMPANY_PREFIX_KEY,companyPrefixes);
    repaired=true;
  }

  if(!companyDefaults||typeof companyDefaults!=='object'||Array.isArray(companyDefaults)){
    companyDefaults={};
    save(COMPANY_DEFAULTS_KEY,companyDefaults);
    repaired=true;
  }

  if(!Array.isArray(labels)){
    labels=[];
    save('ksb-labels',labels);
    repaired=true;
  }

  if(!Array.isArray(history)){
    history=[];
    save('ksb-history',history);
    repaired=true;
  }

  companyDefaultsFromHistory=function(company){
    const key=companyKey(company);
    if(!key)return{prefix:'',sender:''};
    const remembered=normalizeCompanyDefault(companyDefaults[key]);
    if(!remembered.prefix&&companyPrefixes[key])remembered.prefix=clean(companyPrefixes[key]).toUpperCase();
    return remembered;
  };

  if(repaired){
    rebuildCompanyPrefixes();
    console.info('LabelPrint repaired invalid local state.');
  }
})();

;
/* Source: app-theme.js */
(()=>{
  const THEME_KEY='ksb-theme';
  const root=document.documentElement;
  const button=document.getElementById('themeToggle');
  const label=document.getElementById('themeLabel');
  const icon=button?.querySelector('.theme-icon');
  const optionButtons=[...document.querySelectorAll('[data-theme-option]')];
  let transitionTimer=0;

  function preferredTheme(){
    try{
      const saved=localStorage.getItem(THEME_KEY);
      if(saved==='dark'||saved==='light')return saved;
    }catch{}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
  }

  function syncControls(theme){
    const dark=theme==='dark';
    if(button){
      button.setAttribute('aria-pressed',String(dark));
      button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
      button.title=dark?'Switch to light mode':'Switch to dark mode';
    }
    if(label)label.textContent=dark?'Light mode':'Dark mode';
    if(icon)icon.textContent=dark?'☀':'☾';
    optionButtons.forEach(option=>{
      const active=option.dataset.themeOption===theme;
      option.setAttribute('aria-pressed',String(active));
      option.classList.toggle('active',active);
    });
  }

  function beginTransition(){
    if(root.classList.contains('low-spec')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    clearTimeout(transitionTimer);
    root.classList.remove('theme-switching');
    void root.offsetWidth;
    root.classList.add('theme-switching');
    transitionTimer=setTimeout(()=>root.classList.remove('theme-switching'),460);
  }

  function applyTheme(value,persist=false,animate=false){
    const theme=value==='dark'?'dark':'light';
    if(animate&&root.dataset.theme!==theme)beginTransition();
    root.dataset.theme=theme;
    root.style.colorScheme=theme;
    syncControls(theme);
    if(persist){
      try{localStorage.setItem(THEME_KEY,theme)}catch{}
    }
    window.dispatchEvent(new CustomEvent('labelprint:themechange',{detail:{theme}}));
    return theme;
  }

  let theme=applyTheme(root.dataset.theme||preferredTheme());
  button?.addEventListener('click',()=>{theme=applyTheme(theme==='dark'?'light':'dark',true,true)});
  optionButtons.forEach(option=>option.addEventListener('click',()=>{theme=applyTheme(option.dataset.themeOption,true,true)}));
  window.LabelPrintTheme={apply:applyTheme,get:()=>theme};
})();

;
/* Source: app-palette.js */
(()=>{
  const KEY='ksb-color-scheme';
  const root=document.documentElement;
  const valid=new Set(['ksb','blood-mint','shilo-killarney','teal-coral','tokyo']);
  const themeColors={
    ksb:'#DFFF3F',
    'blood-mint':'#930507',
    'shilo-killarney':'#31553B',
    'teal-coral':'#015551',
    tokyo:'#283845'
  };

  function syncThemeColor(palette){
    const meta=document.querySelector('meta[name="theme-color"]');
    if(!meta)return;
    meta.content=root.dataset.theme==='dark'?'#0D1014':(themeColors[palette]||themeColors.ksb);
  }

  function applyPalette(value,persist=false){
    const palette=valid.has(value)?value:'ksb';
    root.dataset.palette=palette;
    document.querySelectorAll('[data-palette-option]').forEach(button=>{
      const active=button.dataset.paletteOption===palette;
      button.setAttribute('aria-pressed',String(active));
      button.classList.toggle('active',active);
    });
    syncThemeColor(palette);
    if(persist){
      try{localStorage.setItem(KEY,palette)}catch{}
      if(typeof toast==='function')toast('Color scheme updated');
    }
    window.dispatchEvent(new CustomEvent('labelprint:palettechange',{detail:{palette}}));
    return palette;
  }

  let saved='ksb';
  try{saved=localStorage.getItem(KEY)||root.dataset.palette||'ksb'}catch{}
  let current=applyPalette(saved);

  document.querySelectorAll('[data-palette-option]').forEach(button=>{
    button.addEventListener('click',()=>{current=applyPalette(button.dataset.paletteOption,true)});
  });
  window.addEventListener('labelprint:themechange',()=>syncThemeColor(current));

  window.LabelPrintPalette={apply:applyPalette,get:()=>current};
})();

;
/* Source: app-performance.js */
(()=>{
  const root=document.documentElement;
  const nav=navigator||{};
  const connection=nav.connection||nav.mozConnection||nav.webkitConnection||{};
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  const constrainedNetwork=!!connection.saveData||['slow-2g','2g','3g'].includes(connection.effectiveType);
  const lowSpec=root.classList.contains('low-spec')||
    (Number.isFinite(nav.hardwareConcurrency)&&nav.hardwareConcurrency<=4)||
    (Number.isFinite(nav.deviceMemory)&&nav.deviceMemory<=4)||
    reducedMotion;

  root.classList.toggle('low-spec',lowSpec);
  root.dataset.performance=lowSpec?'low':'standard';
  root.dataset.network=constrainedNetwork?'constrained':'standard';

  const schedule=(callback,timeout=500)=>{
    if(typeof callback!=='function')return 0;
    if('requestIdleCallback'in window)return requestIdleCallback(callback,{timeout});
    return setTimeout(callback,lowSpec?140:24);
  };
  const cancel=id=>{
    if('cancelIdleCallback'in window)cancelIdleCallback(id);else clearTimeout(id);
  };
  const setVisibilityState=()=>root.classList.toggle('app-paused',document.hidden);
  document.addEventListener('visibilitychange',setVisibilityState,{passive:true});
  setVisibilityState();

  let scrolling=false;
  let scrollFrame=0;
  let scrollEndTimer=0;
  const finishScrolling=()=>{
    scrolling=false;
    root.classList.remove('is-scrolling');
  };
  const onScroll=()=>{
    if(!lowSpec||scrollFrame)return;
    scrollFrame=requestAnimationFrame(()=>{
      scrollFrame=0;
      scrolling=true;
      root.classList.add('is-scrolling');
      clearTimeout(scrollEndTimer);
      scrollEndTimer=setTimeout(finishScrolling,180);
    });
  };
  if(lowSpec){
    window.addEventListener('scroll',onScroll,{passive:true});
    document.addEventListener('scroll',onScroll,{passive:true,capture:true});
    window.addEventListener('wheel',onScroll,{passive:true});
    window.addEventListener('touchmove',onScroll,{passive:true});
  }

  const whenScrollIdle=callback=>{
    if(typeof callback!=='function')return()=>{};
    let cancelled=false;
    let retryTimer=0;
    let idleId=0;
    const check=()=>{
      if(cancelled)return;
      if(scrolling){retryTimer=setTimeout(check,200);return}
      idleId=schedule(()=>{
        if(cancelled)return;
        if(scrolling){check();return}
        callback();
      },1500);
    };
    check();
    return()=>{
      cancelled=true;
      clearTimeout(retryTimer);
      if(idleId)cancel(idleId);
    };
  };

  schedule(()=>{
    document.querySelectorAll('img').forEach(img=>{
      try{img.decoding='async'}catch{}
      if(!img.closest('.physical,.sheet,.print-root,#reviewWrap')){
        try{img.loading='lazy'}catch{}
        if(lowSpec||constrainedNetwork)try{img.fetchPriority='low'}catch{}
      }
    });
  },900);

  if(lowSpec){
    whenScrollIdle(()=>{
      document.querySelectorAll('[data-performance-decoration],.ambient-orb,.decorative-blur').forEach(node=>node.remove());
    });
  }

  window.LabelPrintPerformance={lowSpec,reducedMotion,constrainedNetwork,schedule,cancel,whenScrollIdle,isScrolling:()=>scrolling};
})();

;
/* Source: app-02.js */
const DELETED_BATCHES_KEY='ksb-deleted-batches';
function deletedBatchIds(){return new Set((Array.isArray(load(DELETED_BATCHES_KEY,[]))?load(DELETED_BATCHES_KEY,[]):[]).map(clean).filter(Boolean))}
async function flushDeletedBatches(){
  if(!connected)return;
  const ids=deletedBatchIds();
  if(!ids.size)return;
  for(const id of [...ids]){
    try{
      const result=await post('deleteBatch',{id});
      if(!result?.queued)ids.delete(id);
    }catch{}
  }
  save(DELETED_BATCHES_KEY,[...ids]);
}

document.documentElement.classList.toggle('profile-selected',!!currentUser);

function normalizedRemoteUsers(rows){
  const seen=new Set();
  return(Array.isArray(rows)?rows:[]).filter(x=>x&&clean(x.name)).map(x=>({name:clean(x.name),nickname:clean(x.nickname)||clean(x.name).split(/\s+/)[0]})).filter(user=>{const key=user.name.toLowerCase();if(seen.has(key))return false;seen.add(key);return true});
}
function applyRemoteUsers(response){
  const next=normalizedRemoteUsers(response?.users);
  if(!next.length)return false;
  const changed=JSON.stringify(next)!==JSON.stringify(users);
  users=next;
  save('ksb-users',users);
  if(changed)renderUsers();
  return true;
}
let usersFetchPromise=null,usersFetchSettledAt=0;
function fetchUsersFast(force=false){
  const fresh=usersFetchPromise&&(Date.now()-usersFetchSettledAt<30000);
  if(fresh&&!force)return usersFetchPromise;
  usersFetchPromise=apiGet('getUsers').then(response=>({ok:applyRemoteUsers(response),response})).catch(error=>({ok:false,error})).finally(()=>{usersFetchSettledAt=Date.now()});
  return usersFetchPromise;
}
function applyRemoteHistory(response){
  if(!response?.history)return false;
  const deleted=deletedBatchIds();
  const merged=new Map(history.filter(x=>!deleted.has(clean(x?.id))).map(x=>[x.id,x]));
  response.history.forEach(x=>{if(!deleted.has(clean(x?.id)))merged.set(x.id,{...x,labels:usableLabels(x.labels||[]),syncState:'synced'})});
  history=[...merged.values()].filter(x=>x?.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,1000);
  save('ksb-history',history);
  rebuildCompanyPrefixes();
  refreshDataSurfaces();
  return true;
}

async function sync(){
  if(syncInFlight)return;
  syncInFlight=true;
  setStatus('syncing','Connecting to Sheets…');
  const usersTask=fetchUsersFast();
  const historyTask=apiGet('getHistory',{limit:500}).then(response=>({ok:applyRemoteHistory(response)})).catch(error=>({ok:false,error}));
  const pingTask=apiGet('ping');
  try{
    const p=await pingTask;
    if(!p?.success)throw Error('Invalid LabelPrint API response');
    setStatus('connected',`Sheets connected${p.spreadsheetName?` · ${p.spreadsheetName}`:''}`);
    const [userResult,historyResult]=await Promise.all([usersTask,historyTask]);
    if(userResult?.error&&historyResult?.error)throw userResult.error;
    if(userResult?.error)console.warn('User refresh failed; using cached profiles:',userResult.error);
    if(historyResult?.error)console.warn('History refresh failed; using cached history:',historyResult.error);
    await flushDeletedBatches();
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

/* Show cached profiles as soon as the profile code is ready, then refresh them in the background. */
renderUsers();
const earlyEntry=$('entry');
if(earlyEntry)earlyEntry.classList.add('show');
fetchUsersFast();

;
/* Source: app-03.js */
const MAX_LABELS=20;
if(labels.length>MAX_LABELS){labels=labels.slice(0,MAX_LABELS);save('ksb-labels',labels)}
function renderCards(){
  const searchInput=$('search');
  const q=clean(searchInput?.value).toLowerCase();
  const shown=labels.map((r,i)=>({r,i})).filter(x=>!q||[full(x.r),x.r.invoice,x.r.attn,x.r.address,x.r.phone,x.r.sender,x.r.courier,x.r.awb].join(' ').toLowerCase().includes(q));
  const atLimit=labels.length>=MAX_LABELS;
  const cards=$('cards');
  cards.innerHTML=shown.map(x=>{
    const secondary=x.r.awb?`${x.r.courier||'JNE'} · ${x.r.awb}`:(x.r.invoice?`Invoice ${x.r.invoice}`:(x.r.attn||x.r.address||'Ready to edit'));
    return `<button type="button" class="recipient ${x.i===selected?'active':''}" data-label="${x.i}"><span class="num">${String(x.i+1).padStart(2,'0')}</span><b>${esc(full(x.r)||'Blank recipient')}</b><span>${esc(secondary)}</span></button>`;
  }).join('')+`<button type="button" class="recipient add" id="addCard" ${atLimit?'disabled':''}><b>${atLimit?`${MAX_LABELS} label limit reached`:'＋ Add recipient'}</b></button>`;
  if(!cards.dataset.delegated){
    cards.dataset.delegated='true';
    cards.addEventListener('click',event=>{
      const button=event.target.closest('button');
      if(!button||!cards.contains(button)||button.disabled)return;
      if(button.id==='addCard')return addLabel(event);
      if(button.dataset.label===undefined)return;
      const next=Number(button.dataset.label);
      if(!Number.isInteger(next)||next===selected)return;
      selected=next;
      renderCards();
      renderForm();
    });
  }
  $('batchCount').textContent=`${labels.length} / ${MAX_LABELS}`;
  $('statCount').textContent=labels.length;
  const addTop=$('addRecipient'),clearButton=$('clearAll');
  if(addTop){addTop.disabled=atLimit;addTop.title=atLimit?`Maximum ${MAX_LABELS} labels per batch`:''}
  if(clearButton)clearButton.disabled=!labels.length;
}
function syncSenderControls(value){
  const sender=clean(value)||'KSB INDONESIA';
  const custom=!['KSB INDONESIA','KSB SALES INDONESIA'].includes(sender);
  const senderControl=$('sender'),customField=$('customField'),customSender=$('customSender');
  if(senderControl)senderControl.value=custom?'__CUSTOM__':sender;
  if(customField)customField.classList.toggle('hidden',!custom);
  if(customSender)customSender.value=custom?sender:'';
}
function renderForm(){
  selected=Math.max(0,Math.min(selected,Math.max(0,labels.length-1)));
  const hasLabel=labels.length>0;
  if(hasLabel)labels[selected]=applyRememberedCompanyDefaults(labels[selected],false);
  const r=hasLabel?labels[selected]:blankLabel();
  $('editIndex').textContent=hasLabel?String(selected+1).padStart(2,'0'):'00';
  ['prefix','company','attn','phone','address','awb'].forEach(id=>{const control=$(id);if(control)control.value=r[id]||''});
  const courier=$('courier');if(courier)courier.value=r.courier==='JNE'?'JNE':'OTHER';
  syncSenderControls(r.sender);
  window.LabelPrintAwb?.sync?.(r);
  const removeButton=$('remove'),duplicateButton=$('duplicate');
  if(removeButton)removeButton.disabled=!hasLabel;
  if(duplicateButton)duplicateButton.disabled=!hasLabel;
  if(hasLabel)rememberCompanyDefaults(r);
  saveSoon('ksb-labels',labels);
}
const renderPreviewSoon=debounce(()=>renderPreview(),window.LabelPrintPerformance?.lowSpec?130:80);
function update(id,val){
  if(!labels[selected])labels[selected]=blankLabel();
  labels[selected][id]=val;
  labels[selected]=normalizeLabel(labels[selected]);
  if(id==='company'){
    const remembered=companyDefaultsFromHistory(labels[selected].company);
    if(remembered.prefix){
      labels[selected].prefix=remembered.prefix;
      const prefixControl=$('prefix');
      if(prefixControl)prefixControl.value=remembered.prefix;
    }
    if(remembered.sender){
      labels[selected].sender=remembered.sender;
      syncSenderControls(remembered.sender);
    }
  }
  if(id==='prefix'||id==='sender')rememberCompanyDefaults(labels[selected]);
  saveSoon('ksb-labels',labels);
  renderCards();
  if(id!=='awb'&&id!=='courier')renderPreviewSoon();
}
function addLabel(event){
  event?.preventDefault?.();
  labels=Array.isArray(labels)?labels:[];
  if(labels.length>=MAX_LABELS)return toast(`Maximum ${MAX_LABELS} labels per batch`);
  const searchInput=$('search');
  if(searchInput)searchInput.value='';
  labels.push(blankLabel());
  selected=labels.length-1;
  historySelected=null;
  save('ksb-labels',labels);
  if(active!=='create')switchView('create');
  renderAll();
  requestAnimationFrame(()=>$('company')?.focus());
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

;
/* Source: app-03b.js */
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

;
/* Source: app-awb.js */
(()=>{
  const JNE_TRACKING_URL='https://cekresi.com/tracking/cek-resi-jne.php';
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
  function openAwbTracking(row=selectedRow()){
    const r=normalizeLabel(row||{});
    if(!r.awb){$('awb')?.focus();toast('Enter an AWB / resi number first');return false}
    const opened=window.open(trackingUrl(r),'_blank');
    if(opened)opened.opener=null;
    copyAwb(r.awb).then(copied=>{
      if(!opened)toast('Allow pop-ups to open tracking');
      else toast(`${r.courier==='JNE'?'JNE':'Package'} tracking opened${copied?' · AWB copied':''}`);
    });
    return !!opened;
  }
  function trackButtonHTML(row,label='Track'){
    const r=normalizeLabel(row||{});
    if(!r.awb)return'';
    return `<button class="awb-track-link" type="button" data-track-awb="${esc(r.awb)}" data-track-courier="${esc(r.courier)}">${esc(label)}</button>`;
  }
  function syncAwbTrackingControl(row=selectedRow()){
    const r=normalizeLabel(row||{}),button=$('trackAwb'),help=$('awbHelp');
    if(button){button.disabled=!r.awb;button.textContent='Track';button.title=r.awb?`Track ${r.awb}`:'Enter an AWB / resi number first'}
    if(help)help.textContent=r.courier==='JNE'?'Opens CekResi JNE tracking and copies the AWB':'Opens a universal tracking page';
  }

  const phoneField=$('phone')?.closest('.field'),form=phoneField?.parentElement;
  if(form&&!$('awb')){
    phoneField.insertAdjacentHTML('afterend',`<div class="field awb-courier-field"><label>Courier</label><select class="control" id="courier"><option value="JNE">JNE</option><option value="OTHER">Other courier</option></select></div><div class="field two awb-number-field"><label>AWB / resi</label><div class="awb-control-row"><input class="control" id="awb" inputmode="text" autocomplete="off" spellcheck="false" placeholder="Enter tracking number"><button class="awb-track-button" id="trackAwb" type="button">Track</button></div><small class="awb-help" id="awbHelp">Opens CekResi JNE tracking and copies the AWB</small></div>`);
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

;
/* Source: app-print-logo.js */
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

;
/* Source: app-04.js */
function historySyncState(value){return['synced','pending','failed'].includes(value)?value:'pending'}
function saveBatch(){
  const printable=usableLabels(labels).slice(0,MAX_LABELS).map(row=>applyRememberedCompanyDefaults(row,false));
  if(!printable.length){toast('Add at least one recipient before generating');return null}
  printable.forEach(row=>rememberCompanyDefaults(row,false));
  persistCompanyMemory();
  const now=new Date(),batch={id:'KSB-'+now.getTime().toString(36).toUpperCase(),timestamp:now.toISOString(),user:currentUser?.name||'Local User',nickname:currentUser?.nickname||'User',layout,labels:clone(printable),syncState:'pending'};
  history=[batch,...history.filter(x=>x.id!==batch.id)].slice(0,1000);
  historySelected=batch.id;
  save('ksb-history',history);
  syncBatch(batch);
  refreshDataSurfaces();
  return batch;
}
function renderDashboardHistory(){
  const root=$('dashboardHistory');
  if(!root)return;
  const recent=history.slice(0,4);
  root.className='recent-list';
  root.innerHTML=recent.length?recent.map(b=>{const when=new Date(b.timestamp),state=historySyncState(b.syncState),tracked=(b.labels||[]).filter(r=>clean(r.awb)).length;return `<button class="recent-row" data-open-batch="${esc(b.id)}"><span class="recent-icon">▤</span><span><b>${esc(b.id)}</b><small>${isNaN(when)?'Unknown date':when.toLocaleDateString()} · ${b.labels.length} label${b.labels.length===1?'':'s'}${tracked?` · ${tracked} tracked`:''}</small></span><span><em class="sync ${state}" title="${state}" aria-label="${state}"></em></span></button>`}).join(''):'<div class="empty-mini">No generated batches yet.</div>';
  root.querySelectorAll('[data-open-batch]').forEach(btn=>btn.onclick=()=>{historySelected=btn.dataset.openBatch;switchView('history');renderHistory()});
}
function renderHistory(){
  history=(Array.isArray(history)?history:[]).filter(b=>b?.id).map(b=>({...b,labels:Array.isArray(b.labels)?b.labels.map(normalizeLabel):[]}));
  const total=history.reduce((s,b)=>s+b.labels.length,0),unique=new Set(history.flatMap(b=>b.labels.map(full).filter(Boolean))).size,tracked=history.reduce((s,b)=>s+b.labels.filter(r=>clean(r.awb)).length,0);
  $('historyBadge').textContent=history.length;
  $('historyCount').textContent=`${history.length} batches`;
  $('historyKpis').innerHTML=[['Saved batches',history.length,'primary'],['Total labels',total,'accent'],['Recipients',unique,'soft'],['Tracked AWBs',tracked,'neutral']].map(x=>`<article class="metric ${x[2]}"><span>${x[0]}</span><strong>${esc(x[1])}</strong><small>${connected?'Google Sheets + cache':'Local cache'}</small></article>`).join('');
  const list=$('historyList');
  list.innerHTML=history.length?history.map(b=>{const state=historySyncState(b.syncState),layoutName=LAYOUTS[b.layout]?.label||clean(b.layout)||'Unknown',trackedCount=b.labels.filter(r=>clean(r.awb)).length;return `<button class="history-row ${b.id===historySelected?'active':''}" data-batch="${esc(b.id)}"><span class="batch-icon">${esc(layoutName)}</span><span><b>${esc(b.id)} <em class="sync ${state}" title="${state}" aria-label="${state}"></em></b><small>${b.labels.slice(0,2).map(full).filter(Boolean).map(esc).join(' · ')||'No recipient preview'}${trackedCount?` · ${trackedCount} AWB${trackedCount===1?'':'s'}`:''}</small></span><b>${b.labels.length}</b></button>`}).join(''):`<div class="empty">No generated batches yet.</div>`;
  list.querySelectorAll('[data-batch]').forEach(b=>b.onclick=()=>{historySelected=b.dataset.batch;renderHistory()});
  renderDetail();
  renderDashboardHistory();
}
function loadHistoryBatch(batch){
  const restored=usableLabels(clone(batch?.labels||[])).slice(0,MAX_LABELS).map(row=>applyRememberedCompanyDefaults(row,false));
  if(!restored.length)return toast('This batch has no usable labels to load');
  restored.forEach(row=>rememberCompanyDefaults(row,false));
  persistCompanyMemory();
  labels=restored;
  selected=0;
  if(batch.layout&&LAYOUTS[batch.layout]){
    layout=batch.layout;
    localStorage.setItem('ksb-layout',layout);
  }
  save('ksb-labels',labels);
  switchView('create');
  renderAll();
  requestAnimationFrame(()=>requestAnimationFrame(fitPreview));
  toast(`Loaded ${labels.length} label${labels.length===1?'':'s'} from ${batch.id}`);
}
function renderDetail(){
  const detail=$('historyDetail');
  const b=history.find(x=>x.id===historySelected)||history[0];
  if(!b){detail.innerHTML='<div class="empty">Select a batch to inspect it.</div>';return}
  const when=new Date(b.timestamp);
  detail.innerHTML=`<div class="detail-top"><div><span class="detail-kicker">Batch details</span><h2>${esc(b.id)}</h2><p>${isNaN(when)?'Unknown date':when.toLocaleString()} · ${esc(b.user||'Unknown user')}</p></div><span class="detail-count">${(b.labels||[]).length} label${(b.labels||[]).length===1?'':'s'}</span></div><div class="detail-list">${(b.labels||[]).map((raw,i)=>{const r=normalizeLabel(raw),tracking=r.awb?`<div class="detail-tracking"><span class="awb-chip">${esc(r.courier)} · ${esc(r.awb)}</span>${window.LabelPrintAwb?.buttonHTML?.(r,'Track')||''}</div>`:'';return `<div class="detail-line"><span><b>${String(i+1).padStart(2,'0')} · ${esc(full(r)||'Blank recipient')}</b><br>${esc(r.attn||r.address||'')}</span><span class="detail-phone">${esc(r.phone||'')}</span>${tracking}</div>`}).join('')}</div><div class="modal-actions"><button class="btn light" id="deleteBatch" type="button">Delete</button><button class="btn dark" id="loadBatch" type="button">Load batch</button></div>`;
  const loadButton=detail.querySelector('#loadBatch');
  const deleteButton=detail.querySelector('#deleteBatch');
  loadButton.onclick=()=>loadHistoryBatch(b);
  deleteButton.onclick=async()=>{
    const deleted=deletedBatchIds();
    deleted.add(b.id);
    save(DELETED_BATCHES_KEY,[...deleted]);
    history=history.filter(x=>x.id!==b.id);
    save('ksb-history',history);
    historySelected=null;
    refreshDataSurfaces();
    if(connected)await flushDeletedBatches();
    toast('Batch deleted');
  };
}

;
/* Source: app-04b.js */
function analyticsBuckets(data,days){
  const parsed=data.map(b=>({...b,_time:new Date(b.timestamp).getTime()})).filter(b=>Number.isFinite(b._time));
  const buckets=[];
  const today=new Date();today.setHours(0,0,0,0);
  if(days===0){
    if(!parsed.length)return[];
    const earliest=new Date(Math.min(...parsed.map(batch=>batch._time))),start=new Date(earliest.getFullYear(),earliest.getMonth(),1),end=new Date(today.getFullYear(),today.getMonth()+1,1);
    const monthSpan=(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth();
    if(monthSpan<=24){
      for(let i=0;i<monthSpan;i++){const from=new Date(start.getFullYear(),start.getMonth()+i,1),to=new Date(start.getFullYear(),start.getMonth()+i+1,1),includeYear=monthSpan>12;buckets.push({label:from.toLocaleDateString('en-GB',includeYear?{month:'short',year:'2-digit'}:{month:'short'}),value:parsed.filter(b=>b._time>=from.getTime()&&b._time<to.getTime()).reduce((sum,b)=>sum+(b.labels?.length||0),0)})}
    }else{
      for(let year=start.getFullYear();year<=today.getFullYear();year++){const from=new Date(year,0,1),to=new Date(year+1,0,1);buckets.push({label:String(year),value:parsed.filter(b=>b._time>=from.getTime()&&b._time<to.getTime()).reduce((sum,b)=>sum+(b.labels?.length||0),0)})}
    }
    return buckets;
  }
  const groups=days===30?10:7,span=days===30?3:1,start=new Date(today);start.setDate(start.getDate()-(groups*span-1));
  for(let i=0;i<groups;i++){const from=new Date(start);from.setDate(from.getDate()+i*span);const to=new Date(from);to.setDate(to.getDate()+span);buckets.push({label:span===1?from.toLocaleDateString('en-GB',{weekday:'short'}):from.toLocaleDateString('en-GB',{day:'numeric',month:'short'}),value:parsed.filter(b=>b._time>=from.getTime()&&b._time<to.getTime()).reduce((s,b)=>s+(b.labels?.length||0),0)})}
  return buckets;
}
function lineChartHTML(buckets,key='chart'){
  const width=720,height=250,left=40,right=16,top=18,bottom=38,innerW=width-left-right,innerH=height-top-bottom,max=Math.max(1,...buckets.map(x=>x.value));
  const points=buckets.map((b,i)=>({x:left+(buckets.length===1?innerW/2:i*innerW/(buckets.length-1)),y:top+(1-b.value/max)*innerH,...b}));
  const path=points.length?`M ${points.map(p=>`${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`:'';
  const area=points.length?`${path} L ${points[points.length-1].x.toFixed(1)} ${(top+innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(top+innerH).toFixed(1)} Z`:'';
  const gradient=`lineFill-${key.replace(/[^a-z0-9]/gi,'')}`;
  const grids=[0,.25,.5,.75,1].map(v=>{const y=top+innerH*v,label=Math.round(max*(1-v));return `<line class="line-grid" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text class="line-label y-label" x="${left-8}" y="${y+4}" text-anchor="end">${label}</text>`}).join('');
  const labels=points.map(p=>`<text class="line-label" x="${p.x}" y="${height-12}" text-anchor="middle">${esc(p.label)}</text><circle class="line-point" cx="${p.x}" cy="${p.y}" r="4"><title>${esc(p.label)}: ${p.value}</title></circle>`).join('');
  return `<div class="line-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Labels generated over time"><defs><linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dfff3f" stop-opacity=".65"/><stop offset="100%" stop-color="#dfff3f" stop-opacity="0"/></linearGradient></defs>${grids}<path class="line-area" d="${area}" fill="url(#${gradient})"/><path class="line-path" d="${path}"/>${labels}</svg></div>`;
}
function rankingHTML(entries,type='simple',limit=7){return entries.slice(0,limit).map((x,i)=>{const value=type==='users'?x[1].labels:x[1],sub=type==='users'?`${x[1].batches} batch${x[1].batches===1?'':'es'}`:'';return `<div class="rank ${type==='users'?'user-rank':''}"><em>${i+1}</em><b>${esc(x[0])}${sub?`<small>${sub}</small>`:''}</b><strong>${value}</strong></div>`}).join('')}
function miniRankingHTML(entries,type='simple'){return entries.slice(0,3).map((x,i)=>{const value=type==='users'?x[1].labels:x[1];return `<div class="mini-rank"><em>${i+1}</em><b>${esc(x[0])}</b><strong>${value}</strong></div>`}).join('')||'<div class="empty-mini">No data yet.</div>'}
function collectAnalytics(data){
  const companies={},users={};
  data.forEach(b=>{const count=(b.labels||[]).length,user=String(b.user||b.nickname||'Unknown user').trim()||'Unknown user';if(!users[user])users[user]={labels:0,batches:0};users[user].labels+=count;users[user].batches+=1;(b.labels||[]).forEach(r=>{const name=full(r);if(name)companies[name]=(companies[name]||0)+1})});
  return{companies,users,companyEntries:Object.entries(companies).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),userEntries:Object.entries(users).sort((a,b)=>b[1].labels-a[1].labels||b[1].batches-a[1].batches||a[0].localeCompare(b[0]))};
}
function monthlyHistorySnapshot(){
  const byId=new Map();
  (Array.isArray(history)?history:[]).forEach(batch=>{
    const id=clean(batch?.id),date=new Date(batch?.timestamp),rows=usableLabels(batch?.labels||[]);
    if(!id||Number.isNaN(date.getTime())||!rows.length)return;
    const candidate={...batch,labels:rows,_date:date};
    const current=byId.get(id);
    if(!current||rows.length>current.labels.length||(rows.length===current.labels.length&&batch.syncState==='synced'&&current.syncState!=='synced'))byId.set(id,candidate);
  });
  return[...byId.values()];
}
function monthlyReportYears(){const currentYear=new Date().getFullYear(),years=new Set([currentYear]);monthlyHistorySnapshot().forEach(batch=>years.add(batch._date.getFullYear()));return[...years].sort((a,b)=>b-a)}
function ensureMonthlyYear(){
  const select=$('monthlyYear');if(!select)return new Date().getFullYear();
  const years=monthlyReportYears(),previous=Number(select.value)||new Date().getFullYear(),signature=years.join('|');
  if(select.dataset.years!==signature){select.innerHTML=years.map(year=>`<option value="${year}">${year}</option>`).join('');select.dataset.years=signature;select.value=String(years.includes(previous)?previous:years[0])}
  select.onchange=renderMonthlyReport;return Number(select.value)||years[0];
}
function topMapEntry(map){return[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null}
function monthlyReportData(year){
  const months=Array.from({length:12},(_,month)=>({month,labels:0,batches:0,recipients:new Set(),customers:new Map(),users:new Map()})),recipients=new Set(),customers=new Map(),users=new Map();
  monthlyHistorySnapshot().forEach(batch=>{const date=batch._date;if(date.getFullYear()!==year)return;const item=months[date.getMonth()],rows=batch.labels,count=rows.length,user=clean(batch.user||batch.nickname)||'Unknown user';item.labels+=count;item.batches+=1;item.users.set(user,(item.users.get(user)||0)+count);users.set(user,(users.get(user)||0)+count);rows.forEach(row=>{const customer=full(row);if(!customer)return;item.recipients.add(customer);recipients.add(customer);item.customers.set(customer,(item.customers.get(customer)||0)+1);customers.set(customer,(customers.get(customer)||0)+1)})});
  const rows=months.map(item=>{const topCustomer=topMapEntry(item.customers),topUser=topMapEntry(item.users);return{...item,recipientCount:item.recipients.size,topCustomer:topCustomer?.[0]||'—',topCustomerLabels:topCustomer?.[1]||0,topUser:topUser?.[0]||'—',topUserLabels:topUser?.[1]||0}}),annualCustomer=topMapEntry(customers),annualUser=topMapEntry(users);
  return{rows,totals:{labels:rows.reduce((sum,row)=>sum+row.labels,0),batches:rows.reduce((sum,row)=>sum+row.batches,0),recipients:recipients.size,topCustomer:annualCustomer?.[0]||'—',topCustomerLabels:annualCustomer?.[1]||0,topUser:annualUser?.[0]||'—',topUserLabels:annualUser?.[1]||0}};
}
function reportLeader(name,count){return count?`${esc(name)}<small>${count} label${count===1?'':'s'}</small>`:'—'}
function renderMonthlyReport(){
  const body=$('monthlyReportBody'),foot=$('monthlyReportFoot'),summary=$('monthlyReportSummary');if(!body||!foot||!summary)return;
  const year=ensureMonthlyYear(),report=monthlyReportData(year),now=new Date();
  summary.innerHTML=`<article class="monthly-summary-card"><span>Labels</span><strong>${report.totals.labels.toLocaleString('en-GB')}</strong><small>${year} total</small></article><article class="monthly-summary-card"><span>Batches</span><strong>${report.totals.batches.toLocaleString('en-GB')}</strong><small>${year} total</small></article><article class="monthly-summary-card monthly-customer-card"><span>Top customer</span><strong title="${esc(report.totals.topCustomer)}">${esc(report.totals.topCustomer)}</strong><small>${report.totals.topCustomerLabels?`${report.totals.topCustomerLabels} label${report.totals.topCustomerLabels===1?'':'s'} in ${year}`:`No customer data in ${year}`}</small></article><article class="monthly-summary-card"><span>Unique recipients</span><strong>${report.totals.recipients.toLocaleString('en-GB')}</strong><small>${year} total</small></article>`;
  body.innerHTML=report.rows.map(row=>{const current=year===now.getFullYear()&&row.month===now.getMonth(),month=new Date(year,row.month,1).toLocaleDateString('en-GB',{month:'long'});return `<tr class="${current?'current-month':''}"><td><b>${month}</b><small>${year}</small></td><td>${row.labels.toLocaleString('en-GB')}</td><td>${row.batches.toLocaleString('en-GB')}</td><td class="monthly-top-user">${reportLeader(row.topCustomer,row.topCustomerLabels)}</td><td>${row.recipientCount.toLocaleString('en-GB')}</td><td class="monthly-top-user">${reportLeader(row.topUser,row.topUserLabels)}</td></tr>`}).join('');
  foot.innerHTML=`<tr><th>Total</th><th>${report.totals.labels.toLocaleString('en-GB')}</th><th>${report.totals.batches.toLocaleString('en-GB')}</th><th>${reportLeader(report.totals.topCustomer,report.totals.topCustomerLabels)}</th><th>${report.totals.recipients.toLocaleString('en-GB')}</th><th>${reportLeader(report.totals.topUser,report.totals.topUserLabels)}</th></tr>`;
}
function renderDashboardAnalytics(){
  const root=$('dashboardAnalytics');if(!root)return;
  const cut=Date.now()-7*86400000,data=monthlyHistorySnapshot().filter(b=>b._date.getTime()>=cut),total=data.reduce((s,b)=>s+b.labels.length,0),sheets=data.reduce((s,b)=>s+Math.ceil(b.labels.length/(LAYOUTS[b.layout]?.n||6)),0),collected=collectAnalytics(data);
  root.innerHTML=`<article class="dash-metric"><span>Labels printed</span><strong>${total}</strong><small>Last 7 days</small></article><article class="dash-metric"><span>Sheets printed</span><strong>${sheets}</strong><small>${data.length} generated batch${data.length===1?'':'es'}</small></article>`;
  $('dashboardLine').innerHTML=lineChartHTML(analyticsBuckets(data,7),'dashboard');$('dashboardTopUsers').innerHTML=miniRankingHTML(collected.userEntries,'users');$('dashboardTopRecipients').innerHTML=miniRankingHTML(collected.companyEntries);
}
function renderAnalytics(){
  const range=$('range'),days=Number(range?.value||30),cut=days?Date.now()-days*86400000:0,snapshot=monthlyHistorySnapshot(),data=snapshot.filter(b=>b._date.getTime()>=cut),total=data.reduce((s,b)=>s+b.labels.length,0),avg=data.length?(total/data.length).toFixed(1):0,collected=collectAnalytics(data);
  $('analyticsKpis').innerHTML=[['Generated labels',total,'primary'],['Batches',data.length,'accent'],['Average / batch',avg,'soft'],['Unique recipients',Object.keys(collected.companies).length,'neutral']].map(x=>`<article class="metric ${x[2]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>Selected period</small></article>`).join('');
  $('bars').innerHTML=lineChartHTML(analyticsBuckets(data,days),'analytics');$('ranking').innerHTML=rankingHTML(collected.companyEntries)||'<div class="empty">No recipient data yet.</div>';$('userRanking').innerHTML=rankingHTML(collected.userEntries,'users')||'<div class="empty">No user data yet.</div>';renderMonthlyReport();renderDashboardAnalytics();
}

;
/* Source: app-analytics-fast.js */
analyticsBuckets=function(data,days){
  const parsed=(Array.isArray(data)?data:[]).map(batch=>{
    const date=new Date(batch?.timestamp);
    return Number.isNaN(date.getTime())?null:{date,value:Array.isArray(batch?.labels)?batch.labels.length:0};
  }).filter(Boolean);
  const today=new Date();today.setHours(0,0,0,0);
  if(days===0){
    if(!parsed.length)return[];
    const earliest=new Date(Math.min(...parsed.map(item=>item.date.getTime())));
    const start=new Date(earliest.getFullYear(),earliest.getMonth(),1);
    const end=new Date(today.getFullYear(),today.getMonth()+1,1);
    const monthCount=(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth();
    if(monthCount<=24){
      const values=new Array(monthCount).fill(0);
      parsed.forEach(item=>{
        const index=(item.date.getFullYear()-start.getFullYear())*12+item.date.getMonth()-start.getMonth();
        if(index>=0&&index<values.length)values[index]+=item.value;
      });
      return values.map((value,index)=>{
        const from=new Date(start.getFullYear(),start.getMonth()+index,1);
        return{label:from.toLocaleDateString('en-GB',monthCount>12?{month:'short',year:'2-digit'}:{month:'short'}),value};
      });
    }
    const firstYear=start.getFullYear(),yearCount=today.getFullYear()-firstYear+1,values=new Array(yearCount).fill(0);
    parsed.forEach(item=>{const index=item.date.getFullYear()-firstYear;if(index>=0&&index<values.length)values[index]+=item.value});
    return values.map((value,index)=>({label:String(firstYear+index),value}));
  }

  const groups=days===30?10:7,span=days===30?3:1,start=new Date(today);
  start.setDate(start.getDate()-(groups*span-1));
  const values=new Array(groups).fill(0);
  const dayNumber=date=>Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
  const startDay=dayNumber(start);
  parsed.forEach(item=>{
    const delta=dayNumber(item.date)-startDay;
    const index=Math.floor(delta/span);
    if(index>=0&&index<values.length)values[index]+=item.value;
  });
  return values.map((value,index)=>{
    const from=new Date(start);from.setDate(from.getDate()+index*span);
    return{label:span===1?from.toLocaleDateString('en-GB',{weekday:'short'}):from.toLocaleDateString('en-GB',{day:'numeric',month:'short'}),value};
  });
};

;
/* Source: app-05.js */
function openModal(id){$(id).classList.add('show')}
function closeModals(){document.querySelectorAll('.modal').forEach(x=>x.classList.remove('show'))}
function review(savedBatch=null){
  const rows=usableLabels(labels).slice(0,MAX_LABELS);
  if(!rows.length)return toast('Add at least one recipient before review');
  const wrap=$('reviewWrap');
  wrap.innerHTML=pagesHTML(rows);
  const modal=$('reviewModal');
  if(modal)modal.dataset.savedBatchId=clean(savedBatch?.id);
  requestAnimationFrame(()=>fitText(wrap));
  openModal('reviewModal');
}
async function waitForPrintAssets(root){
  const images=[...root.querySelectorAll('img')];
  await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
    const done=()=>resolve();
    img.addEventListener('load',done,{once:true});
    img.addEventListener('error',done,{once:true});
    setTimeout(done,1500);
  })));
  if(document.fonts?.ready)await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,800))]);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
function printLabelSignature(rows){
  return JSON.stringify((rows||[]).map(r=>{const n=normalizeLabel(r);return[n.prefix,n.company,n.invoice,n.attn,n.phone,n.address,n.sender,n.courier,n.awb]}));
}
function savedReviewBatch(rows){
  const id=clean($('reviewModal')?.dataset.savedBatchId);
  if(!id)return null;
  const batch=history.find(item=>clean(item?.id)===id);
  return batch&&printLabelSignature(batch.labels)===printLabelSignature(rows)?batch:null;
}
function resolvePrintBatchId(rows){
  const selectedBatch=history.find(b=>b?.id===historySelected);
  if(selectedBatch&&printLabelSignature(selectedBatch.labels)===printLabelSignature(rows))return selectedBatch.id;
  return 'KSB-'+Date.now().toString(36).toUpperCase();
}
function safePrintName(value){return clean(value).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()||'USER'}
function buildPrintTitle(rows){
  const batchId=resolvePrintBatchId(rows);
  const user=safePrintName(currentUser?.name||currentUser?.nickname||'Local User');
  return `LABEL-${safePrintName(batchId)}-${user}`;
}
let pdfLibraryPromise=null;
function ensurePdfLibrary(){
  if(window.jspdf?.jsPDF)return Promise.resolve(window.jspdf);
  if(pdfLibraryPromise)return pdfLibraryPromise;
  pdfLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=setTimeout(()=>{script.remove();reject(new Error('PDF library timed out'))},12000);
    script.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.async=true;
    script.dataset.labelprintPdf='true';
    script.onload=()=>{clearTimeout(timer);window.jspdf?.jsPDF?resolve(window.jspdf):reject(new Error('PDF library failed to initialize'))};
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('PDF library failed to load'))};
    document.head.appendChild(script);
  }).catch(error=>{pdfLibraryPromise=null;throw error});
  return pdfLibraryPromise;
}
let activePrintFrame=null,activePrintUrl='';
function disposePrintFrame(){
  if(activePrintFrame){activePrintFrame.remove();activePrintFrame=null}
  if(activePrintUrl){URL.revokeObjectURL(activePrintUrl);activePrintUrl=''}
}
function openPdfPrintPrompt(blob){
  if(!(blob instanceof Blob))return Promise.reject(new Error('Printable PDF was not created'));
  disposePrintFrame();
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');
    const url=URL.createObjectURL(blob);
    activePrintFrame=frame;
    activePrintUrl=url;
    frame.title='Label print document';
    frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;z-index:-1';
    let started=false;
    const fail=error=>{if(started)return;started=true;clearTimeout(loadTimer);disposePrintFrame();reject(error)};
    const startPrint=()=>{
      if(started)return;
      started=true;
      clearTimeout(loadTimer);
      setTimeout(()=>{
        try{
          const target=frame.contentWindow;
          if(!target)throw new Error('Print frame is unavailable');
          try{target.addEventListener('afterprint',disposePrintFrame,{once:true})}catch{}
          target.focus();
          target.print();
          resolve();
          setTimeout(disposePrintFrame,60000);
        }catch(error){disposePrintFrame();reject(error)}
      },500);
    };
    const loadTimer=setTimeout(startPrint,1800);
    frame.onload=startPrint;
    frame.onerror=()=>fail(new Error('Print document failed to load'));
    frame.src=url;
    document.body.appendChild(frame);
  });
}
async function browserPrintFallback(rows,title){
  const root=$('printRoot');
  root.innerHTML=pagesHTML(rows);
  await waitForPrintAssets(root);
  fitText(root);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const previousTitle=document.title;
  document.title=title;
  let restored=false;
  const restoreTitle=()=>{if(restored)return;restored=true;document.title=previousTitle};
  window.addEventListener('afterprint',restoreTitle,{once:true});
  setTimeout(restoreTitle,30000);
  window.print();
}
async function printNow(event){
  const rows=usableLabels(labels).slice(0,MAX_LABELS).map(applyRememberedPrefix);
  if(!rows.length)return toast('Add at least one recipient before printing');
  let batch=event?.currentTarget?.id==='print'?savedReviewBatch(rows):null;
  if(!batch)batch=saveBatch();
  if(!batch)return;
  const reviewModal=$('reviewModal');
  if(reviewModal)reviewModal.dataset.savedBatchId=batch.id;
  const title=buildPrintTitle(rows);
  const controls=[$('print'),$('printDirect')].filter(Boolean);
  controls.forEach(button=>{button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Preparing print…'});
  try{
    await window.LabelPrintModules?.ensurePdf?.();
    await ensurePdfLibrary();
    if(typeof window.generateLabelPdf!=='function')throw new Error('PDF generator did not load');
    const result=await window.generateLabelPdf({rows,layoutKey:layout,layoutDef:LAYOUTS[layout],filename:title,logoUrl:CONFIG.logo,output:'blob'});
    await openPdfPrintPrompt(result.blob);
    toast(`Print dialog opened · ${result.pageCount} page${result.pageCount===1?'':'s'}`);
  }catch(error){
    console.error('PDF print prompt failed:',error);
    toast('Opening browser print dialog');
    await browserPrintFallback(rows,title);
  }finally{
    controls.forEach(button=>{button.disabled=false;button.textContent=button.dataset.originalText||'Print';delete button.dataset.originalText});
  }
}
function bulkDuplicateKey(row){
  const n=normalizeLabel(row);
  return[n.prefix,n.company,n.invoice,n.attn,n.phone,n.address,n.sender,n.courier,n.awb].map(value=>clean(value).toUpperCase().replace(/\s+/g,' ')).join('|');
}
function importRows(){
  const parsed=$('paste').value.split(/\r?\n/).filter(Boolean).map(line=>{
    const c=line.split('\t');
    const raw=(c[1]||'').trim();
    const companyMatch=raw.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i);
    const addressAndPhone=(c[5]||'').trim();
    const phoneMatch=addressAndPhone.match(/\(([^()]*)\)\s*$/);
    return{
      prefix:companyMatch?companyMatch[1].toUpperCase():'',
      company:companyMatch?companyMatch[2]:raw,
      invoice:(c[2]||'').trim(),
      courier:(c[3]||'').trim()||'JNE',
      awb:(c[4]||'').trim(),
      attn:(c[6]||'').trim(),
      phone:phoneMatch?phoneMatch[1].trim():'',
      address:phoneMatch?addressAndPhone.slice(0,phoneMatch.index).trim():addressAndPhone,
      sender:''
    };
  }).map(normalizeLabel).map(row=>applyRememberedCompanyDefaults(row,false)).filter(r=>r.company&&!/^(penerima|recipient|company)$/i.test(r.company));
  if(!parsed.length)return toast('No valid rows detected');
  const seen=new Set();
  const unique=parsed.filter(row=>{const key=bulkDuplicateKey(row);if(seen.has(key))return false;seen.add(key);return true});
  const duplicateCount=parsed.length-unique.length;
  const rows=unique.slice(0,MAX_LABELS);
  rows.forEach(row=>rememberCompanyDefaults(row,false));
  persistCompanyMemory();
  labels=rows;
  selected=0;
  save('ksb-labels',labels);
  closeModals();
  renderAll();
  const limited=unique.length>MAX_LABELS;
  const tracked=rows.filter(row=>clean(row.awb)).length;
  const invoiced=rows.filter(row=>clean(row.invoice)).length;
  let message=limited?`Imported first ${MAX_LABELS} of ${unique.length} unique labels`:`${rows.length} labels imported`;
  if(tracked)message+=` · ${tracked} AWB${tracked===1?'':'s'}`;
  if(invoiced)message+=` · ${invoiced} invoice${invoiced===1?'':'s'}`;
  if(duplicateCount)message+=` · ${duplicateCount} duplicate${duplicateCount===1?'':'s'} removed`;
  toast(message);
}
function settings(){const e=$('endpoint');e.value=endpoint();$('connectionResult').textContent=connected?'Connected to Google Sheets.':(window.__lastSheetsError?`Last error: ${window.__lastSheetsError}`:'Connection not tested.');openModal('settingsModal')}
async function testConnection(){
  const result=$('connectionResult');
  try{const u=$('endpoint').value.trim();new URL(u);localStorage.setItem('ksb-endpoint',u);localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);result.textContent='Testing connection…';const r=await apiGet('ping');result.textContent=`Connected to ${r.spreadsheetName||'Google Sheets'} · API ${r.apiVersion||'unknown'}.`;window.__lastSheetsError=''}catch(e){window.__lastSheetsError=String(e?.message||e);result.textContent='Connection failed: '+window.__lastSheetsError}
}
async function saveConnection(){localStorage.setItem('ksb-endpoint',$('endpoint').value.trim());localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);closeModals();await sync()}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('avatar').onclick=()=>{$('entry').classList.remove('hidden');renderUsers()};
$('settings').onclick=$('status').onclick=settings;
$('addRecipient').onclick=addLabel;
$('clearAll').onclick=clearAllLabels;
$('fastInput').onclick=()=>openModal('inputModal');
$('importRows').onclick=importRows;
$('review').onclick=()=>review();
$('generate').onclick=()=>{const b=saveBatch();if(!b)return;review(b);toast(`${b.id} generated`)};
$('print').onclick=printNow;
$('printDirect').onclick=printNow;
if(!window.LabelPrintPerformance?.lowSpec){
  [$('print'),$('printDirect')].filter(Boolean).forEach(button=>{
    const warm=()=>Promise.all([window.LabelPrintModules?.ensurePdf?.(),ensurePdfLibrary()]).catch(()=>{});
    button.addEventListener('pointerenter',warm,{once:true,passive:true});
    button.addEventListener('focus',warm,{once:true,passive:true});
  });
}
$('remove').onclick=removeLabel;
$('duplicate').onclick=duplicate;
$('newBatch').onclick=()=>switchView('create');
$('search').oninput=debounce(renderCards,90);
$('range').onchange=renderAnalytics;
$('testConnection').onclick=testConnection;
$('saveConnection').onclick=saveConnection;
document.querySelectorAll('.close,.closeModal').forEach(b=>b.onclick=closeModals);
document.querySelectorAll('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)closeModals()});
['prefix','company','attn','phone','address'].forEach(id=>$(id).oninput=e=>update(id,e.target.value));
$('sender').onchange=e=>{const custom=e.target.value==='__CUSTOM__';$('customField').classList.toggle('hidden',!custom);if(!custom)update('sender',e.target.value)};
$('customSender').oninput=e=>update('sender',e.target.value);
const resizeDelay=window.LabelPrintPerformance?.lowSpec?260:120;
const fitOnResize=debounce(()=>{
  const performanceHelper=window.LabelPrintPerformance;
  if(performanceHelper?.lowSpec&&performanceHelper.isScrolling?.()){
    performanceHelper.whenScrollIdle?.(fitPreview);
    return;
  }
  fitPreview();
},resizeDelay);
window.addEventListener('resize',fitOnResize,{passive:true});
window.onkeydown=e=>{if(e.key==='Escape')closeModals()};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!connected)sync()});
renderUsers();
renderAll();
refreshDataSurfaces();
$('entry').classList.add('show');
const scheduleSync=()=>sync();
if('requestIdleCallback'in window)requestIdleCallback(scheduleSync,{timeout:1200});else setTimeout(scheduleSync,120);

;
/* Source: app-invoice-memory.js */
(()=>{
  const KEY='ksb-awb-invoice-map-v1';
  let memory={};
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
    if(saved&&typeof saved==='object'&&!Array.isArray(saved))memory=saved;
  }catch{}

  function invoiceKey(raw){
    const row=normalizeLabel(raw||{});
    return row.awb?`${row.courier||'JNE'}|${row.awb}`:'';
  }

  function lookup(raw){
    const row=normalizeLabel(raw||{});
    if(!row.awb)return'';
    return clean(memory[invoiceKey(row)]||memory[`*|${row.awb}`]);
  }

  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(memory))}catch(error){console.warn('Invoice memory save failed:',error)}
  }

  function rememberRows(rows,options={}){
    let changed=false;
    (Array.isArray(rows)?rows:[]).forEach(raw=>{
      const row=normalizeLabel(raw||{});
      if(!row.awb||!row.invoice)return;
      const specific=invoiceKey(row),fallback=`*|${row.awb}`;
      if(memory[specific]!==row.invoice){memory[specific]=row.invoice;changed=true}
      if(memory[fallback]!==row.invoice){memory[fallback]=row.invoice;changed=true}
    });
    if(changed)persist();
    if(options.backfill!==false)backfillState({queueSync:options.queueSync!==false});
    return changed;
  }

  function enrichRow(raw){
    const row=normalizeLabel(raw||{});
    if(row.invoice){
      const specific=invoiceKey(row),fallback=row.awb?`*|${row.awb}`:'';
      if(specific)memory[specific]=row.invoice;
      if(fallback)memory[fallback]=row.invoice;
      return row;
    }
    const remembered=lookup(row);
    if(remembered)row.invoice=remembered;
    return row;
  }

  let repairInFlight=false;
  function backfillState(options={}){
    let labelsChanged=false;
    labels=(Array.isArray(labels)?labels:[]).map(raw=>{
      const original=normalizeLabel(raw||{}),next=enrichRow(original);
      if(next.invoice!==original.invoice)labelsChanged=true;
      return next;
    });

    const changedBatches=[];
    history=(Array.isArray(history)?history:[]).map(batch=>{
      let batchChanged=false;
      const nextLabels=(Array.isArray(batch?.labels)?batch.labels:[]).map(raw=>{
        const original=normalizeLabel(raw||{}),next=enrichRow(original);
        if(next.invoice!==original.invoice)batchChanged=true;
        return next;
      });
      if(!batchChanged)return batch;
      const next={...batch,labels:nextLabels,syncState:'pending'};
      changedBatches.push(next);
      return next;
    });

    persist();
    if(labelsChanged)save('ksb-labels',labels);
    if(changedBatches.length)save('ksb-history',history);
    if(labelsChanged||changedBatches.length){
      window.LabelPrintTracking?.invalidate?.();
      if(active==='tracking')window.LabelPrintTracking?.render?.({force:true});
      else refreshDataSurfaces?.();
    }

    if(options.queueSync&&connected&&changedBatches.length&&!repairInFlight){
      repairInFlight=true;
      setTimeout(async()=>{
        try{for(const batch of changedBatches)await syncBatch(batch,false)}
        finally{repairInFlight=false}
      },0);
    }
    return{labelsChanged,batchesChanged:changedBatches.length};
  }

  rememberRows(labels,{backfill:false});
  (Array.isArray(history)?history:[]).forEach(batch=>rememberRows(batch?.labels||[],{backfill:false}));
  backfillState({queueSync:false});

  const baseApplyRemoteHistory=applyRemoteHistory;
  applyRemoteHistory=function(response){
    const enriched=response?.history?{...response,history:response.history.map(batch=>({...batch,labels:(batch.labels||[]).map(enrichRow)}))}:response;
    const result=baseApplyRemoteHistory(enriched);
    rememberRows((Array.isArray(history)?history:[]).flatMap(batch=>batch?.labels||[]),{backfill:false});
    backfillState({queueSync:false});
    return result;
  };

  const baseSyncBatch=syncBatch;
  syncBatch=async function(batch,announce=true){
    if(batch?.labels){
      batch.labels=batch.labels.map(enrichRow);
      rememberRows(batch.labels,{backfill:false});
    }
    return baseSyncBatch(batch,announce);
  };

  window.LabelPrintInvoiceMemory={lookup,rememberRows,enrichRow,backfillState};
})();

;
/* Source: app-validation.js */
(()=>{
  function endpointField(){return document.getElementById('endpoint')}
  function connectionResult(){return document.getElementById('connectionResult')}

  function validateEndpoint(value){
    const raw=clean(value);
    if(!raw)throw new Error('Enter an Apps Script web-app URL');
    const url=new URL(raw);
    if(url.protocol!=='https:')throw new Error('The backend URL must use HTTPS');
    if(!/\/exec\/?$/i.test(url.pathname))throw new Error('Use the deployed Apps Script URL ending in /exec');
    return url.toString();
  }

  async function testEndpointSafely(){
    const field=endpointField(),result=connectionResult(),testButton=document.getElementById('testConnection');
    if(!field||!result)return;
    const previousUrl=localStorage.getItem('ksb-endpoint');
    const previousRevision=localStorage.getItem('ksb-endpoint-revision');
    if(testButton)testButton.disabled=true;
    try{
      const url=validateEndpoint(field.value);
      result.textContent='Testing connection…';
      localStorage.setItem('ksb-endpoint',url);
      localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);
      const response=await apiGet('ping');
      if(!response?.success)throw new Error('Invalid LabelPrint API response');
      field.value=url;
      result.textContent=`Connected to ${response.spreadsheetName||'Google Sheets'} · API ${response.apiVersion||'unknown'}.`;
      window.__lastSheetsError='';
    }catch(error){
      if(previousUrl===null)localStorage.removeItem('ksb-endpoint');else localStorage.setItem('ksb-endpoint',previousUrl);
      if(previousRevision===null)localStorage.removeItem('ksb-endpoint-revision');else localStorage.setItem('ksb-endpoint-revision',previousRevision);
      window.__lastSheetsError=String(error?.message||error);
      result.textContent='Connection failed: '+window.__lastSheetsError;
      field.focus();
    }finally{
      if(testButton)testButton.disabled=false;
    }
  }

  async function saveEndpointSafely(){
    const field=endpointField(),result=connectionResult(),saveButton=document.getElementById('saveConnection');
    if(!field)return;
    if(saveButton)saveButton.disabled=true;
    try{
      const url=validateEndpoint(field.value);
      localStorage.setItem('ksb-endpoint',url);
      localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);
      field.value=url;
      closeModals();
      await sync();
    }catch(error){
      const message=String(error?.message||error);
      if(result)result.textContent='Connection failed: '+message;
      toast(message);
      field.focus();
    }finally{
      if(saveButton)saveButton.disabled=false;
    }
  }

  function importRowsSafely(){
    const paste=document.getElementById('paste');
    if(!paste)return;
    const parsed=paste.value.split(/\r?\n/).filter(Boolean).map(line=>{
      const columns=line.split('\t');
      const raw=(columns[1]||'').trim();
      const match=raw.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i);
      const addressPhone=(columns[5]||'').trim();
      const phoneMatch=addressPhone.match(/\(([^()]*)\)\s*$/);
      return{
        prefix:match?match[1].toUpperCase():'',
        company:match?match[2]:raw,
        invoice:(columns[2]||'').trim(),
        courier:(columns[3]||'').trim()||'JNE',
        awb:(columns[4]||'').trim(),
        attn:(columns[6]||'').trim(),
        phone:phoneMatch?phoneMatch[1].trim():'',
        address:phoneMatch?addressPhone.slice(0,phoneMatch.index).trim():addressPhone,
        sender:''
      };
    }).map(normalizeLabel).map(row=>applyRememberedCompanyDefaults(row,false)).filter(row=>row.company&&!/^(penerima|recipient|company)$/i.test(row.company));
    if(!parsed.length)return toast('No valid rows detected');
    const seen=new Set();
    const unique=parsed.filter(row=>{const key=bulkDuplicateKey(row);if(seen.has(key))return false;seen.add(key);return true});
    const duplicateCount=parsed.length-unique.length;
    const rows=unique.slice(0,MAX_LABELS);
    rows.forEach(row=>rememberCompanyDefaults(row,false));
    persistCompanyMemory();
    window.LabelPrintInvoiceMemory?.rememberRows?.(rows,{backfill:true,queueSync:true});
    labels=rows;
    selected=0;
    save('ksb-labels',labels);
    closeModals();
    renderAll();
    const limited=unique.length>MAX_LABELS;
    const tracked=rows.filter(row=>clean(row.awb)).length;
    const invoiced=rows.filter(row=>clean(row.invoice)).length;
    let message=limited?`Imported first ${MAX_LABELS} of ${unique.length} unique labels`:`${rows.length} labels imported`;
    if(tracked)message+=` · ${tracked} AWB${tracked===1?'':'s'}`;
    if(invoiced)message+=` · ${invoiced} invoice${invoiced===1?'':'s'}`;
    if(duplicateCount)message+=` · ${duplicateCount} duplicate${duplicateCount===1?'':'s'} removed`;
    toast(message);
  }

  const testButton=document.getElementById('testConnection');
  const saveButton=document.getElementById('saveConnection');
  const importButton=document.getElementById('importRows');
  if(testButton)testButton.onclick=testEndpointSafely;
  if(saveButton)saveButton.onclick=saveEndpointSafely;
  if(importButton)importButton.onclick=importRowsSafely;

  let lastErrorToast=0;
  window.addEventListener('unhandledrejection',event=>{
    const message=String(event.reason?.message||event.reason||'Unexpected error');
    console.error('Unhandled LabelPrint error:',event.reason);
    if(/AbortError/i.test(message))return;
    const now=Date.now();
    if(now-lastErrorToast<3000)return;
    lastErrorToast=now;
    toast('Something went wrong. Your local data is still safe.');
  });
})();

;
/* Source: app-fixed-backend.js */
(()=>{
  const FIXED_BACKEND_URL='https://script.google.com/macros/s/AKfycbwVOHKp4BIbj0rbMNV-y543i7L-175E8CbjFlz2f5kA6RYqpt9aj2crriQ-unsW9RO9/exec';

  try{CONFIG.endpoint=FIXED_BACKEND_URL}catch{}
  try{
    localStorage.removeItem('ksb-endpoint');
    localStorage.removeItem('ksb-endpoint-revision');
  }catch{}

  endpoint=function(){return FIXED_BACKEND_URL};

  const field=document.getElementById('endpoint');
  const result=document.getElementById('connectionResult');
  const testButton=document.getElementById('testConnection');
  const saveButton=document.getElementById('saveConnection');

  if(field){
    field.value=FIXED_BACKEND_URL;
    field.readOnly=true;
    field.setAttribute('aria-readonly','true');
    field.title='This backend is fixed by the LabelPrint deployment';
  }

  async function testFixedBackend(){
    if(!result)return;
    if(testButton)testButton.disabled=true;
    try{
      result.textContent='Testing fixed backend…';
      const response=await apiGet('ping');
      if(!response?.success)throw new Error('Invalid LabelPrint API response');
      result.textContent=`Connected to ${response.spreadsheetName||'Google Sheets'} · API ${response.apiVersion||'unknown'}.`;
      window.__lastSheetsError='';
    }catch(error){
      window.__lastSheetsError=String(error?.message||error);
      result.textContent='Connection failed: '+window.__lastSheetsError;
    }finally{
      if(testButton)testButton.disabled=false;
    }
  }

  if(testButton)testButton.onclick=testFixedBackend;
  if(saveButton){
    saveButton.textContent='Backend locked';
    saveButton.disabled=true;
    saveButton.title='The Google Sheets backend is hardcoded in this deployment';
  }

  window.LabelPrintBackend={url:FIXED_BACKEND_URL,test:testFixedBackend,locked:true};
})();

;
/* Source: app-tracking-tab-v2.js */
(()=>{
  const nav=document.querySelector('.nav');
  const analyticsButton=nav?.querySelector('[data-view="analytics"]');
  if(nav&&!nav.querySelector('[data-view="tracking"]')){
    const button=document.createElement('button');
    button.type='button';
    button.dataset.view='tracking';
    button.title='Tracking';
    button.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 10h15v12H5zM20 14h4l3 4v4h-7zM9 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM23 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg><span>Tracking</span><span class="badge" id="trackingBadge">0</span>';
    nav.insertBefore(button,analyticsButton||null);
  }

  const analyticsView=$('analyticsView');
  if(analyticsView&&!$('trackingView')){
    const section=document.createElement('section');
    section.className='view hidden';
    section.id='trackingView';
    section.innerHTML=`
      <div class="page-head tracking-page-head">
        <div>
          <p class="kicker">Shipment workspace</p>
          <h1 class="page-title">Tracking</h1>
          <p>Filter saved AWBs by Penerima, invoice number, or AWB number.</p>
        </div>
        <div class="actions tracking-head-actions">
          <button class="btn light" id="copyVisibleAwbs" type="button">Copy visible AWBs</button>
          <button class="btn dark" id="refreshTracking" type="button">Refresh list</button>
        </div>
      </div>
      <div class="tracking-kpis" id="trackingKpis"></div>
      <section class="panel tracking-list-panel">
        <div class="panel-head tracking-list-head">
          <div class="tracking-list-copy"><p class="kicker">Shipment register</p><h2>Saved shipments</h2><p id="trackingCount">0 shipments</p></div>
          <div class="tracking-filters">
            <label class="tracking-search"><span>⌕</span><input id="trackingSearch" type="search" placeholder="Search Penerima, invoice, or AWB…" autocomplete="off"></label>
            <select class="control" id="trackingScope" aria-label="Tracking source"><option value="all">All sources</option><option value="current">Current batch</option><option value="history">Saved history</option></select>
            <select class="control" id="trackingCourier" aria-label="Courier filter"><option value="all">All couriers</option></select>
            <select class="control" id="trackingStatus" aria-label="Shipment status filter"><option value="all">All statuses</option><option value="pending">Not marked</option><option value="processing">On process</option><option value="delivered">Delivered</option></select>
          </div>
        </div>
        <div class="tracking-table-shell">
          <table class="tracking-table">
            <thead><tr><th>Shipment</th><th>Invoice</th><th>Courier</th><th>AWB / resi</th><th>Source</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
            <tbody id="trackingList"></tbody>
          </table>
          <div class="tracking-empty hidden" id="trackingEmpty"><span>⌕</span><h3>No shipments found</h3><p>Search by Penerima, invoice number, or AWB number.</p></div>
        </div>
        <nav class="tracking-pagination hidden" id="trackingPagination" aria-label="Shipment pages"></nav>
      </section>`;
    analyticsView.parentNode.insertBefore(section,analyticsView);
  }

  const lowSpec=!!window.LabelPrintPerformance?.lowSpec;
  // Keep the table deliberately small. Rendering hundreds of interactive rows at
  // once is the largest avoidable cost on low-spec PCs.
  const pageSize=lowSpec?12:15;
  const TRACKING_STATUS_STORAGE_KEY='ksb-tracking-statuses-v1';
  const TRACKING_STATUS_VALUES=new Set(['processing','delivered']);
  let trackingPage=1;
  let refreshedAt=null;
  let visibleShipments=[];
  let trackingDataRevision=0;
  let shipmentCache={revision:-1,shipments:[]};
  let kpiSignature='';
  let badgeRefreshId=0;
  let remoteStatusSupported=null;
  let statusRefreshPromise=null;

  function normalizeTrackingStatus(value){
    const raw=typeof value==='string'?{status:value}:(value&&typeof value==='object'?value:{});
    const status=clean(raw.status).toLowerCase();
    if(!TRACKING_STATUS_VALUES.has(status))return null;
    return{
      status,
      updatedAt:clean(raw.updatedAt),
      updatedBy:clean(raw.updatedBy),
      syncState:raw.syncState==='pending'?'pending':'synced'
    };
  }

  function normalizeTrackingStatusMap(source){
    const next={};
    if(!source||typeof source!=='object'||Array.isArray(source))return next;
    Object.entries(source).forEach(([key,value])=>{const record=normalizeTrackingStatus(value);if(record&&clean(key))next[clean(key)]=record});
    return next;
  }

  let trackingStatuses=normalizeTrackingStatusMap(load(TRACKING_STATUS_STORAGE_KEY,{}));

  function persistTrackingStatuses(){save(TRACKING_STATUS_STORAGE_KEY,trackingStatuses)}
  function trackingStatusRecord(shipment){return trackingStatuses[shipment?.key]||{status:'pending',updatedAt:'',updatedBy:'',syncState:'synced'}}
  function trackingStatusLabel(status){return status==='processing'?'On process':status==='delivered'?'Delivered':'Not marked'}
  function statusTimestamp(value){const time=new Date(value||0).getTime();return Number.isFinite(time)?time:0}

  function applyRemoteTrackingStatuses(rows){
    let changed=false;
    (Array.isArray(rows)?rows:[]).forEach(item=>{
      const courier=clean(item?.courier).toUpperCase()||'JNE';
      const awb=normalizeAwb(item?.awb);
      const key=clean(item?.key)||(awb?`${courier}|${awb}`:'');
      const remote=normalizeTrackingStatus({...item,syncState:'synced'});
      if(!key||!remote)return;
      const local=trackingStatuses[key];
      const remoteTime=statusTimestamp(remote.updatedAt),localTime=statusTimestamp(local?.updatedAt);
      if(!local||remoteTime>localTime||(remoteTime===localTime&&local.syncState!=='pending')){
        if(JSON.stringify(local)!==JSON.stringify(remote)){trackingStatuses[key]=remote;changed=true}
      }
    });
    if(changed)persistTrackingStatuses();
    return changed;
  }

  async function syncPendingTrackingStatuses(){
    if(!connected||remoteStatusSupported!==true)return false;
    let changed=false;
    for(const [key,record] of Object.entries(trackingStatuses)){
      if(record.syncState!=='pending')continue;
      const separator=key.indexOf('|');
      const courier=separator>=0?key.slice(0,separator):'JNE';
      const awb=separator>=0?key.slice(separator+1):key;
      try{
        const result=await post('saveShipmentStatus',{key,courier,awb,status:record.status,updatedAt:record.updatedAt,updatedBy:record.updatedBy});
        const current=trackingStatuses[key];
        if(!result?.queued&&current?.status===record.status&&current?.updatedAt===record.updatedAt){
          const server=normalizeTrackingStatus({...result?.shipmentStatus,syncState:'synced'});
          trackingStatuses[key]=server&&statusTimestamp(server.updatedAt)>=statusTimestamp(current.updatedAt)?server:{...current,syncState:'synced'};
          changed=true;
        }else if(!result?.queued&&result?.shipmentStatus)changed=applyRemoteTrackingStatuses([result.shipmentStatus])||changed;
      }catch(error){console.warn('Shipment status sync failed:',error)}
    }
    if(changed)persistTrackingStatuses();
    return changed;
  }

  async function refreshTrackingStatuses(){
    if(statusRefreshPromise)return statusRefreshPromise;
    statusRefreshPromise=(async()=>{
      try{
        const result=await apiGet('getShipmentStatuses');
        remoteStatusSupported=true;
        const changed=applyRemoteTrackingStatuses(result?.shipmentStatuses);
        const synced=await syncPendingTrackingStatuses();
        if((changed||synced)&&active==='tracking')renderTracking();
        return true;
      }catch(error){
        if(/Unknown GET action/i.test(String(error?.message||error)))remoteStatusSupported=false;
        else console.warn('Shipment statuses could not be refreshed:',error);
        return false;
      }finally{statusRefreshPromise=null}
    })();
    return statusRefreshPromise;
  }

  function markShipmentStatus(shipment,status){
    if(!shipment||!TRACKING_STATUS_VALUES.has(status))return;
    const current=trackingStatusRecord(shipment);
    if(current.status===status)return toast(`Shipment is already marked ${trackingStatusLabel(status).toLowerCase()}`);
    trackingStatuses[shipment.key]={status,updatedAt:new Date().toISOString(),updatedBy:clean(currentUser?.name||currentUser?.nickname||'Local user'),syncState:'pending'};
    persistTrackingStatuses();
    renderTracking();
    toast(status==='processing'?'Shipment marked as on process':'Shipment marked as delivered');
    if(connected){
      if(remoteStatusSupported===true)syncPendingTrackingStatuses();
      else if(remoteStatusSupported===null)refreshTrackingStatuses();
    }
  }

  function trackingKey(row){
    const r=normalizeLabel(row||{});
    return `${r.courier||'JNE'}|${r.awb}`;
  }

  function invalidateTracking(){
    trackingDataRevision++;
    shipmentCache={revision:-1,shipments:[]};
  }

  function collectShipments(force=false){
    if(!force&&shipmentCache.revision===trackingDataRevision)return shipmentCache.shipments;

    const map=new Map();
    const absorb=(raw,meta)=>{
      const row=normalizeLabel(raw||{});
      if(!row.awb)return;
      const key=trackingKey(row);
      let shipment=map.get(key);
      if(!shipment){
        shipment={key,row,current:false,currentIndex:null,batches:new Set(),recipients:new Set(),invoices:new Set(),awbs:new Set(),latestBatch:'',latestTimestamp:'',latestUser:'',occurrences:0,searchText:''};
        map.set(key,shipment);
      }
      shipment.occurrences++;
      if(full(row))shipment.recipients.add(full(row));
      if(row.invoice)shipment.invoices.add(row.invoice);
      shipment.awbs.add(row.awb);
      if(meta.source==='current'){
        shipment.current=true;
        shipment.currentIndex=meta.index;
        shipment.row=row;
      }else{
        if(meta.batchId)shipment.batches.add(meta.batchId);
        const incomingTime=new Date(meta.timestamp||0).getTime()||0;
        const storedTime=new Date(shipment.latestTimestamp||0).getTime()||0;
        if(!shipment.latestTimestamp||incomingTime>=storedTime){
          shipment.latestTimestamp=meta.timestamp||'';
          shipment.latestBatch=meta.batchId||'';
          shipment.latestUser=meta.user||'';
          if(!shipment.current)shipment.row=row;
        }
      }
    };

    (Array.isArray(labels)?labels:[]).forEach((row,index)=>absorb(row,{source:'current',index}));
    (Array.isArray(history)?history:[]).forEach(batch=>{
      (Array.isArray(batch?.labels)?batch.labels:[]).forEach(row=>absorb(row,{source:'history',batchId:clean(batch.id),timestamp:batch.timestamp,user:batch.user}));
    });

    const shipments=[...map.values()].map(shipment=>{
      shipment.searchText=[...shipment.recipients,...shipment.invoices,...shipment.awbs].join(' ').toLowerCase();
      return shipment;
    }).sort((a,b)=>{
      if(a.current!==b.current)return a.current?-1:1;
      return(new Date(b.latestTimestamp||0).getTime()||0)-(new Date(a.latestTimestamp||0).getTime()||0);
    });

    shipmentCache={revision:trackingDataRevision,shipments};
    return shipments;
  }

  function updateTrackingBadge(shipments=collectShipments()){
    const badge=$('trackingBadge');
    if(badge)badge.textContent=shipments.length>99?'99+':String(shipments.length);
  }

  function scheduleTrackingBadge(){
    if(lowSpec||active==='tracking'||badgeRefreshId)return;
    const run=()=>{badgeRefreshId=0;updateTrackingBadge()};
    badgeRefreshId=window.LabelPrintPerformance?.schedule?.(run,1800)||setTimeout(run,900);
  }

  function sourceLabel(shipment){
    if(shipment.current&&shipment.batches.size)return `Current batch · ${shipment.batches.size} saved batch${shipment.batches.size===1?'':'es'}`;
    if(shipment.current)return'Current batch';
    return shipment.batches.size===1?'Saved history':`${shipment.batches.size} saved batches`;
  }

  function dateLabel(value){
    const date=new Date(value);
    return value&&!isNaN(date)?date.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'No saved date';
  }

  function filteredShipments(shipments){
    const query=clean($('trackingSearch')?.value).toLowerCase();
    const terms=query.split(/\s+/).filter(Boolean);
    const scope=$('trackingScope')?.value||'all';
    const courier=$('trackingCourier')?.value||'all';
    const status=$('trackingStatus')?.value||'all';
    return shipments.filter(shipment=>{
      if(scope==='current'&&!shipment.current)return false;
      if(scope==='history'&&!shipment.batches.size)return false;
      if(courier!=='all'&&shipment.row.courier!==courier)return false;
      if(status!=='all'&&trackingStatusRecord(shipment).status!==status)return false;
      return !terms.length||terms.every(term=>shipment.searchText.includes(term));
    });
  }

  function renderCourierOptions(shipments){
    const select=$('trackingCourier');
    if(!select)return;
    const selected=select.value||'all';
    const couriers=[...new Set(shipments.map(item=>item.row.courier).filter(Boolean))].sort();
    const next='<option value="all">All couriers</option>'+couriers.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    if(select.innerHTML!==next)select.innerHTML=next;
    select.value=couriers.includes(selected)?selected:'all';
  }

  function invoiceLabel(shipment,{prefix=true}={}){
    const values=[...shipment.invoices];
    if(!values.length)return'—';
    const text=values.length<=2?values.join(' · '):`${values.slice(0,2).join(' · ')} +${values.length-2}`;
    return prefix?`Invoice ${text}`:text;
  }

  function icon(name){
    const paths={
      copy:'<rect x="8" y="8" width="10" height="10" rx="2"></rect><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path>',
      track:'<path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5Z"></path><circle cx="10" cy="10" r="2"></circle>',
      edit:'<path d="m4 14 1-4 7.8-7.8a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L8 13l-4 1Z"></path><path d="m11.8 3.2 3 3"></path>',
      batch:'<path d="M4 2.5h8l4 4v11H4z"></path><path d="M12 2.5v4h4M7 10h6M7 13h6"></path>'
    };
    return `<svg viewBox="0 0 20 20" aria-hidden="true">${paths[name]||''}</svg>`;
  }

  function pageItems(total,current){
    if(total<=5)return Array.from({length:total},(_,index)=>index+1);
    let start=Math.max(1,current-2),end=Math.min(total,start+4);
    start=Math.max(1,end-4);
    return Array.from({length:end-start+1},(_,index)=>start+index);
  }

  function renderPagination(totalPages){
    const pagination=$('trackingPagination');
    if(!pagination)return;
    pagination.classList.toggle('hidden',totalPages<=1);
    if(totalPages<=1){pagination.innerHTML='';return}
    const pages=pageItems(totalPages,trackingPage);
    pagination.innerHTML=`
      <button type="button" class="tracking-page-step" data-tracking-page="${trackingPage-1}" ${trackingPage===1?'disabled':''}>← <span>Previous</span></button>
      <div class="tracking-page-numbers">${pages.map(page=>`<button type="button" data-tracking-page="${page}" class="${page===trackingPage?'active':''}" aria-current="${page===trackingPage?'page':'false'}">${page}</button>`).join('')}</div>
      <button type="button" class="tracking-page-step" data-tracking-page="${trackingPage+1}" ${trackingPage===totalPages?'disabled':''}><span>Next</span> →</button>`;
  }

  function renderTracking(options={}){
    if(options.reset)trackingPage=1;
    const shipments=collectShipments(!!options.force);
    updateTrackingBadge(shipments);
    renderCourierOptions(shipments);
    visibleShipments=filteredShipments(shipments);
    const totalPages=Math.max(1,Math.ceil(visibleShipments.length/pageSize));
    trackingPage=Math.min(Math.max(1,trackingPage),totalPages);
    const pageStart=(trackingPage-1)*pageSize;
    const rendered=visibleShipments.slice(pageStart,pageStart+pageSize);

    let processingCount=0,processingCurrentCount=0,deliveredCount=0;
    const couriers=new Set();
    shipments.forEach(item=>{
      couriers.add(item.row.courier);
      const status=trackingStatusRecord(item).status;
      if(status==='processing'){processingCount++;if(item.current)processingCurrentCount++}
      else if(status==='delivered')deliveredCount++;
    });
    const courierCount=couriers.size;
    const kpis=$('trackingKpis');
    const nextKpiSignature=[shipments.length,processingCount,processingCurrentCount,deliveredCount,courierCount].join('|');
    if(kpis&&kpiSignature!==nextKpiSignature){
      kpiSignature=nextKpiSignature;
      kpis.innerHTML=[
      ['Unique AWBs',shipments.length,'primary','Across current and saved labels'],
      ['On process',processingCount,'accent',`${processingCurrentCount} in the current batch`],
      ['Delivered',deliveredCount,'soft','Marked as received'],
      ['Couriers',courierCount,'neutral','Detected automatically']
      ].map(([label,value,tone,note])=>`<article class="metric ${tone}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
    }

    const count=$('trackingCount');
    if(count){
      const rangeStart=visibleShipments.length?pageStart+1:0;
      const rangeEnd=Math.min(pageStart+rendered.length,visibleShipments.length);
      count.textContent=visibleShipments.length===shipments.length?`${rangeStart}–${rangeEnd} of ${shipments.length} shipments`:`${rangeStart}–${rangeEnd} of ${visibleShipments.length} matches · ${shipments.length} total`;
    }
    const refreshed=$('trackingRefreshedAt');
    if(refreshed)refreshed.textContent=refreshedAt?refreshedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'On opening Tracking tab';

    const list=$('trackingList'),empty=$('trackingEmpty');
    if(!list)return;
    const hasRows=visibleShipments.length>0;
    empty?.classList.toggle('hidden',hasRows);
    list.closest('table')?.classList.toggle('hidden',!hasRows);
    renderPagination(hasRows?totalPages:0);
    if(!hasRows){list.innerHTML='';return}
    const rows=rendered.map((shipment,index)=>{
      const row=shipment.row;
      const recipient=full(row)||'Unnamed recipient';
      const latest=shipment.current?'Unsaved current data':dateLabel(shipment.latestTimestamp);
      const location=row.address||row.attn||'No address saved';
      const source=sourceLabel(shipment);
      const status=trackingStatusRecord(shipment);
      const statusTitle=status.updatedAt?`Updated ${dateLabel(status.updatedAt)}${status.updatedBy?` by ${status.updatedBy}`:''}`:'Shipment status has not been marked';
      const batchAction=shipment.latestBatch?`<button type="button" class="tracking-icon-action" data-open-tracking-batch="${esc(shipment.latestBatch)}" title="Open saved batch" aria-label="Open saved batch">${icon('batch')}</button>`:'';
      const editAction=shipment.current&&Number.isInteger(shipment.currentIndex)?`<button type="button" class="tracking-icon-action" data-edit-tracking-index="${shipment.currentIndex}" title="Edit label" aria-label="Edit label">${icon('edit')}</button>`:'';
      const statusOptions=status.status==='pending'?'<option value="" selected disabled>Not marked</option>':'';
      return `<tr class="tracking-row" data-tracking-index="${index}">
        <td data-label="Shipment"><div class="tracking-shipment-cell"><span class="tracking-courier-mark">${esc((row.courier||'JNE').slice(0,4))}</span><span class="tracking-recipient"><b>${esc(recipient)}</b><span>${esc(location)}</span></span></div></td>
        <td data-label="Invoice"><span class="tracking-cell-main">${esc(invoiceLabel(shipment,{prefix:false}))}</span></td>
        <td data-label="Courier"><span class="tracking-courier-name">${esc(row.courier||'JNE')}</span></td>
        <td data-label="AWB / resi"><span class="tracking-awb"><strong>${esc(row.awb)}</strong><small>${shipment.occurrences>1?`${shipment.occurrences} records`:'1 record'}</small></span></td>
        <td data-label="Source"><span class="tracking-source"><b>${esc(source)}</b><small>${esc(latest)}</small></span></td>
        <td data-label="Status"><label class="tracking-status-control ${esc(status.status)}" title="${esc(statusTitle)}"><span class="tracking-status-dot"></span><select data-set-tracking-status data-tracking-status-key="${esc(shipment.key)}" aria-label="Status for ${esc(row.awb)}">${statusOptions}<option value="processing" ${status.status==='processing'?'selected':''}>On process</option><option value="delivered" ${status.status==='delivered'?'selected':''}>Delivered</option></select></label></td>
        <td data-label="Actions"><div class="tracking-row-actions">
          <button type="button" class="tracking-icon-action" data-copy-tracking-awb="${esc(row.awb)}" title="Copy AWB" aria-label="Copy AWB">${icon('copy')}</button>
          ${editAction}${batchAction}
          <button type="button" class="tracking-icon-action primary" data-track-shipment="${index}" title="Open courier tracking" aria-label="Open courier tracking">${icon('track')}</button>
        </div></td>
      </tr>`;
    }).join('');
    list.innerHTML=rows;
  }

  async function copyText(value){
    const text=String(value||'');
    if(!text)return false;
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch{}
    const area=document.createElement('textarea');
    area.value=text;
    area.style.cssText='position:fixed;left:-9999px;top:0';
    document.body.appendChild(area);
    area.select();
    let copied=false;
    try{copied=document.execCommand('copy')}catch{}
    area.remove();
    return copied;
  }

  const trackingView=$('trackingView');
  document.querySelector('[data-view="tracking"]')?.addEventListener('click',()=>switchView('tracking'));
  $('trackingSearch')?.addEventListener('input',debounce(()=>renderTracking({reset:true}),lowSpec?180:90));
  $('trackingScope')?.addEventListener('change',()=>renderTracking({reset:true}));
  $('trackingCourier')?.addEventListener('change',()=>renderTracking({reset:true}));
  $('trackingStatus')?.addEventListener('change',()=>renderTracking({reset:true}));
  $('refreshTracking')?.addEventListener('click',async()=>{refreshedAt=new Date();invalidateTracking();await refreshTrackingStatuses();renderTracking({reset:true,force:true});toast('Tracking list refreshed')});
  $('copyVisibleAwbs')?.addEventListener('click',async()=>{
    const text=visibleShipments.map(item=>item.row.awb).join('\n');
    if(!text)return toast('No visible AWBs to copy');
    const copied=await copyText(text);
    toast(copied?`${visibleShipments.length} AWB${visibleShipments.length===1?'':'s'} copied`:'Unable to copy AWBs');
  });
  $('trackingList')?.addEventListener('click',async event=>{
    const trackButton=event.target.closest('[data-track-shipment]');
    if(trackButton){
      const shipment=visibleShipments[(trackingPage-1)*pageSize+Number(trackButton.dataset.trackShipment)];
      if(shipment)window.LabelPrintAwb?.open?.(shipment.row);
      return;
    }
    const copyButton=event.target.closest('[data-copy-tracking-awb]');
    if(copyButton){
      const copied=await copyText(copyButton.dataset.copyTrackingAwb);
      toast(copied?'AWB copied':'Unable to copy AWB');
      return;
    }
    const editButton=event.target.closest('[data-edit-tracking-index]');
    if(editButton){
      selected=Number(editButton.dataset.editTrackingIndex)||0;
      switchView('create');
      renderAll();
      requestAnimationFrame(()=>$('awb')?.focus());
      return;
    }
    const batchButton=event.target.closest('[data-open-tracking-batch]');
    if(batchButton){
      historySelected=batchButton.dataset.openTrackingBatch;
      switchView('history');
      renderHistory();
    }
  });
  $('trackingList')?.addEventListener('change',event=>{
    const statusControl=event.target.closest('[data-set-tracking-status]');
    if(!statusControl)return;
    const shipment=visibleShipments.find(item=>item.key===statusControl.dataset.trackingStatusKey);
    markShipmentStatus(shipment,statusControl.value);
  });
  $('trackingPagination')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-tracking-page]');
    if(!button||button.disabled)return;
    trackingPage=Number(button.dataset.trackingPage)||1;
    renderTracking();
    $('trackingList')?.closest('.tracking-list-panel')?.scrollIntoView({block:'start',behavior:lowSpec?'auto':'smooth'});
  });

  const baseSwitchView=switchView;
  switchView=function(view){
    if(view==='tracking'){
      active='tracking';
      ['create','history','analytics'].forEach(name=>$(name+'View')?.classList.add('hidden'));
      trackingView?.classList.remove('hidden');
      document.querySelectorAll('.nav button').forEach(button=>button.classList.toggle('active',button.dataset.view==='tracking'));
      const subtitle=$('subtitle');
      if(subtitle)subtitle.textContent='Filter shipments by Penerima, invoice, or AWB.';
      renderTracking({reset:true});
      refreshTrackingStatuses();
      return;
    }
    trackingView?.classList.add('hidden');
    return baseSwitchView(view);
  };

  const baseRefreshDataSurfaces=refreshDataSurfaces;
  refreshDataSurfaces=function(){
    invalidateTracking();
    const result=baseRefreshDataSurfaces();
    if(active==='tracking')renderTracking();else scheduleTrackingBadge();
    return result;
  };

  const baseRenderAll=renderAll;
  renderAll=function(){
    invalidateTracking();
    const result=baseRenderAll();
    if(active==='tracking')renderTracking();else scheduleTrackingBadge();
    return result;
  };

  const baseUpdate=update;
  update=function(...args){
    invalidateTracking();
    return baseUpdate(...args);
  };
  const initialBadge=$('trackingBadge');
  if(initialBadge)initialBadge.textContent=lowSpec?'–':'…';
  scheduleTrackingBadge();
  window.LabelPrintTracking={render:renderTracking,collect:collectShipments,invalidate:invalidateTracking};
})();

;
/* Source: app-tracking-settings.js */
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

;
/* Source: app-import.js */
const HISTORY_IMPORT_REVISION='2026-07-13-tracking-history-import-03';
let xlsxLibraryPromise=null;
function ensureXlsxLibrary(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(xlsxLibraryPromise)return xlsxLibraryPromise;
  const sources=['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'];
  xlsxLibraryPromise=new Promise((resolve,reject)=>{
    const trySource=index=>{
      if(index>=sources.length)return reject(new Error('Excel reader failed to load'));
      const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();trySource(index+1)},15000);
      script.src=sources[index];script.async=true;script.dataset.labelprintXlsx='true';
      script.onload=()=>{clearTimeout(timer);if(window.XLSX)resolve(window.XLSX);else{script.remove();trySource(index+1)}};
      script.onerror=()=>{clearTimeout(timer);script.remove();trySource(index+1)};
      document.head.appendChild(script);
    };
    trySource(0);
  }).catch(error=>{xlsxLibraryPromise=null;throw error});
  return xlsxLibraryPromise;
}
function workbookSheet(book,name){
  const match=(book.SheetNames||[]).find(sheetName=>clean(sheetName).toLowerCase()===clean(name).toLowerCase());
  return match?book.Sheets[match]:null;
}
function workbookRows(book,name){
  const sheet=workbookSheet(book,name);
  return sheet?window.XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true}):[];
}
function workbookRowsAny(book,names){
  for(const name of names){const rows=workbookRows(book,name);if(rows.length)return rows}
  return[];
}
const importRowCache=new WeakMap();
function importRowMap(row){
  if(!row||typeof row!=='object')return{};
  if(importRowCache.has(row))return importRowCache.get(row);
  const map={};Object.entries(row).forEach(([key,value])=>{map[clean(key).toLowerCase().replace(/[^a-z0-9]+/g,'')]=value});importRowCache.set(row,map);return map;
}
function importValue(row,names){
  const map=importRowMap(row);
  for(const name of names){const key=clean(name).toLowerCase().replace(/[^a-z0-9]+/g,'');if(Object.prototype.hasOwnProperty.call(map,key)&&map[key]!==''&&map[key]!=null)return map[key]}
  return'';
}
function importText(value){return clean(value)}
function validUtcDate(parts){
  const [year,month,day,hour,minute,second]=parts,date=new Date(Date.UTC(year,month-1,day,hour,minute,second));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day&&date.getUTCHours()===hour&&date.getUTCMinutes()===minute&&date.getUTCSeconds()===second?date:null;
}
function importTimestamp(batchId,value){
  const match=String(batchId||'').match(/(\d{14})$/);
  if(match){
    const text=match[1],parts=[Number(text.slice(0,4)),Number(text.slice(4,6)),Number(text.slice(6,8)),Number(text.slice(8,10)),Number(text.slice(10,12)),Number(text.slice(12,14))],date=validUtcDate(parts);
    if(date)return date.toISOString();
  }
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString();
  if(typeof value==='number'&&Number.isFinite(value)){
    const date=new Date(Date.UTC(1899,11,30)+value*86400000);
    if(!Number.isNaN(date.getTime()))return date.toISOString();
  }
  const text=clean(value),date=text?new Date(text):null;
  return date&&!Number.isNaN(date.getTime())?date.toISOString():new Date().toISOString();
}
function importRowTimestamp(row){
  const direct=importValue(row,['timestamp','datetime','date time']);
  if(direct)return direct;
  const date=importValue(row,['date']),time=importValue(row,['time']);
  return date&&time?`${date} ${time}`:date||time||'';
}
function importLayout(value,labelCount){
  const key=clean(value).toLowerCase().replace(/\s+/g,'').replace(/×/g,'x');
  const map={'3x3':'3x3','3x2':'3x2','2x3':'2x3','2x2':'2x2','2x1':'2x1','1x2':'2x1','1x1':'1x1','3x4':'3x3'};
  return map[key]||(labelCount<=6?'2x3':'3x3');
}
function buildImportedHistory(book){
  const labelRows=workbookRowsAny(book,['Label History','Label Detail']);
  if(!labelRows.length)throw new Error('The workbook does not contain a Label History or Label Detail sheet');
  const generationRows=workbookRowsAny(book,['Generation Log','Batch Detail']);
  const userRows=workbookRowsAny(book,['Users','User Summary']);
  const generation=new Map(generationRows.map(row=>[importText(importValue(row,['batchId','Batch ID','ID'])),row]).filter(entry=>entry[0]));
  const nicknames=new Map(userRows.map(row=>[importText(importValue(row,['name','user'])),importText(importValue(row,['nickname']))]).filter(entry=>entry[0]));
  const grouped=new Map();
  labelRows.forEach(row=>{const id=importText(importValue(row,['batchId','Batch ID','ID']));if(!id)return;if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(row)});
  const batches=[];
  grouped.forEach((rows,id)=>{
    rows.sort((a,b)=>Number(importValue(a,['labelNo','Label no.','Label number'])||0)-Number(importValue(b,['labelNo','Label no.','Label number'])||0));
    const meta=generation.get(id)||{},first=rows[0]||{};
    const user=importText(importValue(meta,['user','name'])||importValue(first,['user','name']))||'Unknown user';
    const nickname=importText(importValue(meta,['nickname'])||nicknames.get(user))||user.split(/\s+/)[0]||'User';
    const labels=usableLabels(rows.map(row=>({
      prefix:importText(importValue(row,['prefix'])).toUpperCase(),
      company:importText(importValue(row,['companyName','penerima','company','full recipient'])),
      invoice:importText(importValue(row,['invoice','invoice number','invoice no','invoiceNo'])),
      courier:importText(importValue(row,['courier','expedition','shipping courier']))||'JNE',
      awb:importText(importValue(row,['awb','resi','awb / resi','tracking number'])),
      attn:importText(importValue(row,['attn','attention'])),
      phone:importText(importValue(row,['phone','telephone'])),
      address:importText(importValue(row,['address'])),
      sender:importText(importValue(row,['sender']))||'KSB INDONESIA'
    })));
    if(!labels.length)return;
    batches.push({
      id,
      timestamp:importTimestamp(id,importRowTimestamp(meta)||importRowTimestamp(first)),
      user,
      nickname,
      layout:importLayout(importValue(meta,['layout'])||importValue(first,['layout']),labels.length),
      labels,
      source:'Imported Excel history',
      syncState:'pending'
    });
  });
  return batches.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
}
function addImportedUsers(book,batches){
  const candidates=new Map();
  workbookRowsAny(book,['Users','User Summary']).forEach(row=>{const name=importText(importValue(row,['name','user'])),nickname=importText(importValue(row,['nickname']))||name.split(/\s+/)[0];if(name)candidates.set(name.toLowerCase(),{name,nickname})});
  batches.forEach(batch=>{if(batch.user)candidates.set(batch.user.toLowerCase(),{name:batch.user,nickname:batch.nickname||batch.user.split(/\s+/)[0]})});
  let added=0;
  candidates.forEach(candidate=>{if(users.some(user=>clean(user.name).toLowerCase()===candidate.name.toLowerCase()))return;users.push(candidate);added++});
  if(added){save('ksb-users',users);renderUsers()}
  return added;
}
function readFileBuffer(file){
  if(typeof file?.arrayBuffer==='function')return file.arrayBuffer();
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('File could not be read'));reader.readAsArrayBuffer(file)});
}
async function importHistoryWorkbook(file){
  const button=$('importHistory');
  if(!file)return;
  if(button){button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Reading workbook…'}
  try{
    await ensureXlsxLibrary();
    const buffer=await readFileBuffer(file),book=window.XLSX.read(buffer,{type:'array',cellDates:true});
    const incoming=buildImportedHistory(book),existing=new Set(history.map(batch=>batch.id)),added=incoming.filter(batch=>!existing.has(batch.id));
    addImportedUsers(book,incoming);
    if(!added.length){toast('No new history batches found in this workbook');return}
    history=[...added,...history].filter(batch=>batch?.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,1000);
    save('ksb-history',history);rebuildCompanyPrefixes();refreshDataSurfaces();
    const labelCount=added.reduce((sum,batch)=>sum+(batch.labels?.length||0),0);toast(`Imported ${added.length} batches · ${labelCount} labels`);
    if(connected){
      for(let index=0;index<added.length;index++){if(button)button.textContent=`Syncing ${index+1}/${added.length}…`;await syncBatch(added[index],false)}
      const synced=added.filter(batch=>batch.syncState==='synced').length,pending=added.filter(batch=>batch.syncState==='pending').length,failed=added.filter(batch=>batch.syncState==='failed').length,parts=[`${synced} synced`];
      if(pending)parts.push(`${pending} pending`);if(failed)parts.push(`${failed} failed`);toast(`Imported ${added.length} batches · ${parts.join(' · ')}`);
    }else toast(`Imported ${added.length} batches locally · sync will resume when connected`);
  }catch(error){console.error('History import failed:',error);toast(`History import failed: ${error?.message||error}`)}finally{
    if(button){button.disabled=false;button.textContent=button.dataset.originalText||'Import history';delete button.dataset.originalText}
    const input=$('historyFile');if(input)input.value='';
  }
}
const importHistoryButton=$('importHistory'),historyFile=$('historyFile');
if(importHistoryButton&&historyFile){
  importHistoryButton.onclick=()=>historyFile.click();historyFile.onchange=()=>importHistoryWorkbook(historyFile.files?.[0]);
  if(!window.LabelPrintPerformance?.lowSpec){
    const warm=()=>ensureXlsxLibrary().catch(()=>{});importHistoryButton.addEventListener('pointerenter',warm,{once:true,passive:true});importHistoryButton.addEventListener('focus',warm,{once:true,passive:true});
  }
}

;
/* Source: app-sync-awb-recovery.js */
(()=>{
  const HISTORY_LIMIT=2000;
  const SYNC_RECHECK_DELAY=650;
  let activeSyncPromise=null;

  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
  function normalizedBatch(raw,state){
    const batch=raw&&typeof raw==='object'?raw:{};
    const id=clean(batch.id);
    const enrich=window.LabelPrintInvoiceMemory?.enrichRow;
    const rows=usableLabels(batch.labels||[]).map(row=>enrich?enrich(row):normalizeLabel(row));
    if(!id||!rows.length)return null;
    return{
      ...batch,
      id,
      timestamp:batch.timestamp||new Date().toISOString(),
      user:clean(batch.user)||'Local User',
      nickname:clean(batch.nickname)||clean(batch.user).split(/\s+/)[0]||'User',
      layout:LAYOUTS[batch.layout]?batch.layout:'3x2',
      labels:rows,
      syncState:state||historySyncState(batch.syncState)
    };
  }
  function batchSignature(raw){
    const batch=normalizedBatch(raw,'pending');
    if(!batch)return'';
    return JSON.stringify({
      id:batch.id,
      layout:batch.layout,
      labels:batch.labels.map(row=>{const r=normalizeLabel(row);return[r.prefix,r.company,r.invoice,r.attn,r.phone,r.address,r.sender,r.courier,r.awb]})
    });
  }
  function remoteBatches(response){
    return(Array.isArray(response?.history)?response.history:[]).map(batch=>normalizedBatch(batch,'synced')).filter(Boolean);
  }
  function persistHistory(next){
    const deleted=deletedBatchIds();
    history=next.filter(batch=>batch?.id&&!deleted.has(batch.id)).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,1000);
    save('ksb-history',history);
    rebuildCompanyPrefixes();
    refreshDataSurfaces();
    return history;
  }
  function reconcileHistory(response,localSource=history){
    const deleted=deletedBatchIds();
    const remote=remoteBatches(response).filter(batch=>!deleted.has(batch.id));
    const remoteMap=new Map(remote.map(batch=>[batch.id,batch]));
    const merged=new Map(remote.map(batch=>[batch.id,batch]));

    (Array.isArray(localSource)?localSource:[]).forEach(raw=>{
      const local=normalizedBatch(raw);
      if(!local||deleted.has(local.id))return;
      const matchingRemote=remoteMap.get(local.id);
      if(matchingRemote&&batchSignature(local)===batchSignature(matchingRemote)){
        merged.set(local.id,{...local,syncState:'synced'});
      }else{
        merged.set(local.id,{...local,syncState:'pending'});
      }
    });

    persistHistory([...merged.values()]);
    return{remoteMap,pending:history.filter(batch=>batch.syncState!=='synced')};
  }

  applyRemoteHistory=function(response){
    if(!Array.isArray(response?.history))return false;
    reconcileHistory(response,history);
    return true;
  };

  syncBatch=async function(batch,announce=true,options={}){
    const refresh=options.refresh!==false;
    const target=normalizedBatch(batch);
    if(!target)return false;
    const index=history.findIndex(item=>clean(item?.id)===target.id);
    const stored=index>=0?history[index]:target;
    if(!connected){
      stored.syncState='pending';
      if(index<0)history.unshift(stored);
      save('ksb-history',history);
      if(refresh)refreshDataSurfaces();
      if(announce)toast('Saved locally · sync pending');
      return false;
    }
    try{
      stored.labels=target.labels;
      stored.syncState='pending';
      stored.labels.forEach(row=>rememberCompanyDefaults(row,false));
      persistCompanyMemory();
      window.LabelPrintInvoiceMemory?.rememberRows?.(stored.labels,{backfill:false,queueSync:false});
      const result=await post('saveBatch',stored);
      stored.syncState=result?.queued?'pending':'synced';
      save('ksb-history',history);
      if(refresh)refreshDataSurfaces();
      if(announce)toast(result?.queued?'Saved locally · verifying Google Sheets':'Saved to Google Sheets');
      return !result?.queued;
    }catch(error){
      stored.syncState='failed';
      save('ksb-history',history);
      if(refresh)refreshDataSurfaces();
      if(announce)toast(`Saved locally; sync failed: ${error?.message||error}`);
      return false;
    }
  };

  sync=async function(force=false){
    if(activeSyncPromise&&!force)return activeSyncPromise;
    if(activeSyncPromise&&force){try{await activeSyncPromise}catch{}}
    activeSyncPromise=(async()=>{
      syncInFlight=true;
      setStatus('syncing','Checking all label batches…');
      const localSnapshot=(Array.isArray(history)?history:[]).map(batch=>clone(batch));
      try{
        const ping=await apiGet('ping');
        if(!ping?.success)throw new Error('Invalid LabelPrint API response');
        connected=true;

        const [usersResult,historyResponse]=await Promise.all([
          fetchUsersFast(true).catch(error=>({ok:false,error})),
          apiGet('getHistory',{limit:HISTORY_LIMIT})
        ]);
        if(usersResult?.error)console.warn('User sync failed:',usersResult.error);

        await flushDeletedBatches();
        let reconciliation=reconcileHistory(historyResponse,localSnapshot);
        const queue=reconciliation.pending.slice();
        let uploaded=0;
        for(const batch of queue){
          if(await syncBatch(batch,false,{refresh:false}))uploaded++;
        }

        if(queue.length){
          await delay(SYNC_RECHECK_DELAY);
          const verified=await apiGet('getHistory',{limit:HISTORY_LIMIT});
          reconciliation=reconcileHistory(verified,history);
        }

        const pending=history.filter(batch=>batch.syncState!=='synced').length;
        const synced=history.length-pending;
        if(pending){
          setStatus('connected',`Sheets connected · ${synced} synced · ${pending} pending`);
          window.__lastSheetsError=`${pending} batch${pending===1?'':'es'} awaiting backend confirmation`;
        }else{
          setStatus('connected',`Sheets connected · all ${synced} batches synced`);
          window.__lastSheetsError='';
        }
        if(force)toast(pending?`${synced} batches synced · ${pending} still pending`:`All ${synced} label batches synced`);
        return{success:pending===0,synced,pending,uploaded};
      }catch(error){
        connected=false;
        window.__lastSheetsError=String(error?.message||error);
        setStatus('error','Sheets sync failed · tap for details');
        console.warn('Google Sheets history sync failed:',error);
        if(force)toast(`Sync failed: ${window.__lastSheetsError}`);
        return{success:false,error};
      }finally{
        syncInFlight=false;
        activeSyncPromise=null;
      }
    })();
    return activeSyncPromise;
  };

  function parseClipboardTable(text){
    const rows=[];
    let row=[],cell='',quoted=false;
    const source=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    for(let i=0;i<source.length;i++){
      const char=source[i];
      if(char==='"'){
        if(quoted&&source[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
      }else if(char==='\t'&&!quoted){row.push(cell);cell=''}
      else if(char==='\n'&&!quoted){row.push(cell);if(row.some(value=>clean(value)))rows.push(row);row=[];cell=''}
      else cell+=char;
    }
    row.push(cell);
    if(row.some(value=>clean(value)))rows.push(row);
    return rows;
  }
  function isHeaderRow(columns){
    const values=columns.map(value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim());
    const expected=[
      new Set(['date','tanggal','timestamp']),
      new Set(['penerima','recipient','recipient name','company','company name']),
      new Set(['invoice','invoice number','invoice no']),
      new Set(['courier','kurir','expedition']),
      new Set(['awb','resi','awb resi','awb number','tracking','tracking number']),
      new Set(['address','alamat','address phone number']),
      new Set(['attn','attention','contact'])
    ];
    const matches=values.map((value,index)=>expected[index]?.has(value)||false);
    const matchCount=matches.filter(Boolean).length;
    return matchCount>=2&&(matches[1]||matches[4]);
  }
  function rowFromColumns(columns){
    const raw=clean(columns[1]);
    const companyMatch=raw.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i);
    const addressAndPhone=clean(columns[5]);
    const phoneMatch=addressAndPhone.match(/\(([^()]*)\)\s*$/);
    return normalizeLabel({
      prefix:companyMatch?companyMatch[1].toUpperCase():'',
      company:companyMatch?companyMatch[2]:raw,
      invoice:clean(columns[2]),
      courier:clean(columns[3])||'JNE',
      awb:clean(columns[4]),
      address:phoneMatch?addressAndPhone.slice(0,phoneMatch.index).trim():addressAndPhone,
      phone:phoneMatch?clean(phoneMatch[1]):'',
      attn:clean(columns[6]),
      sender:''
    });
  }
  function forceSelectedAwbIntoForm(){
    const row=normalizeLabel(labels[selected]||{});
    const awbField=$('awb'),courierField=$('courier');
    if(awbField)awbField.value=row.awb||'';
    if(courierField)courierField.value=row.courier==='JNE'?'JNE':'OTHER';
    window.LabelPrintAwb?.sync?.(row);
  }
  function importRowsWithAwb(){
    const paste=$('paste');
    if(!paste)return;
    const parsed=parseClipboardTable(paste.value).filter(columns=>!isHeaderRow(columns)).map(rowFromColumns).map(row=>applyRememberedCompanyDefaults(row,false)).filter(row=>row.company&&!/^(penerima|recipient|company)$/i.test(row.company));
    if(!parsed.length)return toast('No valid rows detected. Paste columns A–G from Excel.');
    const seen=new Set();
    const unique=parsed.filter(row=>{const key=bulkDuplicateKey(row);if(seen.has(key))return false;seen.add(key);return true});
    const rows=unique.slice(0,MAX_LABELS);
    rows.forEach(row=>rememberCompanyDefaults(row,false));
    persistCompanyMemory();
    window.LabelPrintInvoiceMemory?.rememberRows?.(rows,{backfill:false,queueSync:false});
    labels=rows;
    selected=0;
    historySelected=null;
    save('ksb-labels',labels);
    closeModals();
    renderAll();
    forceSelectedAwbIntoForm();
    requestAnimationFrame(()=>{forceSelectedAwbIntoForm();requestAnimationFrame(forceSelectedAwbIntoForm)});
    const tracked=rows.filter(row=>row.awb).length;
    const invoices=rows.filter(row=>row.invoice).length;
    const missingAwb=rows.length-tracked;
    let message=`${rows.length} labels imported · ${tracked} AWB${tracked===1?'':'s'}`;
    if(invoices)message+=` · ${invoices} invoice${invoices===1?'':'s'}`;
    if(missingAwb)message+=` · ${missingAwb} missing column E`;
    if(unique.length>MAX_LABELS)message+=` · first ${MAX_LABELS} used`;
    toast(message);
  }

  const baseRenderForm=renderForm;
  renderForm=function(){const result=baseRenderForm();forceSelectedAwbIntoForm();return result};
  const importButton=$('importRows');
  if(importButton)importButton.onclick=importRowsWithAwb;

  const saveButton=$('saveConnection');
  if(saveButton){
    saveButton.disabled=false;
    saveButton.textContent='Sync all history';
    saveButton.title='Reconcile every local label batch with Google Sheets';
    saveButton.onclick=async()=>{saveButton.disabled=true;try{await sync(true)}finally{saveButton.disabled=false}};
  }

  window.LabelPrintSync={run:sync,reconcile:reconcileHistory,signature:batchSignature};
  window.LabelPrintBulkInput={parse:parseClipboardTable,import:importRowsWithAwb};
})();

;
/* Source: app-sync-fast.js */
(()=>{
  const NORMAL_HISTORY_LIMIT=1000;
  const FULL_HISTORY_LIMIT=2000;
  const RECENT_SYNC_TTL=15000;
  const VERIFY_DELAY=320;
  const LAST_FULL_SYNC_KEY='ksb-sync-last-full-v2';
  const CONCURRENCY=window.LabelPrintPerformance?.lowSpec?2:3;
  let activePromise=null;

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const batchId=batch=>clean(batch?.id);
  const stateOf=batch=>historySyncState(batch?.syncState);
  const unsynced=source=>(Array.isArray(source)?source:[]).filter(batch=>batchId(batch)&&stateOf(batch)!=='synced');

  function lastFullSync(){
    try{return Number(localStorage.getItem(LAST_FULL_SYNC_KEY)||0)||0}catch{return 0}
  }
  function rememberFullSync(){
    try{localStorage.setItem(LAST_FULL_SYNC_KEY,String(Date.now()))}catch{}
  }
  function uniqueBatches(rows){
    const map=new Map();
    (Array.isArray(rows)?rows:[]).forEach(batch=>{const id=batchId(batch);if(id)map.set(id,batch)});
    return[...map.values()];
  }
  function remoteLimit(force){
    if(force||!lastFullSync()||!(Array.isArray(history)&&history.length))return FULL_HISTORY_LIMIT;
    return Math.min(NORMAL_HISTORY_LIMIT,Math.max(250,history.length+100));
  }
  async function fetchRemoteHistory(force){
    return apiGet('getHistory',{limit:remoteLimit(force)});
  }

  async function runPool(items,worker){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return[];
    const results=new Array(rows.length);
    let cursor=0,completed=0;
    async function runner(){
      while(true){
        const index=cursor++;
        if(index>=rows.length)return;
        try{results[index]=await worker(rows[index],index)}catch(error){results[index]={ok:false,error}}
        completed++;
        if(rows.length>1)setStatus('syncing',`Syncing ${completed}/${rows.length} label batches…`);
      }
    }
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,rows.length)},runner));
    return results;
  }

  async function uploadQueue(queue){
    const summary={confirmed:0,queued:0,failed:0};
    const rows=uniqueBatches(queue);
    await runPool(rows,async batch=>{
      const ok=await syncBatch(batch,false,{refresh:false});
      const stored=history.find(item=>batchId(item)===batchId(batch));
      if(ok)summary.confirmed++;
      else if(stored?.syncState==='failed')summary.failed++;
      else summary.queued++;
      return{ok,id:batchId(batch)};
    });
    return summary;
  }

  function addSummary(target,source){
    target.confirmed+=source.confirmed||0;
    target.queued+=source.queued||0;
    target.failed+=source.failed||0;
    return target;
  }

  async function optimizedSync(force=false){
    if(activePromise&&!force)return activePromise;
    if(activePromise&&force){try{await activePromise}catch{}}

    activePromise=(async()=>{
      syncInFlight=true;
      const startingHistory=(Array.isArray(history)?history:[]).map(batch=>clone(batch));
      const startingQueue=uniqueBatches(unsynced(startingHistory));
      const deletedCount=deletedBatchIds().size;
      const recentNoWork=!force&&!startingQueue.length&&!deletedCount&&(Date.now()-lastFullSync()<RECENT_SYNC_TTL);
      const totals={confirmed:0,queued:0,failed:0};
      setStatus('syncing',force?'Reconciling all label batches…':'Connecting to Google Sheets…');

      const pingPromise=apiGet('ping');
      const usersPromise=fetchUsersFast(force).catch(error=>({ok:false,error}));
      const earlyHistoryPromise=!recentNoWork&&!startingQueue.length
        ?fetchRemoteHistory(force).then(response=>({response}),error=>({error}))
        :null;

      try{
        const ping=await pingPromise;
        if(!ping?.success)throw new Error('Invalid LabelPrint API response');
        connected=true;
        setStatus('connected',`Sheets connected${ping.spreadsheetName?` · ${ping.spreadsheetName}`:''}`);

        if(deletedCount)await flushDeletedBatches();

        if(startingQueue.length){
          setStatus('syncing',`Uploading ${startingQueue.length} pending batch${startingQueue.length===1?'':'es'}…`);
          addSummary(totals,await uploadQueue(startingQueue));
        }

        if(!recentNoWork){
          if(totals.queued)await wait(VERIFY_DELAY);
          setStatus('syncing','Refreshing batch history…');
          let response;
          if(earlyHistoryPromise){
            const early=await earlyHistoryPromise;
            if(early.error)throw early.error;
            response=early.response;
          }else response=await fetchRemoteHistory(force);
          window.LabelPrintSync?.reconcile?.(response,history);
          rememberFullSync();
        }

        const attempted=new Set(startingQueue.map(batchId));
        const discoveredQueue=uniqueBatches(unsynced(history).filter(batch=>!attempted.has(batchId(batch))));
        if(discoveredQueue.length){
          setStatus('syncing',`Uploading ${discoveredQueue.length} changed batch${discoveredQueue.length===1?'':'es'}…`);
          addSummary(totals,await uploadQueue(discoveredQueue));
        }

        if(totals.queued&&unsynced(history).length){
          await wait(VERIFY_DELAY);
          setStatus('syncing','Confirming Google Sheets updates…');
          const verification=await fetchRemoteHistory(force);
          window.LabelPrintSync?.reconcile?.(verification,history);
          rememberFullSync();
        }

        usersPromise.then(result=>{if(result?.error)console.warn('User refresh failed:',result.error)});
        const pending=unsynced(history).length;
        const synced=Math.max(0,history.length-pending);
        refreshDataSurfaces();

        if(pending){
          setStatus('connected',`Sheets connected · ${synced} synced · ${pending} pending`);
          window.__lastSheetsError=`${pending} batch${pending===1?'':'es'} awaiting synchronization`;
        }else{
          setStatus('connected',`Sheets connected · all ${synced} batches synced`);
          window.__lastSheetsError='';
        }
        if(force)toast(pending?`${synced} batches synced · ${pending} pending`:`All ${synced} label batches synced`);
        return{success:pending===0,synced,pending,...totals,fastPath:recentNoWork};
      }catch(error){
        connected=false;
        window.__lastSheetsError=String(error?.message||error);
        setStatus('error','Sheets sync failed · tap for details');
        console.warn('Fast Google Sheets sync failed:',error);
        if(force)toast(`Sync failed: ${window.__lastSheetsError}`);
        return{success:false,error};
      }finally{
        syncInFlight=false;
        activePromise=null;
      }
    })();

    return activePromise;
  }

  sync=optimizedSync;
  if(window.LabelPrintSync)window.LabelPrintSync.run=optimizedSync;

  const syncButton=$('saveConnection');
  if(syncButton){
    syncButton.disabled=false;
    syncButton.textContent='Sync all history';
    syncButton.onclick=async()=>{
      if(syncButton.disabled)return;
      const original=syncButton.textContent;
      syncButton.disabled=true;
      syncButton.textContent='Syncing…';
      try{await optimizedSync(true)}finally{syncButton.disabled=false;syncButton.textContent=original}
    };
  }

  window.LabelPrintFastSync={run:optimizedSync,upload:uploadQueue,historyLimit:remoteLimit};
})();

const CONFIG={endpoint:'https://script.google.com/macros/s/AKfycbwVOHKp4BIbj0rbMNV-y543i7L-175E8CbjFlz2f5kA6RYqpt9aj2crriQ-unsW9RO9/exec',logo:'https://file.garden/ad-wGPVIV3ilAD_L/WORK%20PROJECT/LABEL%20MAKER/KSB_SVG.svg.png'};
const APP_REVISION='2026-07-10-company-prefix-sender-memory';
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
function blankLabel(){return{prefix:'',company:'',attn:'',phone:'',address:'',sender:'KSB INDONESIA'}}
function normalizeLabel(r={}){let prefix=clean(r.prefix).toUpperCase(),company=clean(r.company);const combined=company.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i);if(combined){if(!prefix)prefix=combined[1].toUpperCase();company=clean(combined[2])}return{prefix,company,attn:clean(r.attn),phone:clean(r.phone),address:clean(r.address),sender:clean(r.sender)||'KSB INDONESIA'}}
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

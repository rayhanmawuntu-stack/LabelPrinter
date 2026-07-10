const CONFIG={endpoint:'https://script.google.com/macros/s/AKfycbwVOHKp4BIbj0rbMNV-y543i7L-175E8CbjFlz2f5kA6RYqpt9aj2crriQ-unsW9RO9/exec',logo:'https://file.garden/ad-wGPVIV3ilAD_L/WORK%20PROJECT/LABEL%20MAKER/KSB_SVG.svg.png'};
const APP_REVISION='2026-07-10-2x3-layout-fix';
const ENDPOINT_REVISION='2026-07-08-03';
const LEGACY_ENDPOINTS=['https://script.google.com/macros/s/AKfycbwohEPF9QkHyX7FO2VpnFtzHwbx3kZawul3uZXHNtqk4QbHlMYQkp_J78pV46DjOzFd/exec'];
const LEGACY_SAMPLE_COMPANIES=new Set(['MANDARA PERMAI','MULTI SARANA MARITIM','SAIPEM INDONESIA']);
const LAYOUTS={'3x3':{c:3,r:3,n:9,w:91,h:62,s:1,label:'3 × 3'},'3x2':{c:3,r:2,n:6,w:91,h:62,s:1,label:'3 × 2'},'2x3':{c:2,r:3,n:6,w:138.5,h:62,s:1,adaptive:true,label:'2 × 3'},'2x2':{c:2,r:2,n:4,w:138.5,h:95,s:138.5/91,label:'2 × 2'},'2x1':{c:2,r:1,n:2,w:138.5,h:95,s:138.5/91,label:'2 × 1'},'1x1':{c:1,r:1,n:1,w:281,h:194,s:281/91,label:'1 × 1'}};
const SAMPLE=[];
const domCache=new Map();
const $=id=>domCache.get(id)||(domCache.set(id,document.getElementById(id)),domCache.get(id));
const clean=v=>String(v??'').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
function load(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch{return f}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.warn('Local save failed:',e)}}
const saveTimers={};
function saveSoon(k,v,delay=180){clearTimeout(saveTimers[k]);saveTimers[k]=setTimeout(()=>save(k,v),delay)}
function debounce(fn,delay=120){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),delay)}}
function blankLabel(){return{prefix:'',company:'',attn:'',phone:'',address:'',sender:'KSB INDONESIA'}}
function normalizeLabel(r={}){return{prefix:clean(r.prefix),company:clean(r.company),attn:clean(r.attn),phone:clean(r.phone),address:clean(r.address),sender:clean(r.sender)||'KSB INDONESIA'}}
function isLegacySample(r){return LEGACY_SAMPLE_COMPANIES.has(clean(r?.company).toUpperCase())}
function hasLabelContent(r){return !![r?.company,r?.attn,r?.phone,r?.address].some(v=>clean(v))}
function usableLabels(rows=labels){return(Array.isArray(rows)?rows:[]).map(normalizeLabel).filter(r=>hasLabelContent(r)&&!isLegacySample(r))}
function startupLabels(){const rows=Array.isArray(load('ksb-labels',[]))?load('ksb-labels',[]):[];const filtered=rows.map(normalizeLabel).filter(r=>!isLegacySample(r));if(filtered.length!==rows.length)save('ksb-labels',filtered);return filtered}
function startupHistory(){const rows=Array.isArray(load('ksb-history',[]))?load('ksb-history',[]):[];const filtered=rows.map(b=>({...b,labels:usableLabels(b?.labels||[])})).filter(b=>b?.id&&b.labels.length).slice(0,1000);if(filtered.length!==rows.length)save('ksb-history',filtered);return filtered}
let users=load('ksb-users',[{name:'Rayhan Ardhana',nickname:'Rayhan'}]),currentUser=null,labels=startupLabels(),selected=0,layout=localStorage.getItem('ksb-layout')||'3x2',history=startupHistory(),active='create',connected=false,historySelected=null,cb=0,syncInFlight=false;
function initials(n){return clean(n||'U').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function full(r){return [r?.prefix,r?.company].filter(Boolean).join(' ').trim()}
function toast(m){const t=$('toast');if(!t)return;const msg=String(m||'');t.textContent=msg.length>140?msg.slice(0,137)+'…':msg;t.style.opacity=1;t.style.transform='translate(-50%,0)';clearTimeout(window.tt);window.tt=setTimeout(()=>{t.style.opacity=0;t.style.transform='translate(-50%,20px)'},2600)}
function endpoint(){const revision=localStorage.getItem('ksb-endpoint-revision');const saved=localStorage.getItem('ksb-endpoint');if(revision!==ENDPOINT_REVISION||!saved||LEGACY_ENDPOINTS.includes(saved)){localStorage.setItem('ksb-endpoint',CONFIG.endpoint);localStorage.setItem('ksb-endpoint-revision',ENDPOINT_REVISION);return CONFIG.endpoint}return saved}
function setStatus(state,text){connected=state==='connected';const s=$('status'),label=$('statusText'),statusText=String(text||'');if(s){s.dataset.state=state;s.title=statusText;s.setAttribute('aria-label',statusText)}if(label)label.textContent=statusText}
function buildApiUrl(action,params={}){const u=new URL(endpoint());u.searchParams.set('action',action);u.searchParams.set('_',Date.now());Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));return u}
function jsonp(action,params={}){return new Promise((resolve,reject)=>{const name='__ksb'+Date.now().toString(36)+(++cb),s=document.createElement('script'),timer=setTimeout(()=>done(new Error('Apps Script API timed out. Check web-app deployment access.')),15000);function done(e,v){clearTimeout(timer);s.remove();delete window[name];e?reject(e):resolve(v)}window[name]=v=>v?.success===false?done(new Error(v.message||'Backend error')):done(null,v);try{const u=buildApiUrl(action,params);u.searchParams.set('callback',name);s.src=u;s.onerror=()=>done(new Error('Apps Script endpoint could not be loaded. Check deployment access.'));document.head.appendChild(s)}catch(e){done(e)}})}
async function apiGet(action,params={}){try{const r=await fetch(buildApiUrl(action,params),{cache:'no-store',redirect:'follow'});const text=await r.text();if(/^\s*</.test(text))throw new Error('Apps Script returned HTML instead of JSON. Redeploy the API Code.gs as a web app.');const data=JSON.parse(text);if(data?.success===false)throw new Error(data.message||'Backend error');return data}catch(e){if(/returned HTML|Unknown GET action|Unexpected token/.test(String(e.message||e)))throw e;return jsonp(action,params)}}
async function post(action,payload){const b=new URLSearchParams({action,payload:JSON.stringify(payload)});try{const r=await fetch(endpoint(),{method:'POST',body:b});const t=await r.text();if(/^\s*</.test(t))throw new Error('Apps Script returned HTML for POST.');try{const data=JSON.parse(t);if(data?.success===false)throw new Error(data.message||'Backend error');return data}catch{return{success:true}}}catch{await fetch(endpoint(),{method:'POST',body:b,mode:'no-cors'});return{success:true,queued:true}}}

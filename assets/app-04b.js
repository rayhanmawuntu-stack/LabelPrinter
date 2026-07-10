function analyticsBuckets(data,days){
  const parsed=data.map(b=>({...b,_time:new Date(b.timestamp).getTime()})).filter(b=>Number.isFinite(b._time));
  const buckets=[];
  const today=new Date();today.setHours(0,0,0,0);
  if(days===0){
    for(let i=11;i>=0;i--){const start=new Date(today.getFullYear(),today.getMonth()-i,1),end=new Date(today.getFullYear(),today.getMonth()-i+1,1);buckets.push({label:start.toLocaleDateString('en-GB',{month:'short'}),value:parsed.filter(b=>b._time>=start.getTime()&&b._time<end.getTime()).reduce((s,b)=>s+(b.labels?.length||0),0)})}
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
  const labels=points.map((p,i)=>`<text class="line-label" x="${p.x}" y="${height-12}" text-anchor="middle">${esc(p.label)}</text><circle class="line-point" cx="${p.x}" cy="${p.y}" r="4"><title>${esc(p.label)}: ${p.value}</title></circle>`).join('');
  return `<div class="line-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Labels generated over time"><defs><linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dfff3f" stop-opacity=".65"/><stop offset="100%" stop-color="#dfff3f" stop-opacity="0"/></linearGradient></defs>${grids}<path class="line-area" d="${area}" fill="url(#${gradient})"/><path class="line-path" d="${path}"/>${labels}</svg></div>`;
}
function rankingHTML(entries,type='simple',limit=7){
  return entries.slice(0,limit).map((x,i)=>{const value=type==='users'?x[1].labels:x[1],sub=type==='users'?`${x[1].batches} batch${x[1].batches===1?'':'es'}`:'';return `<div class="rank ${type==='users'?'user-rank':''}"><em>${i+1}</em><b>${esc(x[0])}${sub?`<small>${sub}</small>`:''}</b><strong>${value}</strong></div>`}).join('');
}
function miniRankingHTML(entries,type='simple'){
  return entries.slice(0,3).map((x,i)=>{const value=type==='users'?x[1].labels:x[1];return `<div class="mini-rank"><em>${i+1}</em><b>${esc(x[0])}</b><strong>${value}</strong></div>`}).join('')||'<div class="empty-mini">No data yet.</div>';
}
function collectAnalytics(data){
  const companies={},users={};
  data.forEach(b=>{const count=(b.labels||[]).length,user=String(b.user||b.nickname||'Unknown user').trim()||'Unknown user';if(!users[user])users[user]={labels:0,batches:0};users[user].labels+=count;users[user].batches+=1;(b.labels||[]).forEach(r=>{const name=full(r);if(name)companies[name]=(companies[name]||0)+1})});
  return{companies,users,companyEntries:Object.entries(companies).sort((a,b)=>b[1]-a[1]),userEntries:Object.entries(users).sort((a,b)=>b[1].labels-a[1].labels||b[1].batches-a[1].batches)};
}
function renderDashboardAnalytics(){
  const root=$('dashboardAnalytics');if(!root)return;
  const cut=Date.now()-7*86400000,data=history.filter(b=>new Date(b.timestamp).getTime()>=cut),total=data.reduce((s,b)=>s+(b.labels?.length||0),0),sheets=data.reduce((s,b)=>s+Math.max(1,Math.ceil((b.labels?.length||0)/(LAYOUTS[b.layout]?.n||6))),0),collected=collectAnalytics(data);
  root.innerHTML=`<article class="dash-metric"><span>Labels printed</span><strong>${total}</strong><small>Last 7 days</small></article><article class="dash-metric"><span>Sheets printed</span><strong>${sheets}</strong><small>${data.length} generated batch${data.length===1?'':'es'}</small></article>`;
  $('dashboardLine').innerHTML=lineChartHTML(analyticsBuckets(data,7),'dashboard');
  $('dashboardTopUsers').innerHTML=miniRankingHTML(collected.userEntries,'users');
  $('dashboardTopRecipients').innerHTML=miniRankingHTML(collected.companyEntries);
}
function renderAnalytics(){
  const days=+$('range').value,cut=days?Date.now()-days*86400000:0,data=history.filter(b=>new Date(b.timestamp).getTime()>=cut),total=data.reduce((s,b)=>s+(b.labels?.length||0),0),avg=data.length?(total/data.length).toFixed(1):0,collected=collectAnalytics(data);
  $('analyticsKpis').innerHTML=[['Generated labels',total,'dark'],['Batches',data.length,'blue'],['Average / batch',avg,'lime'],['Unique recipients',Object.keys(collected.companies).length,'']].map(x=>`<article class="metric ${x[2]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>Selected period</small></article>`).join('');
  $('bars').innerHTML=lineChartHTML(analyticsBuckets(data,days),'analytics');
  $('ranking').innerHTML=rankingHTML(collected.companyEntries)||'<div class="empty">No recipient data yet.</div>';
  $('userRanking').innerHTML=rankingHTML(collected.userEntries,'users')||'<div class="empty">No user data yet.</div>';
  renderDashboardAnalytics();
}

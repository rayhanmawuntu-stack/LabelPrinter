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
  const groups=days===30?30:7,start=new Date(today);start.setDate(start.getDate()-(groups-1));
  for(let i=0;i<groups;i++){const from=new Date(start);from.setDate(from.getDate()+i);const to=new Date(from);to.setDate(to.getDate()+1);buckets.push({label:days===30?from.toLocaleDateString('en-GB',{day:'numeric',month:'short'}):from.toLocaleDateString('en-GB',{weekday:'short'}),value:parsed.filter(b=>b._time>=from.getTime()&&b._time<to.getTime()).reduce((s,b)=>s+(b.labels?.length||0),0)})}
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

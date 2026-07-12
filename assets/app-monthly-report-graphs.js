(()=>{
  const originalRender=window.renderMonthlyReport;
  if(typeof originalRender!=='function')return;

  function annualLeaders(year){
    const customers=new Map(),users=new Map();
    monthlyHistorySnapshot().forEach(batch=>{
      if(batch._date.getFullYear()!==year)return;
      const user=clean(batch.user||batch.nickname)||'Unknown user';
      users.set(user,(users.get(user)||0)+batch.labels.length);
      batch.labels.forEach(row=>{
        const customer=full(row);
        if(customer)customers.set(customer,(customers.get(customer)||0)+1);
      });
    });
    const sorted=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    return{customers:sorted(customers),users:sorted(users)};
  }

  function horizontalBars(entries,emptyText){
    if(!entries.length)return`<div class="monthly-visual-empty">${esc(emptyText)}</div>`;
    const top=entries.slice(0,6),max=Math.max(1,...top.map(([,value])=>value));
    return top.map(([name,value],index)=>`<div class="monthly-bar-row"><span class="monthly-bar-rank">${index+1}</span><div class="monthly-bar-main"><div class="monthly-bar-label"><b title="${esc(name)}">${esc(name)}</b><strong>${value.toLocaleString('en-GB')}</strong></div><div class="monthly-bar-track"><i style="width:${Math.max(4,(value/max)*100).toFixed(1)}%"></i></div></div></div>`).join('');
  }

  function renderMonthlyVisuals(){
    const trend=document.getElementById('monthlyTrendChart'),leaders=document.getElementById('monthlyTopCustomersChart'),usersRoot=document.getElementById('monthlyTopUsersChart');
    if(!trend||!leaders||!usersRoot)return;
    const year=Number(document.getElementById('monthlyYear')?.value)||ensureMonthlyYear(),report=monthlyReportData(year),leaderData=annualLeaders(year);
    const buckets=report.rows.map(row=>({label:new Date(year,row.month,1).toLocaleDateString('en-GB',{month:'short'}),value:row.labels}));
    trend.innerHTML=lineChartHTML(buckets,`monthly-report-${year}`);
    leaders.innerHTML=horizontalBars(leaderData.customers,'No recipient data for this year.');
    usersRoot.innerHTML=horizontalBars(leaderData.users,'No user data for this year.');
  }

  window.renderMonthlyReport=function(){
    originalRender();
    renderMonthlyVisuals();
  };
})();
(()=>{
  const button=document.getElementById('downloadMonthlyReport');
  if(!button)return;

  const monthNames=Array.from({length:12},(_,month)=>new Date(2000,month,1).toLocaleDateString('en-GB',{month:'long'}));
  const safeText=value=>{
    const text=clean(value);
    return /^[=+\-@]/.test(text)?`'${text}`:text;
  };
  const validDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?null:date};
  const displayDate=date=>date?date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'';
  const displayTime=date=>date?date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
  const increment=(map,key,amount=1)=>{const name=clean(key)||'Unknown';map.set(name,(map.get(name)||0)+amount)};
  const topEntry=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||['—',0];
  const ratio=(value,total)=>total?`${((value/total)*100).toFixed(1)}%`:'0.0%';
  const changeText=(current,previous)=>previous?`${(((current-previous)/previous)*100).toFixed(1)}%`:(current?'New':'0.0%');
  const syncState=value=>['synced','pending','failed'].includes(value)?value:'pending';
  const capacityFor=layoutKey=>LAYOUTS[layoutKey]?.n||6;
  const estimatedSheets=batch=>Math.max(1,Math.ceil((batch.labels?.length||0)/capacityFor(batch.layout)));

  function createWorksheet(rows,widths,{filter=true}={}){
    const sheet=window.XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols']=(widths||[]).map(width=>({wch:width}));
    if(filter&&rows.length>1&&rows[0]?.length){
      sheet['!autofilter']={ref:window.XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:rows[0].length-1}})};
      sheet['!freeze']={xSplit:0,ySplit:1};
    }
    return sheet;
  }

  function annualReportData(year){
    const selected=[];
    const previousLabels=Array(12).fill(0);
    const months=Array.from({length:12},(_,month)=>({month,labels:0,batches:0,sheets:0,recipients:new Set(),customers:new Map(),users:new Map(),senders:new Map(),layouts:new Map()}));
    const customers=new Map(),users=new Map(),senders=new Map(),layouts=new Map(),syncCounts=new Map();
    const batchIds=new Map();
    let invalidTimestamps=0;

    (Array.isArray(history)?history:[]).forEach(batch=>{
      const date=validDate(batch?.timestamp);
      if(!date){invalidTimestamps++;return}
      const rows=usableLabels(batch?.labels||[]);
      if(date.getFullYear()===year-1)previousLabels[date.getMonth()]+=rows.length;
      if(date.getFullYear()!==year)return;
      const normalizedBatch={...batch,_date:date,labels:rows};
      selected.push(normalizedBatch);
      batchIds.set(clean(batch.id),(batchIds.get(clean(batch.id))||0)+1);
      const month=months[date.getMonth()],user=clean(batch.user||batch.nickname)||'Unknown user',state=syncState(batch.syncState),sheetCount=estimatedSheets(normalizedBatch);
      month.labels+=rows.length;month.batches++;month.sheets+=sheetCount;
      increment(month.users,user,rows.length);increment(month.layouts,LAYOUTS[batch.layout]?.label||clean(batch.layout)||'Unknown',1);
      increment(syncCounts,state,1);

      let userRecord=users.get(user);
      if(!userRecord){userRecord={labels:0,batches:new Set(),customers:new Set(),months:new Map(),last:0};users.set(user,userRecord)}
      userRecord.labels+=rows.length;userRecord.batches.add(clean(batch.id));increment(userRecord.months,monthNames[date.getMonth()],rows.length);userRecord.last=Math.max(userRecord.last,date.getTime());

      const layoutName=LAYOUTS[batch.layout]?.label||clean(batch.layout)||'Unknown';
      let layoutRecord=layouts.get(layoutName);
      if(!layoutRecord){layoutRecord={key:clean(batch.layout),labels:0,batches:0,sheets:0};layouts.set(layoutName,layoutRecord)}
      layoutRecord.labels+=rows.length;layoutRecord.batches++;layoutRecord.sheets+=sheetCount;

      rows.forEach(row=>{
        const recipient=full(row)||clean(row.company)||'Unknown recipient',sender=clean(row.sender)||'KSB INDONESIA',prefix=clean(row.prefix),company=clean(row.company);
        month.recipients.add(recipient);increment(month.customers,recipient,1);increment(month.senders,sender,1);
        userRecord.customers.add(recipient);

        let customerRecord=customers.get(recipient);
        if(!customerRecord){customerRecord={prefix,company,labels:0,batches:new Set(),months:new Set(),last:0,senders:new Map(),users:new Map(),contacts:new Set(),addresses:new Set(),firstMonth:date.getMonth()};customers.set(recipient,customerRecord)}
        customerRecord.prefix=prefix||customerRecord.prefix;customerRecord.company=company||customerRecord.company;customerRecord.labels++;customerRecord.batches.add(clean(batch.id));customerRecord.months.add(date.getMonth());customerRecord.last=Math.max(customerRecord.last,date.getTime());customerRecord.firstMonth=Math.min(customerRecord.firstMonth,date.getMonth());increment(customerRecord.senders,sender,1);increment(customerRecord.users,user,1);if(clean(row.attn))customerRecord.contacts.add(clean(row.attn));if(clean(row.address))customerRecord.addresses.add(clean(row.address));

        let senderRecord=senders.get(sender);
        if(!senderRecord){senderRecord={labels:0,batches:new Set(),customers:new Map(),months:new Set(),last:0};senders.set(sender,senderRecord)}
        senderRecord.labels++;senderRecord.batches.add(clean(batch.id));increment(senderRecord.customers,recipient,1);senderRecord.months.add(date.getMonth());senderRecord.last=Math.max(senderRecord.last,date.getTime());
      });
    });

    selected.sort((a,b)=>b._date-a._date);
    const firstDate=selected.length?selected[selected.length-1]._date:null,lastDate=selected.length?selected[0]._date:null;
    const totals={
      labels:selected.reduce((sum,batch)=>sum+batch.labels.length,0),
      batches:selected.length,
      sheets:selected.reduce((sum,batch)=>sum+estimatedSheets(batch),0),
      recipients:customers.size,
      users:users.size,
      senders:senders.size,
      activeMonths:months.filter(month=>month.batches).length,
      synced:syncCounts.get('synced')||0,
      pending:syncCounts.get('pending')||0,
      failed:syncCounts.get('failed')||0,
      previousLabels:previousLabels.reduce((sum,value)=>sum+value,0),
      firstDate,lastDate
    };
    totals.average=totals.batches?totals.labels/totals.batches:0;
    totals.topCustomer=topEntry(new Map([...customers].map(([name,value])=>[name,value.labels])));
    totals.topUser=topEntry(new Map([...users].map(([name,value])=>[name,value.labels])));
    totals.topSender=topEntry(new Map([...senders].map(([name,value])=>[name,value.labels])));
    totals.topLayout=[...layouts.entries()].sort((a,b)=>b[1].batches-a[1].batches||b[1].labels-a[1].labels)[0]||['—',{batches:0,labels:0}];
    const duplicateBatchIds=[...batchIds.entries()].filter(([,count])=>count>1);
    return{selected,previousLabels,months,customers,users,senders,layouts,totals,invalidTimestamps,duplicateBatchIds};
  }

  function buildWorkbook(year){
    const report=annualReportData(year),XLSX=window.XLSX,book=XLSX.utils.book_new(),generated=new Date();
    book.Props={Title:`KSB LabelPrint Monthly Report ${year}`,Subject:'Extended annual and monthly label activity report',Author:currentUser?.name||'KSB LabelPrint',CreatedDate:generated};

    const summary=[
      ['KSB LABELPRINT — EXTENSIVE MONTHLY REPORT',''],
      ['Report year',year],
      ['Generated at',`${displayDate(generated)} ${displayTime(generated)}`],
      ['Generated by',safeText(currentUser?.name||'Local user')],
      ['Data source','Google Sheets synchronized history + local cache'],
      ['',''],
      ['PERFORMANCE SUMMARY',''],
      ['Total labels',report.totals.labels],
      ['Total batches',report.totals.batches],
      ['Estimated A4 sheets',report.totals.sheets],
      ['Average labels per batch',Number(report.totals.average.toFixed(2))],
      ['Unique recipients',report.totals.recipients],
      ['Active users',report.totals.users],
      ['Active senders',report.totals.senders],
      ['Active months',report.totals.activeMonths],
      ['Previous-year labels',report.totals.previousLabels],
      ['Year-on-year label change',changeText(report.totals.labels,report.totals.previousLabels)],
      ['Earliest batch',displayDate(report.totals.firstDate)],
      ['Latest batch',displayDate(report.totals.lastDate)],
      ['',''],
      ['LEADERS',''],
      ['Top customer',safeText(report.totals.topCustomer[0])],
      ['Top customer labels',report.totals.topCustomer[1]],
      ['Top user',safeText(report.totals.topUser[0])],
      ['Top user labels',report.totals.topUser[1]],
      ['Top sender',safeText(report.totals.topSender[0])],
      ['Top sender labels',report.totals.topSender[1]],
      ['Most-used layout',safeText(report.totals.topLayout[0])],
      ['Layout batches',report.totals.topLayout[1].batches||0],
      ['',''],
      ['SYNC STATUS',''],
      ['Synced batches',report.totals.synced],
      ['Pending batches',report.totals.pending],
      ['Failed batches',report.totals.failed]
    ];
    XLSX.utils.book_append_sheet(book,createWorksheet(summary,[31,42],{filter:false}),'Executive Summary');

    let cumulativeLabels=0,cumulativeBatches=0;
    const monthlyRows=[['Month','Labels','Previous-year labels','YoY change','Batches','Estimated A4 sheets','Average labels / batch','Unique recipients','New recipients','Active users','Top customer','Customer labels','Top user','User labels','Top sender','Sender labels','Top layout','Layout batches','Cumulative labels','Cumulative batches']];
    report.months.forEach(month=>{
      cumulativeLabels+=month.labels;cumulativeBatches+=month.batches;
      const topCustomer=topEntry(month.customers),topUser=topEntry(month.users),topSender=topEntry(month.senders),topLayout=topEntry(month.layouts),newRecipients=[...report.customers.values()].filter(customer=>customer.firstMonth===month.month).length;
      monthlyRows.push([monthNames[month.month],month.labels,report.previousLabels[month.month],changeText(month.labels,report.previousLabels[month.month]),month.batches,month.sheets,month.batches?Number((month.labels/month.batches).toFixed(2)):0,month.recipients.size,newRecipients,month.users.size,safeText(topCustomer[0]),topCustomer[1],safeText(topUser[0]),topUser[1],safeText(topSender[0]),topSender[1],safeText(topLayout[0]),topLayout[1],cumulativeLabels,cumulativeBatches]);
    });
    XLSX.utils.book_append_sheet(book,createWorksheet(monthlyRows,[14,10,18,12,10,19,20,18,16,13,30,15,24,12,28,13,15,14,17,18]),'Monthly Summary');

    const batchRows=[['Date','Time','Batch ID','User','Nickname','Layout','Label count','Estimated A4 sheets','Unique recipients','Sender(s)','Sync status','Source']];
    report.selected.forEach(batch=>{
      const recipients=new Set(batch.labels.map(row=>full(row)).filter(Boolean)),senderList=[...new Set(batch.labels.map(row=>clean(row.sender)||'KSB INDONESIA'))].join(' · ');
      batchRows.push([displayDate(batch._date),displayTime(batch._date),safeText(batch.id),safeText(batch.user||'Unknown user'),safeText(batch.nickname||''),safeText(LAYOUTS[batch.layout]?.label||batch.layout||'Unknown'),batch.labels.length,estimatedSheets(batch),recipients.size,safeText(senderList),syncState(batch.syncState),safeText(batch.source||'Generated history')]);
    });
    XLSX.utils.book_append_sheet(book,createWorksheet(batchRows,[14,12,28,24,18,12,12,20,18,34,13,24]),'Batch Detail');

    const labelRows=[['Date','Time','Month','Batch ID','Label no.','Prefix','Company','Full recipient','Attn','Phone','Address','Sender','User','Nickname','Layout','Sync status','Source']];
    report.selected.forEach(batch=>batch.labels.forEach((row,index)=>labelRows.push([displayDate(batch._date),displayTime(batch._date),monthNames[batch._date.getMonth()],safeText(batch.id),index+1,safeText(row.prefix),safeText(row.company),safeText(full(row)),safeText(row.attn),safeText(row.phone),safeText(row.address),safeText(row.sender||'KSB INDONESIA'),safeText(batch.user||'Unknown user'),safeText(batch.nickname||''),safeText(LAYOUTS[batch.layout]?.label||batch.layout||'Unknown'),syncState(batch.syncState),safeText(batch.source||'Generated history')])));
    XLSX.utils.book_append_sheet(book,createWorksheet(labelRows,[14,12,14,28,10,10,30,34,28,18,48,28,24,18,12,13,24]),'Label Detail');

    const customerRows=[['Customer','Prefix','Company','Labels','Batches','Months active','Share of annual labels','Last printed','Top sender','Top user','Unique contacts','Unique addresses']];
    [...report.customers.entries()].sort((a,b)=>b[1].labels-a[1].labels||a[0].localeCompare(b[0])).forEach(([name,value])=>{const topSender=topEntry(value.senders),topUser=topEntry(value.users);customerRows.push([safeText(name),safeText(value.prefix),safeText(value.company),value.labels,value.batches.size,value.months.size,ratio(value.labels,report.totals.labels),displayDate(new Date(value.last)),safeText(topSender[0]),safeText(topUser[0]),value.contacts.size,value.addresses.size])});
    XLSX.utils.book_append_sheet(book,createWorksheet(customerRows,[34,10,30,10,10,14,21,15,28,24,16,17]),'Customer Summary');

    const userRows=[['User','Labels','Batches','Average labels / batch','Unique customers','Active months','Share of annual labels','Top customer','Most active month','Last activity']];
    [...report.users.entries()].sort((a,b)=>b[1].labels-a[1].labels||a[0].localeCompare(b[0])).forEach(([name,value])=>{const topCustomer=topEntry(new Map([...report.customers.entries()].filter(([,customer])=>customer.users.has(name)).map(([customerName,customer])=>[customerName,customer.users.get(name)]))),topMonth=topEntry(value.months);userRows.push([safeText(name),value.labels,value.batches.size,value.batches.size?Number((value.labels/value.batches.size).toFixed(2)):0,value.customers.size,value.months.size,ratio(value.labels,report.totals.labels),safeText(topCustomer[0]),safeText(topMonth[0]),displayDate(new Date(value.last))])});
    XLSX.utils.book_append_sheet(book,createWorksheet(userRows,[26,10,10,21,17,14,21,32,19,15]),'User Summary');

    const senderRows=[['Sender','Labels','Batches','Unique customers','Active months','Share of annual labels','Top customer','Last used']];
    [...report.senders.entries()].sort((a,b)=>b[1].labels-a[1].labels||a[0].localeCompare(b[0])).forEach(([name,value])=>{const topCustomer=topEntry(value.customers);senderRows.push([safeText(name),value.labels,value.batches.size,value.customers.size,value.months.size,ratio(value.labels,report.totals.labels),safeText(topCustomer[0]),displayDate(new Date(value.last))])});
    XLSX.utils.book_append_sheet(book,createWorksheet(senderRows,[30,10,10,18,14,21,34,15]),'Sender Summary');

    const layoutRows=[['Layout','Capacity per A4 sheet','Batches','Labels','Estimated A4 sheets','Average labels / batch','Average sheet utilization']];
    [...report.layouts.entries()].sort((a,b)=>b[1].batches-a[1].batches||a[0].localeCompare(b[0])).forEach(([name,value])=>{const capacity=capacityFor(value.key);layoutRows.push([safeText(name),capacity,value.batches,value.labels,value.sheets,value.batches?Number((value.labels/value.batches).toFixed(2)):0,ratio(value.labels,value.sheets*capacity)])});
    XLSX.utils.book_append_sheet(book,createWorksheet(layoutRows,[18,22,10,10,20,21,24]),'Layout Summary');

    const missing={company:0,attn:0,phone:0,address:0,sender:0};
    report.selected.forEach(batch=>batch.labels.forEach(row=>{if(!clean(row.company))missing.company++;if(!clean(row.attn))missing.attn++;if(!clean(row.phone))missing.phone++;if(!clean(row.address))missing.address++;if(!clean(row.sender))missing.sender++}));
    const qualityRows=[['Check','Count','Notes'],['Batches included',report.totals.batches,`Valid timestamps in ${year}`],['Labels included',report.totals.labels,`All usable labels in ${year}`],['Invalid timestamps in full history',report.invalidTimestamps,'Excluded because they cannot be assigned to a report year'],['Duplicate batch IDs',report.duplicateBatchIds.length,report.duplicateBatchIds.map(([id,count])=>`${id} (${count})`).join(' · ')],['Labels missing company',missing.company,'Review Label Detail'],['Labels missing attention',missing.attn,'May be acceptable when no contact is specified'],['Labels missing phone',missing.phone,'Review Label Detail'],['Labels missing address',missing.address,'Review Label Detail'],['Labels missing sender',missing.sender,'Default sender may have been applied during normalization'],['Pending sync batches',report.totals.pending,'Saved locally and awaiting backend confirmation'],['Failed sync batches',report.totals.failed,'Review the backend connection']];
    XLSX.utils.book_append_sheet(book,createWorksheet(qualityRows,[32,12,70]),'Data Quality');
    return book;
  }

  async function downloadMonthlyReport(){
    const year=Number(document.getElementById('monthlyYear')?.value)||ensureMonthlyYear();
    const original=button.textContent;
    button.disabled=true;button.textContent='Preparing report…';
    try{
      await ensureXlsxLibrary();
      const book=buildWorkbook(year),stamp=new Date().toISOString().slice(0,10).replace(/-/g,'');
      window.XLSX.writeFile(book,`KSB-LabelPrint-Monthly-Report-${year}-${stamp}.xlsx`,{bookType:'xlsx',compression:true});
      toast(`Detailed ${year} report downloaded`);
    }catch(error){
      console.error('Monthly report download failed:',error);
      toast(`Report download failed: ${error?.message||error}`);
    }finally{
      button.disabled=false;button.textContent=original;
    }
  }

  button.onclick=downloadMonthlyReport;
  const warm=()=>ensureXlsxLibrary().catch(()=>{});
  button.addEventListener('pointerenter',warm,{once:true,passive:true});
  button.addEventListener('focus',warm,{once:true,passive:true});
})();
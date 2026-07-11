(()=>{
  const button=document.getElementById('downloadMonthlyReport');
  if(!button)return;

  const REPORT_SHEETS=['Executive Summary','Monthly Summary','Batch Detail','Label Detail','Customer Summary','User Summary','Sender Summary','Layout Summary','Data Quality'];
  const monthNames=Array.from({length:12},(_,month)=>new Date(2000,month,1).toLocaleDateString('en-GB',{month:'long'}));
  const safeText=value=>{const text=clean(value);return /^[=+\-@]/.test(text)?`'${text}`:text};
  const validDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?null:date};
  const displayDate=date=>date&&Number.isFinite(date.getTime())?date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'';
  const displayTime=date=>date&&Number.isFinite(date.getTime())?date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
  const normalizedKey=value=>clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
  const increment=(map,key,amount=1)=>{if(!key)return;map.set(key,(map.get(key)||0)+amount)};
  const ratio=(value,total)=>total?`${((value/total)*100).toFixed(1)}%`:'0.0%';
  const changeText=(current,previous)=>previous?`${(((current-previous)/previous)*100).toFixed(1)}%`:(current?'New':'0.0%');
  const syncState=value=>['synced','pending','failed'].includes(value)?value:'pending';
  const capacityFor=layoutKey=>LAYOUTS[layoutKey]?.n||6;
  const estimatedSheets=batch=>{const count=batch.labels?.length||0;return count?Math.ceil(count/capacityFor(batch.layout)):0};
  const syncRank=value=>({synced:3,pending:2,failed:1}[syncState(value)]||0);
  const sum=(items,selector)=>items.reduce((total,item)=>total+selector(item),0);

  function topCounter(map,nameFor=key=>key){
    const winner=[...map.entries()].sort((a,b)=>b[1]-a[1]||String(nameFor(a[0])).localeCompare(String(nameFor(b[0]))))[0];
    return winner?[nameFor(winner[0])||'—',winner[1],winner[0]]:['—',0,''];
  }

  function userIdentity(batch){
    const name=clean(batch?.user||batch?.nickname)||'Unknown user';
    return{key:normalizedKey(name)||'UNKNOWN USER',name};
  }

  function senderIdentity(row){
    const name=clean(row?.sender)||'KSB INDONESIA';
    return{key:normalizedKey(name)||'KSB INDONESIA',name};
  }

  function customerIdentity(row){
    const company=clean(row?.company);
    if(!company)return null;
    const key=companyKey(company)||normalizedKey(company);
    if(!key)return null;
    return{key,name:full(row)||company,prefix:clean(row?.prefix),company};
  }

  function labelPairs(rows){
    return(Array.isArray(rows)?rows:[]).map(raw=>({raw:raw&&typeof raw==='object'?raw:{},label:normalizeLabel(raw||{})})).filter(pair=>hasLabelContent(pair.label)&&!isLegacySample(pair.label));
  }

  function preferBatch(current,candidate){
    if(!current)return candidate;
    if(candidate.labels.length!==current.labels.length)return candidate.labels.length>current.labels.length?candidate:current;
    const candidateSync=syncRank(candidate.syncState),currentSync=syncRank(current.syncState);
    if(candidateSync!==currentSync)return candidateSync>currentSync?candidate:current;
    return candidate._date.getTime()>=current._date.getTime()?candidate:current;
  }

  function normalizedHistory(){
    const byId=new Map(),counts=new Map();
    let invalidTimestamps=0,missingBatchIds=0,emptyBatches=0;
    (Array.isArray(history)?history:[]).forEach(batch=>{
      const date=validDate(batch?.timestamp);
      if(!date){invalidTimestamps++;return}
      const id=clean(batch?.id);
      if(!id){missingBatchIds++;return}
      const pairs=labelPairs(batch?.labels||[]);
      if(!pairs.length){emptyBatches++;return}
      const normalized={...batch,id,_date:date,_pairs:pairs,labels:pairs.map(pair=>pair.label)};
      counts.set(id,(counts.get(id)||0)+1);
      byId.set(id,preferBatch(byId.get(id),normalized));
    });
    const duplicateBatchIds=[...counts.entries()].filter(([,count])=>count>1).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    return{batches:[...byId.values()],invalidTimestamps,missingBatchIds,emptyBatches,duplicateBatchIds,duplicateRecords:duplicateBatchIds.reduce((total,[,count])=>total+count-1,0)};
  }

  function createWorksheet(rows,widths,{filter=true}={}){
    const safeRows=Array.isArray(rows)&&rows.length?rows:[[]];
    const sheet=window.XLSX.utils.aoa_to_sheet(safeRows);
    sheet['!cols']=(widths||[]).map(width=>({wch:width}));
    if(filter&&safeRows.length>1&&safeRows[0]?.length){
      sheet['!autofilter']={ref:window.XLSX.utils.encode_range({s:{r:0,c:0},e:{r:safeRows.length-1,c:safeRows[0].length-1}})};
    }
    return sheet;
  }

  function annualReportData(year){
    const source=normalizedHistory(),all=source.batches;
    const selected=all.filter(batch=>batch._date.getFullYear()===year).sort((a,b)=>b._date-a._date);
    const previousLabels=Array(12).fill(0);
    all.filter(batch=>batch._date.getFullYear()===year-1).forEach(batch=>{previousLabels[batch._date.getMonth()]+=batch.labels.length});

    const customerFirstSeen=new Map();
    all.forEach(batch=>batch.labels.forEach(row=>{
      const customer=customerIdentity(row);
      if(!customer)return;
      const current=customerFirstSeen.get(customer.key);
      if(!current||batch._date<current)customerFirstSeen.set(customer.key,batch._date);
    }));

    const months=Array.from({length:12},(_,month)=>({month,labels:0,batches:0,sheets:0,recipients:new Set(),customers:new Map(),users:new Map(),senders:new Map(),layouts:new Map()}));
    const customers=new Map(),users=new Map(),senders=new Map(),layouts=new Map(),syncCounts=new Map();

    selected.forEach(batch=>{
      const month=months[batch._date.getMonth()],user=userIdentity(batch),state=syncState(batch.syncState),sheetCount=estimatedSheets(batch);
      month.labels+=batch.labels.length;month.batches++;month.sheets+=sheetCount;
      increment(month.users,user.key,batch.labels.length);
      increment(month.layouts,LAYOUTS[batch.layout]?.label||clean(batch.layout)||'Unknown',1);
      increment(syncCounts,state,1);

      let userRecord=users.get(user.key);
      if(!userRecord){userRecord={name:user.name,labels:0,batches:new Set(),customers:new Set(),months:new Map(),last:0};users.set(user.key,userRecord)}
      userRecord.labels+=batch.labels.length;userRecord.batches.add(batch.id);increment(userRecord.months,monthNames[batch._date.getMonth()],batch.labels.length);userRecord.last=Math.max(userRecord.last,batch._date.getTime());

      const layoutName=LAYOUTS[batch.layout]?.label||clean(batch.layout)||'Unknown';
      let layoutRecord=layouts.get(layoutName);
      if(!layoutRecord){layoutRecord={key:clean(batch.layout),labels:0,batches:0,sheets:0};layouts.set(layoutName,layoutRecord)}
      layoutRecord.labels+=batch.labels.length;layoutRecord.batches++;layoutRecord.sheets+=sheetCount;

      batch.labels.forEach(row=>{
        const sender=senderIdentity(row),customer=customerIdentity(row);
        increment(month.senders,sender.key,1);

        let senderRecord=senders.get(sender.key);
        if(!senderRecord){senderRecord={name:sender.name,labels:0,batches:new Set(),customers:new Map(),months:new Set(),last:0};senders.set(sender.key,senderRecord)}
        senderRecord.labels++;senderRecord.batches.add(batch.id);senderRecord.months.add(batch._date.getMonth());senderRecord.last=Math.max(senderRecord.last,batch._date.getTime());

        if(!customer)return;
        month.recipients.add(customer.key);increment(month.customers,customer.key,1);userRecord.customers.add(customer.key);increment(senderRecord.customers,customer.key,1);

        let customerRecord=customers.get(customer.key);
        if(!customerRecord){customerRecord={name:customer.name,prefix:customer.prefix,company:customer.company,labels:0,batches:new Set(),months:new Set(),first:customerFirstSeen.get(customer.key)||batch._date,last:0,senders:new Map(),users:new Map(),contacts:new Set(),addresses:new Set()};customers.set(customer.key,customerRecord)}
        if(!customerRecord.prefix&&customer.prefix)customerRecord.prefix=customer.prefix;
        if(!customerRecord.company&&customer.company)customerRecord.company=customer.company;
        customerRecord.labels++;customerRecord.batches.add(batch.id);customerRecord.months.add(batch._date.getMonth());customerRecord.last=Math.max(customerRecord.last,batch._date.getTime());increment(customerRecord.senders,sender.key,1);increment(customerRecord.users,user.key,1);if(clean(row.attn))customerRecord.contacts.add(clean(row.attn));if(clean(row.address))customerRecord.addresses.add(clean(row.address));
      });
    });

    const firstDate=selected.length?selected[selected.length-1]._date:null,lastDate=selected.length?selected[0]._date:null;
    const totals={labels:sum(selected,batch=>batch.labels.length),batches:selected.length,sheets:sum(selected,estimatedSheets),recipients:customers.size,users:users.size,senders:senders.size,activeMonths:months.filter(month=>month.batches).length,synced:syncCounts.get('synced')||0,pending:syncCounts.get('pending')||0,failed:syncCounts.get('failed')||0,previousLabels:previousLabels.reduce((total,value)=>total+value,0),firstDate,lastDate};
    totals.average=totals.batches?totals.labels/totals.batches:0;
    totals.topCustomer=topCounter(new Map([...customers].map(([key,value])=>[key,value.labels])),key=>customers.get(key)?.name||key);
    totals.topUser=topCounter(new Map([...users].map(([key,value])=>[key,value.labels])),key=>users.get(key)?.name||key);
    totals.topSender=topCounter(new Map([...senders].map(([key,value])=>[key,value.labels])),key=>senders.get(key)?.name||key);
    totals.topLayout=[...layouts.entries()].sort((a,b)=>b[1].batches-a[1].batches||b[1].labels-a[1].labels)[0]||['—',{batches:0,labels:0}];
    const report={...source,selected,previousLabels,months,customers,users,senders,layouts,totals,customerFirstSeen};
    validateReport(report,year);
    return report;
  }

  function validateReport(report,year){
    if(!Number.isInteger(year)||year<1900||year>9999)throw new Error('Invalid report year');
    const monthlyLabels=sum(report.months,month=>month.labels),monthlyBatches=sum(report.months,month=>month.batches),selectedLabels=sum(report.selected,batch=>batch.labels.length);
    if(monthlyLabels!==report.totals.labels||selectedLabels!==report.totals.labels)throw new Error('Report label totals did not reconcile');
    if(monthlyBatches!==report.totals.batches||report.selected.length!==report.totals.batches)throw new Error('Report batch totals did not reconcile');
    if(report.months.length!==12)throw new Error('Monthly report must contain 12 months');
    if(report.totals.recipients!==report.customers.size)throw new Error('Recipient totals did not reconcile');
  }

  function buildWorkbook(year){
    const report=annualReportData(year),XLSX=window.XLSX,book=XLSX.utils.book_new(),generated=new Date();
    book.Props={Title:`KSB LabelPrint Monthly Report ${year}`,Subject:'Extended annual and monthly label activity report',Author:currentUser?.name||'KSB LabelPrint',CreatedDate:generated};

    const summary=[
      ['KSB LABELPRINT — EXTENSIVE MONTHLY REPORT',''],['Report year',year],['Generated at',`${displayDate(generated)} ${displayTime(generated)}`],['Generated by',safeText(currentUser?.name||'Local user')],['Data source','Google Sheets synchronized history + local cache'],['',''],
      ['PERFORMANCE SUMMARY',''],['Total labels',report.totals.labels],['Total batches',report.totals.batches],['Estimated A4 sheets',report.totals.sheets],['Average labels per batch',Number(report.totals.average.toFixed(2))],['Unique recipients',report.totals.recipients],['Active users',report.totals.users],['Active senders',report.totals.senders],['Active months',report.totals.activeMonths],['Previous-year labels',report.totals.previousLabels],['Year-on-year label change',changeText(report.totals.labels,report.totals.previousLabels)],['Earliest batch',displayDate(report.totals.firstDate)],['Latest batch',displayDate(report.totals.lastDate)],['',''],
      ['LEADERS',''],['Top customer',safeText(report.totals.topCustomer[0])],['Top customer labels',report.totals.topCustomer[1]],['Top user',safeText(report.totals.topUser[0])],['Top user labels',report.totals.topUser[1]],['Top sender',safeText(report.totals.topSender[0])],['Top sender labels',report.totals.topSender[1]],['Most-used layout',safeText(report.totals.topLayout[0])],['Layout batches',report.totals.topLayout[1].batches||0],['',''],
      ['SYNC STATUS',''],['Synced batches',report.totals.synced],['Pending batches',report.totals.pending],['Failed batches',report.totals.failed]
    ];
    XLSX.utils.book_append_sheet(book,createWorksheet(summary,[31,42],{filter:false}),'Executive Summary');

    let cumulativeLabels=0,cumulativeBatches=0;
    const monthlyRows=[['Month','Labels','Previous-year labels','YoY change','Batches','Estimated A4 sheets','Average labels / batch','Unique recipients','First-ever recipients','Active users','Top customer','Customer labels','Top user','User labels','Top sender','Sender labels','Top layout','Layout batches','Cumulative labels','Cumulative batches']];
    report.months.forEach(month=>{
      cumulativeLabels+=month.labels;cumulativeBatches+=month.batches;
      const topCustomer=topCounter(month.customers,key=>report.customers.get(key)?.name||key),topUser=topCounter(month.users,key=>report.users.get(key)?.name||key),topSender=topCounter(month.senders,key=>report.senders.get(key)?.name||key),topLayout=topCounter(month.layouts);
      const newRecipients=[...month.recipients].filter(key=>{const first=report.customerFirstSeen.get(key);return first&&first.getFullYear()===year&&first.getMonth()===month.month}).length;
      monthlyRows.push([monthNames[month.month],month.labels,report.previousLabels[month.month],changeText(month.labels,report.previousLabels[month.month]),month.batches,month.sheets,month.batches?Number((month.labels/month.batches).toFixed(2)):0,month.recipients.size,newRecipients,month.users.size,safeText(topCustomer[0]),topCustomer[1],safeText(topUser[0]),topUser[1],safeText(topSender[0]),topSender[1],safeText(topLayout[0]),topLayout[1],cumulativeLabels,cumulativeBatches]);
    });
    XLSX.utils.book_append_sheet(book,createWorksheet(monthlyRows,[14,10,18,12,10,19,20,18,19,13,30,15,24,12,28,13,15,14,17,18]),'Monthly Summary');

    const batchRows=[['Date','Time','Batch ID','User','Nickname','Layout','Label count','Estimated A4 sheets','Unique recipients','Sender(s)','Sync status','Source']];
    report.selected.forEach(batch=>{const recipients=new Set(batch.labels.map(row=>customerIdentity(row)?.key).filter(Boolean)),senderList=[...new Set(batch.labels.map(row=>senderIdentity(row).name))].join(' · ');batchRows.push([displayDate(batch._date),displayTime(batch._date),safeText(batch.id),safeText(batch.user||'Unknown user'),safeText(batch.nickname||''),safeText(LAYOUTS[batch.layout]?.label||batch.layout||'Unknown'),batch.labels.length,estimatedSheets(batch),recipients.size,safeText(senderList),syncState(batch.syncState),safeText(batch.source||'Generated history')])});
    XLSX.utils.book_append_sheet(book,createWorksheet(batchRows,[14,12,28,24,18,12,12,20,18,34,13,24]),'Batch Detail');

    const labelRows=[['Date','Time','Month','Batch ID','Label no.','Prefix','Company','Full recipient','Attn','Phone','Address','Sender','User','Nickname','Layout','Sync status','Source']];
    report.selected.forEach(batch=>batch.labels.forEach((row,index)=>labelRows.push([displayDate(batch._date),displayTime(batch._date),monthNames[batch._date.getMonth()],safeText(batch.id),index+1,safeText(row.prefix),safeText(row.company),safeText(full(row)),safeText(row.attn),safeText(row.phone),safeText(row.address),safeText(senderIdentity(row).name),safeText(batch.user||'Unknown user'),safeText(batch.nickname||''),safeText(LAYOUTS[batch.layout]?.label||batch.layout||'Unknown'),syncState(batch.syncState),safeText(batch.source||'Generated history')])));
    XLSX.utils.book_append_sheet(book,createWorksheet(labelRows,[14,12,14,28,10,10,30,34,28,18,48,28,24,18,12,13,24]),'Label Detail');

    const customerRows=[['Customer','Prefix','Company','Labels','Batches','Months active','Share of annual labels','First printed','Last printed','Top sender','Top user','Unique contacts','Unique addresses']];
    [...report.customers.values()].sort((a,b)=>b.labels-a.labels||a.name.localeCompare(b.name)).forEach(value=>{const topSender=topCounter(value.senders,key=>report.senders.get(key)?.name||key),topUser=topCounter(value.users,key=>report.users.get(key)?.name||key);customerRows.push([safeText(value.name),safeText(value.prefix),safeText(value.company),value.labels,value.batches.size,value.months.size,ratio(value.labels,report.totals.labels),displayDate(value.first),displayDate(new Date(value.last)),safeText(topSender[0]),safeText(topUser[0]),value.contacts.size,value.addresses.size])});
    XLSX.utils.book_append_sheet(book,createWorksheet(customerRows,[34,10,30,10,10,14,21,15,15,28,24,16,17]),'Customer Summary');

    const userRows=[['User','Labels','Batches','Average labels / batch','Unique customers','Active months','Share of annual labels','Top customer','Most active month','Last activity']];
    [...report.users.entries()].sort((a,b)=>b[1].labels-a[1].labels||a[1].name.localeCompare(b[1].name)).forEach(([userKey,value])=>{const customerCounts=new Map([...report.customers.entries()].filter(([,customer])=>customer.users.has(userKey)).map(([key,customer])=>[key,customer.users.get(userKey)])),topCustomer=topCounter(customerCounts,key=>report.customers.get(key)?.name||key),topMonth=topCounter(value.months);userRows.push([safeText(value.name),value.labels,value.batches.size,value.batches.size?Number((value.labels/value.batches.size).toFixed(2)):0,value.customers.size,value.months.size,ratio(value.labels,report.totals.labels),safeText(topCustomer[0]),safeText(topMonth[0]),displayDate(new Date(value.last))])});
    XLSX.utils.book_append_sheet(book,createWorksheet(userRows,[26,10,10,21,17,14,21,32,19,15]),'User Summary');

    const senderRows=[['Sender','Labels','Batches','Unique customers','Active months','Share of annual labels','Top customer','Last used']];
    [...report.senders.values()].sort((a,b)=>b.labels-a.labels||a.name.localeCompare(b.name)).forEach(value=>{const topCustomer=topCounter(value.customers,key=>report.customers.get(key)?.name||key);senderRows.push([safeText(value.name),value.labels,value.batches.size,value.customers.size,value.months.size,ratio(value.labels,report.totals.labels),safeText(topCustomer[0]),displayDate(new Date(value.last))])});
    XLSX.utils.book_append_sheet(book,createWorksheet(senderRows,[30,10,10,18,14,21,34,15]),'Sender Summary');

    const layoutRows=[['Layout','Capacity per A4 sheet','Batches','Labels','Estimated A4 sheets','Average labels / batch','Average sheet utilization']];
    [...report.layouts.entries()].sort((a,b)=>b[1].batches-a[1].batches||a[0].localeCompare(b[0])).forEach(([name,value])=>{const capacity=capacityFor(value.key);layoutRows.push([safeText(name),capacity,value.batches,value.labels,value.sheets,value.batches?Number((value.labels/value.batches).toFixed(2)):0,ratio(value.labels,value.sheets*capacity)])});
    XLSX.utils.book_append_sheet(book,createWorksheet(layoutRows,[18,22,10,10,20,21,24]),'Layout Summary');

    const missing={company:0,attn:0,phone:0,address:0,sender:0};
    report.selected.forEach(batch=>batch._pairs.forEach(pair=>{const raw=pair.raw||{};if(!clean(raw.company)&&!clean(raw.companyName)&&!clean(raw.penerima))missing.company++;if(!clean(raw.attn))missing.attn++;if(!clean(raw.phone))missing.phone++;if(!clean(raw.address))missing.address++;if(!clean(raw.sender))missing.sender++}));
    const qualityRows=[['Check','Count','Notes'],['Batches included',report.totals.batches,`Unique, non-empty batches with valid timestamps in ${year}`],['Labels included',report.totals.labels,`All usable labels in ${year}`],['Invalid timestamps in full history',report.invalidTimestamps,'Excluded because they cannot be assigned to a report year'],['Missing batch IDs in full history',report.missingBatchIds,'Excluded because they cannot be synchronized safely'],['Empty batches in full history',report.emptyBatches,'Excluded because they contain no usable labels'],['Duplicate batch IDs',report.duplicateBatchIds.length,report.duplicateBatchIds.map(([id,count])=>`${id} (${count})`).join(' · ')],['Duplicate records removed',report.duplicateRecords,'Only the most complete record for each batch ID is counted'],['Labels missing company',missing.company,'Excluded from unique-recipient and customer rankings, but retained in Label Detail'],['Labels missing attention',missing.attn,'May be acceptable when no contact is specified'],['Labels missing phone',missing.phone,'Review Label Detail'],['Labels missing address',missing.address,'Review Label Detail'],['Labels missing sender',missing.sender,'The interface may display the default sender when the source value is blank'],['Pending sync batches',report.totals.pending,'Saved locally and awaiting backend confirmation'],['Failed sync batches',report.totals.failed,'Review the backend connection']];
    XLSX.utils.book_append_sheet(book,createWorksheet(qualityRows,[34,12,76]),'Data Quality');

    const missingSheets=REPORT_SHEETS.filter(name=>!book.SheetNames.includes(name));
    if(missingSheets.length)throw new Error(`Workbook is missing: ${missingSheets.join(', ')}`);
    if(book.SheetNames.length!==REPORT_SHEETS.length)throw new Error('Workbook contains an unexpected number of sheets');
    return{book,report};
  }

  function saveWorkbook(book,fileName){
    const XLSX=window.XLSX;
    if(typeof XLSX.write!=='function'){XLSX.writeFile(book,fileName,{bookType:'xlsx',compression:true});return}
    const data=XLSX.write(book,{bookType:'xlsx',type:'array',compression:true});
    const blob=new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    if(navigator.msSaveOrOpenBlob){navigator.msSaveOrOpenBlob(blob,fileName);return}
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=fileName;anchor.rel='noopener';anchor.style.display='none';document.body.appendChild(anchor);
    requestAnimationFrame(()=>{anchor.click();setTimeout(()=>anchor.remove(),1000)});
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }

  async function downloadMonthlyReport(){
    if(button.disabled)return;
    const selectedYear=Number(document.getElementById('monthlyYear')?.value)||ensureMonthlyYear(),year=Math.trunc(selectedYear),original=button.textContent;
    button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Preparing report…';
    try{
      await ensureXlsxLibrary();
      const {book,report}=buildWorkbook(year),stamp=new Date().toISOString().slice(0,10).replace(/-/g,''),fileName=`KSB-LabelPrint-Monthly-Report-${year}-${stamp}.xlsx`;
      saveWorkbook(book,fileName);
      toast(report.selected.length?`Detailed ${year} report downloaded`:`${year} report downloaded · no batches found`);
    }catch(error){
      console.error('Monthly report download failed:',error);
      toast(`Report download failed: ${error?.message||error}`);
    }finally{
      button.disabled=false;button.removeAttribute('aria-busy');button.textContent=original;
    }
  }

  button.onclick=downloadMonthlyReport;
  const warm=()=>ensureXlsxLibrary().catch(()=>{});
  button.addEventListener('pointerdown',warm,{once:true,passive:true});
  button.addEventListener('pointerenter',warm,{once:true,passive:true});
  button.addEventListener('touchstart',warm,{once:true,passive:true});
  button.addEventListener('focus',warm,{once:true,passive:true});
  const preload=()=>ensureXlsxLibrary().catch(()=>{});
  if('requestIdleCallback'in window)requestIdleCallback(preload,{timeout:3500});else setTimeout(preload,1800);
  window.LabelPrintReportExport={annualReportData,buildWorkbook};
})();
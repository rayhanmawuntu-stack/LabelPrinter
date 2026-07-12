(()=>{
  const button=document.getElementById('downloadMonthlyReportPdf');
  if(!button)return;

  let pdfLibrariesPromise=null;
  function loadExternalScript(src,test){
    if(test())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const timer=setTimeout(()=>{script.remove();reject(new Error('PDF component timed out'))},15000);
      script.src=src;script.async=true;
      script.onload=()=>{clearTimeout(timer);test()?resolve():reject(new Error('PDF component failed to initialize'))};
      script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('PDF component failed to load'))};
      document.head.appendChild(script);
    });
  }
  function ensureReportPdfLibraries(){
    if(pdfLibrariesPromise)return pdfLibrariesPromise;
    pdfLibrariesPromise=(async()=>{
      await loadExternalScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF);
      await loadExternalScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',()=>typeof window.jspdf?.jsPDF?.API?.autoTable==='function');
      return window.jspdf.jsPDF;
    })().catch(error=>{pdfLibrariesPromise=null;throw error});
    return pdfLibrariesPromise;
  }

  const monthShort=Array.from({length:12},(_,month)=>new Date(2000,month,1).toLocaleDateString('en-GB',{month:'short'}));
  const formatNumber=value=>Number(value||0).toLocaleString('en-GB');
  const shortText=(value,max=28)=>{const text=clean(value)||'—';return text.length>max?`${text.slice(0,max-1)}…`:text};
  const displayDate=value=>{const date=value instanceof Date?value:new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})};

  function parseCssColor(value,fallback){
    const raw=clean(value)||fallback;
    const hex=raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if(hex){
      const value6=hex[1].length===3?hex[1].split('').map(x=>x+x).join(''):hex[1];
      return[parseInt(value6.slice(0,2),16),parseInt(value6.slice(2,4),16),parseInt(value6.slice(4,6),16)];
    }
    const rgb=raw.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)/i);
    return rgb?[Number(rgb[1]),Number(rgb[2]),Number(rgb[3])]:parseCssColor(fallback,'#dfff3f');
  }
  function reportColors(){
    const styles=getComputedStyle(document.documentElement),primary=parseCssColor(styles.getPropertyValue('--scheme-primary'),'#dfff3f'),accent=parseCssColor(styles.getPropertyValue('--scheme-accent'),'#b9d0ff');
    const luminance=(primary[0]*299+primary[1]*587+primary[2]*114)/1000;
    return{primary,accent,onPrimary:luminance>150?[18,20,24]:[255,255,255],ink:[22,25,31],muted:[103,112,122],line:[221,226,231],paper:[247,248,250],white:[255,255,255],success:[42,145,90],warning:[217,145,27],danger:[190,55,55]};
  }
  const setFill=(doc,color)=>doc.setFillColor(...color);
  const setDraw=(doc,color)=>doc.setDrawColor(...color);
  const setText=(doc,color)=>doc.setTextColor(...color);

  function drawReportHeader(doc,year,generated,colors,section='Annual performance report'){
    setFill(doc,colors.primary);doc.roundedRect(12,10,26,10,3,3,'F');setText(doc,colors.onPrimary);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('KSB',25,16.8,{align:'center'});
    setText(doc,colors.ink);doc.setFontSize(18);doc.text('LabelPrint',43,17);
    doc.setFontSize(8);doc.setFont('helvetica','normal');setText(doc,colors.muted);doc.text(`${section} · ${year}`,43,22);
    doc.text(`Generated ${displayDate(generated)} · ${clean(currentUser?.name)||'Local user'}`,285,17,{align:'right'});
    setDraw(doc,colors.line);doc.line(12,27,285,27);
  }

  function drawKpi(doc,x,y,w,h,label,value,sub,colors,accent=false){
    setFill(doc,accent?colors.primary:colors.white);setDraw(doc,accent?colors.primary:colors.line);doc.roundedRect(x,y,w,h,4,4,'FD');
    setText(doc,accent?colors.onPrimary:colors.muted);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(label,x+5,y+7);
    setText(doc,accent?colors.onPrimary:colors.ink);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text(String(value),x+5,y+18);
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(sub,x+5,y+h-5);
  }

  function drawLineChart(doc,{x,y,w,h,title,labels,current,previous,colors}){
    setFill(doc,colors.white);setDraw(doc,colors.line);doc.roundedRect(x,y,w,h,4,4,'FD');
    setText(doc,colors.ink);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(title,x+6,y+8);
    const left=x+13,right=x+w-7,top=y+16,bottom=y+h-13,chartW=right-left,chartH=bottom-top,max=Math.max(1,...current,...previous);
    doc.setFont('helvetica','normal');doc.setFontSize(6);setText(doc,colors.muted);
    for(let i=0;i<5;i++){
      const value=Math.round(max*(1-i/4)),py=top+(chartH*i/4);setDraw(doc,colors.line);doc.line(left,py,right,py);doc.text(String(value),left-3,py+2,{align:'right'});
    }
    labels.forEach((label,index)=>{const px=labels.length===1?left+chartW/2:left+chartW*(index/(labels.length-1));doc.text(label,px,bottom+6,{align:'center'})});
    const plot=(values,color,width)=>{
      setDraw(doc,color);doc.setLineWidth(width);
      for(let i=1;i<values.length;i++){
        const x1=left+chartW*((i-1)/(values.length-1)),x2=left+chartW*(i/(values.length-1)),y1=bottom-chartH*(values[i-1]/max),y2=bottom-chartH*(values[i]/max);doc.line(x1,y1,x2,y2);
      }
      values.forEach((value,index)=>{const px=values.length===1?left+chartW/2:left+chartW*(index/(values.length-1)),py=bottom-chartH*(value/max);setFill(doc,color);doc.circle(px,py,1.1,'F')});
    };
    plot(previous,colors.accent,.8);plot(current,colors.primary,1.2);
    setFill(doc,colors.primary);doc.rect(x+w-48,y+5,4,2,'F');setText(doc,colors.muted);doc.text('Selected year',x+w-42,y+7);
    setFill(doc,colors.accent);doc.rect(x+w-24,y+5,4,2,'F');doc.text('Previous',x+w-18,y+7);
  }

  function drawBarChart(doc,{x,y,w,h,title,entries,colors,barColor}){
    setFill(doc,colors.white);setDraw(doc,colors.line);doc.roundedRect(x,y,w,h,4,4,'FD');
    setText(doc,colors.ink);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(title,x+6,y+8);
    const rows=entries.slice(0,7),max=Math.max(1,...rows.map(([,value])=>value)),rowH=(h-18)/Math.max(1,rows.length);
    doc.setFontSize(7);
    if(!rows.length){setText(doc,colors.muted);doc.setFont('helvetica','normal');doc.text('No data available.',x+6,y+20);return}
    rows.forEach(([name,value],index)=>{
      const rowY=y+14+index*rowH,label=shortText(name,24);setText(doc,colors.ink);doc.setFont('helvetica','normal');doc.text(label,x+6,rowY+3);
      setText(doc,colors.muted);doc.text(formatNumber(value),x+w-6,rowY+3,{align:'right'});
      setFill(doc,colors.paper);doc.roundedRect(x+6,rowY+5,w-12,3,1.5,1.5,'F');setFill(doc,barColor);doc.roundedRect(x+6,rowY+5,Math.max(2,(w-12)*(value/max)),3,1.5,1.5,'F');
    });
  }

  function addPageTitle(doc,title,subtitle,colors){setText(doc,colors.ink);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(title,12,38);doc.setFont('helvetica','normal');doc.setFontSize(8);setText(doc,colors.muted);doc.text(subtitle,12,43)}

  function topEntries(map,selector){return[...map.entries()].map(([key,value])=>[selector(value,key),value.labels??value]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));}

  function createPdf(year){
    const report=window.LabelPrintReportExport?.annualReportData?.(year);
    if(!report)throw new Error('Report data is unavailable');
    const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true}),colors=reportColors(),generated=new Date();
    const current=report.months.map(month=>month.labels),previous=report.previousLabels;
    const customerEntries=topEntries(report.customers,value=>value.name),userEntries=topEntries(report.users,value=>value.name),senderEntries=topEntries(report.senders,value=>value.name),layoutEntries=[...report.layouts.entries()].map(([name,value])=>[name,value.labels]).sort((a,b)=>b[1]-a[1]);

    drawReportHeader(doc,year,generated,colors);
    addPageTitle(doc,'Executive overview','Annual label activity, efficiency, and usage leaders.',colors);
    const kpiY=49,kpiW=64,kpiH=27,gap=6;
    drawKpi(doc,12,kpiY,kpiW,kpiH,'TOTAL LABELS',formatNumber(report.totals.labels),`${formatNumber(report.totals.batches)} batches`,colors,true);
    drawKpi(doc,12+(kpiW+gap),kpiY,kpiW,kpiH,'UNIQUE RECIPIENTS',formatNumber(report.totals.recipients),`${formatNumber(report.totals.activeMonths)} active months`,colors);
    drawKpi(doc,12+2*(kpiW+gap),kpiY,kpiW,kpiH,'ESTIMATED A4 SHEETS',formatNumber(report.totals.sheets),`${report.totals.average.toFixed(1)} labels / batch`,colors);
    drawKpi(doc,12+3*(kpiW+gap),kpiY,kpiW,kpiH,'YEAR-ON-YEAR',report.totals.previousLabels?`${(((report.totals.labels-report.totals.previousLabels)/report.totals.previousLabels)*100).toFixed(1)}%`:(report.totals.labels?'New':'0.0%'),`${formatNumber(report.totals.previousLabels)} labels last year`,colors);
    drawLineChart(doc,{x:12,y:83,w:180,h:105,title:'Monthly label output',labels:monthShort,current,previous,colors});
    drawBarChart(doc,{x:198,y:83,w:87,h:50,title:'Top recipients',entries:customerEntries,colors,barColor:colors.primary});
    drawBarChart(doc,{x:198,y:138,w:87,h:50,title:'Top users',entries:userEntries,colors,barColor:colors.accent});

    doc.addPage();drawReportHeader(doc,year,generated,colors,'Monthly performance');addPageTitle(doc,'Monthly performance','Volume, batch activity, recipients, and year-on-year comparison.',colors);
    drawBarChart(doc,{x:12,y:49,w:88,h:55,title:'Monthly batches',entries:report.months.map((month,index)=>[monthShort[index],month.batches]),colors,barColor:colors.primary});
    drawBarChart(doc,{x:105,y:49,w:88,h:55,title:'Layout usage by labels',entries:layoutEntries,colors,barColor:colors.accent});
    drawBarChart(doc,{x:198,y:49,w:87,h:55,title:'Sender usage',entries:senderEntries,colors,barColor:colors.primary});
    doc.autoTable({startY:111,margin:{left:12,right:12},head:[['Month','Labels','Prev. year','YoY','Batches','Sheets','Recipients','Top customer','Top user']],body:report.months.map((month,index)=>{const topCustomer=[...month.customers.entries()].sort((a,b)=>b[1]-a[1])[0],topUser=[...month.users.entries()].sort((a,b)=>b[1]-a[1])[0];const yoy=report.previousLabels[index]?`${(((month.labels-report.previousLabels[index])/report.previousLabels[index])*100).toFixed(1)}%`:(month.labels?'New':'0.0%');return[monthShort[index],formatNumber(month.labels),formatNumber(report.previousLabels[index]),yoy,formatNumber(month.batches),formatNumber(month.sheets),formatNumber(month.recipients.size),shortText(report.customers.get(topCustomer?.[0])?.name||'—',22),shortText(report.users.get(topUser?.[0])?.name||'—',18)]}),theme:'grid',styles:{fontSize:6.7,cellPadding:2,textColor:colors.ink,lineColor:colors.line,lineWidth:.2},headStyles:{fillColor:colors.ink,textColor:colors.white,fontStyle:'bold'},alternateRowStyles:{fillColor:colors.paper},columnStyles:{0:{fontStyle:'bold'},7:{cellWidth:36},8:{cellWidth:28}}});

    doc.addPage();drawReportHeader(doc,year,generated,colors,'Leaders and concentration');addPageTitle(doc,'Leaders and concentration','Top customers, users, senders, and layouts for the selected year.',colors);
    drawBarChart(doc,{x:12,y:49,w:132,h:62,title:'Top 7 recipients',entries:customerEntries,colors,barColor:colors.primary});
    drawBarChart(doc,{x:153,y:49,w:132,h:62,title:'Top 7 users',entries:userEntries,colors,barColor:colors.accent});
    doc.autoTable({startY:119,margin:{left:12,right:153},head:[['Recipient','Labels','Batches','Months','Share']],body:customerEntries.slice(0,12).map(([name],index)=>{const value=[...report.customers.values()].sort((a,b)=>b.labels-a.labels||a.name.localeCompare(b.name))[index];return[shortText(name,34),formatNumber(value.labels),formatNumber(value.batches.size),formatNumber(value.months.size),report.totals.labels?`${((value.labels/report.totals.labels)*100).toFixed(1)}%`:'0.0%']}),theme:'grid',styles:{fontSize:7,cellPadding:2,lineColor:colors.line,lineWidth:.2},headStyles:{fillColor:colors.ink,textColor:colors.white},alternateRowStyles:{fillColor:colors.paper}});
    doc.autoTable({startY:119,margin:{left:153,right:12},head:[['User','Labels','Batches','Customers','Share']],body:userEntries.slice(0,12).map(([name],index)=>{const value=[...report.users.values()].sort((a,b)=>b.labels-a.labels||a.name.localeCompare(b.name))[index];return[shortText(name,28),formatNumber(value.labels),formatNumber(value.batches.size),formatNumber(value.customers.size),report.totals.labels?`${((value.labels/report.totals.labels)*100).toFixed(1)}%`:'0.0%']}),theme:'grid',styles:{fontSize:7,cellPadding:2,lineColor:colors.line,lineWidth:.2},headStyles:{fillColor:colors.ink,textColor:colors.white},alternateRowStyles:{fillColor:colors.paper}});

    doc.addPage();drawReportHeader(doc,year,generated,colors,'Detailed activity');addPageTitle(doc,'Detailed batch activity','Chronological batch log for audit and reconciliation.',colors);
    doc.autoTable({startY:49,margin:{left:12,right:12},head:[['Date','Batch ID','User','Layout','Labels','Sheets','Recipients','Sender(s)','Sync']],body:report.selected.map(batch=>{const recipients=new Set(batch.labels.map(row=>clean(row.company)).filter(Boolean)),senders=[...new Set(batch.labels.map(row=>clean(row.sender)||'KSB INDONESIA'))].join(' · ');return[displayDate(batch._date),shortText(batch.id,28),shortText(batch.user||batch.nickname||'Unknown user',22),LAYOUTS[batch.layout]?.label||batch.layout||'Unknown',formatNumber(batch.labels.length),formatNumber(Math.ceil(batch.labels.length/(LAYOUTS[batch.layout]?.n||6))),formatNumber(recipients.size),shortText(senders,30),clean(batch.syncState)||'pending']}),theme:'grid',styles:{fontSize:6.5,cellPadding:1.8,lineColor:colors.line,lineWidth:.2,overflow:'linebreak'},headStyles:{fillColor:colors.ink,textColor:colors.white},alternateRowStyles:{fillColor:colors.paper},columnStyles:{1:{cellWidth:38},2:{cellWidth:30},7:{cellWidth:42}}});

    doc.addPage();drawReportHeader(doc,year,generated,colors,'Data quality');addPageTitle(doc,'Data quality and synchronization','Validation checks for the report source and backend state.',colors);
    const quality=[['Batches included',report.totals.batches,'Unique batches with valid timestamps and usable labels'],['Labels included',report.totals.labels,'All usable labels in the selected year'],['Duplicate records removed',report.duplicateRecords,'Only the most complete record per batch ID is counted'],['Invalid timestamps',report.invalidTimestamps,'Excluded from annual calculations'],['Missing batch IDs',report.missingBatchIds,'Excluded because they cannot be synchronized safely'],['Empty batches',report.emptyBatches,'Excluded because they contain no usable labels'],['Synced batches',report.totals.synced,'Confirmed by the backend'],['Pending batches',report.totals.pending,'Saved locally and awaiting confirmation'],['Failed batches',report.totals.failed,'Requires backend review']];
    doc.autoTable({startY:49,margin:{left:12,right:12},head:[['Check','Count','Interpretation']],body:quality.map(row=>[row[0],formatNumber(row[1]),row[2]]),theme:'grid',styles:{fontSize:8,cellPadding:3,lineColor:colors.line,lineWidth:.2},headStyles:{fillColor:colors.ink,textColor:colors.white},alternateRowStyles:{fillColor:colors.paper},columnStyles:{0:{cellWidth:62,fontStyle:'bold'},1:{cellWidth:26,halign:'right'},2:{cellWidth:170}}});
    const y=doc.lastAutoTable.finalY+10;drawBarChart(doc,{x:12,y,w:132,h:50,title:'Synchronization status',entries:[['Synced',report.totals.synced],['Pending',report.totals.pending],['Failed',report.totals.failed]],colors,barColor:colors.primary});drawBarChart(doc,{x:153,y,w:132,h:50,title:'Active senders',entries:senderEntries,colors,barColor:colors.accent});

    const pages=doc.getNumberOfPages();
    for(let page=1;page<=pages;page++){
      doc.setPage(page);setDraw(doc,colors.line);doc.line(12,200,285,200);doc.setFont('helvetica','normal');doc.setFontSize(7);setText(doc,colors.muted);doc.text(`KSB LabelPrint · ${year} report`,12,205);doc.text(`Page ${page} of ${pages}`,285,205,{align:'right'});
    }
    return{doc,report};
  }

  async function downloadPdfReport(){
    if(button.disabled)return;
    const year=Math.trunc(Number(document.getElementById('monthlyYear')?.value)||ensureMonthlyYear()),original=button.textContent;
    button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Preparing PDF…';
    try{
      await ensureReportPdfLibraries();
      const {doc,report}=createPdf(year),stamp=new Date().toISOString().slice(0,10).replace(/-/g,''),fileName=`KSB-LabelPrint-Annual-Report-${year}-${stamp}.pdf`;
      doc.save(fileName);
      toast(report.selected.length?`Visual ${year} PDF report downloaded`:`${year} PDF downloaded · no batches found`);
    }catch(error){
      console.error('PDF report download failed:',error);
      toast(`PDF download failed: ${error?.message||error}`);
    }finally{
      button.disabled=false;button.removeAttribute('aria-busy');button.textContent=original;
    }
  }

  button.onclick=downloadPdfReport;
  const warm=()=>ensureReportPdfLibraries().catch(()=>{});
  button.addEventListener('pointerdown',warm,{once:true,passive:true});
  button.addEventListener('pointerenter',warm,{once:true,passive:true});
  button.addEventListener('touchstart',warm,{once:true,passive:true});
  button.addEventListener('focus',warm,{once:true,passive:true});
})();
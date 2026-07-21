(()=>{
  const button=document.getElementById('downloadMonthlyReportPdf');
  if(!button)return;

  let librariesPromise=null;
  function loadScript(src,test){
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
  function ensureLibraries(){
    if(librariesPromise)return librariesPromise;
    librariesPromise=(async()=>{
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF);
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',()=>typeof window.jspdf?.jsPDF?.API?.autoTable==='function');
    })().catch(error=>{librariesPromise=null;throw error});
    return librariesPromise;
  }

  const months=Array.from({length:12},(_,i)=>new Date(2000,i,1).toLocaleDateString('en-GB',{month:'short'}));
  const page={width:210,height:297,margin:12,right:198,footerLine:287,footerText:292};
  const number=value=>Number(value||0).toLocaleString('en-GB');
  const trim=(value,max=28)=>{const text=clean(value)||'—';return text.length>max?`${text.slice(0,max-1)}…`:text};
  const dateText=value=>{const date=value instanceof Date?value:new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})};
  const rgb=(value,fallback)=>{
    const raw=clean(value)||fallback,hex=raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if(hex){const normalized=hex[1].length===3?hex[1].split('').map(char=>char+char).join(''):hex[1];return[parseInt(normalized.slice(0,2),16),parseInt(normalized.slice(2,4),16),parseInt(normalized.slice(4,6),16)]}
    const match=raw.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)/i);return match?[Number(match[1]),Number(match[2]),Number(match[3])]:rgb(fallback,'#dfff3f');
  };
  function palette(){
    const styles=getComputedStyle(document.documentElement),primary=rgb(styles.getPropertyValue('--scheme-primary'),'#dfff3f'),accent=rgb(styles.getPropertyValue('--scheme-accent'),'#b9d0ff'),lum=(primary[0]*299+primary[1]*587+primary[2]*114)/1000;
    return{primary,accent,onPrimary:lum>150?[18,20,24]:[255,255,255],ink:[22,25,31],muted:[102,111,122],line:[220,225,231],paper:[247,248,250],white:[255,255,255]};
  }
  const fill=(doc,color)=>doc.setFillColor(...color),draw=(doc,color)=>doc.setDrawColor(...color),text=(doc,color)=>doc.setTextColor(...color);
  function header(doc,year,generated,c,section){
    fill(doc,c.primary);doc.roundedRect(12,9,27,11,3,3,'F');text(doc,c.onPrimary);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('KSB',25.5,16.4,{align:'center'});
    text(doc,c.ink);doc.setFontSize(18);doc.text('LabelPrint',44,16.5);doc.setFont('helvetica','normal');doc.setFontSize(8);text(doc,c.muted);doc.text(`${section} · ${year}`,44,22);doc.text(`Generated ${dateText(generated)} · ${clean(currentUser?.name)||'Local user'}`,page.right,16.5,{align:'right'});draw(doc,c.line);doc.line(page.margin,27,page.right,27);
  }
  function title(doc,name,description,c){text(doc,c.ink);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(name,12,38);doc.setFont('helvetica','normal');doc.setFontSize(8);text(doc,c.muted);doc.text(description,12,43)}
  function card(doc,x,y,w,h,label,value,sub,c,active=false){fill(doc,active?c.primary:c.white);draw(doc,active?c.primary:c.line);doc.roundedRect(x,y,w,h,4,4,'FD');text(doc,active?c.onPrimary:c.muted);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(label,x+5,y+7);text(doc,active?c.onPrimary:c.ink);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text(String(value),x+5,y+18);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(sub,x+5,y+h-5)}
  function lineChart(doc,{x,y,w,h,name,labels,series,previous,c}){
    fill(doc,c.white);draw(doc,c.line);doc.roundedRect(x,y,w,h,4,4,'FD');text(doc,c.ink);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(name,x+6,y+8);
    const left=x+13,right=x+w-7,top=y+17,bottom=y+h-13,chartW=right-left,chartH=bottom-top,max=Math.max(1,...series,...previous);doc.setFont('helvetica','normal');doc.setFontSize(6);text(doc,c.muted);
    for(let i=0;i<5;i++){const py=top+chartH*i/4,value=Math.round(max*(1-i/4));draw(doc,c.line);doc.line(left,py,right,py);doc.text(String(value),left-3,py+2,{align:'right'})}
    labels.forEach((label,index)=>{const px=left+chartW*(index/(labels.length-1));doc.text(label,px,bottom+6,{align:'center'})});
    const plot=(values,color,width)=>{draw(doc,color);doc.setLineWidth(width);for(let i=1;i<values.length;i++){const x1=left+chartW*((i-1)/(values.length-1)),x2=left+chartW*(i/(values.length-1)),y1=bottom-chartH*(values[i-1]/max),y2=bottom-chartH*(values[i]/max);doc.line(x1,y1,x2,y2)}values.forEach((value,index)=>{fill(doc,color);doc.circle(left+chartW*(index/(values.length-1)),bottom-chartH*(value/max),1.05,'F')})};
    plot(previous,c.accent,.8);plot(series,c.primary,1.2);fill(doc,c.primary);doc.rect(x+w-49,y+5,4,2,'F');text(doc,c.muted);doc.text('Selected year',x+w-43,y+7);fill(doc,c.accent);doc.rect(x+w-24,y+5,4,2,'F');doc.text('Previous',x+w-18,y+7);
  }
  function barChart(doc,{x,y,w,h,name,entries,c,color}){
    fill(doc,c.white);draw(doc,c.line);doc.roundedRect(x,y,w,h,4,4,'FD');text(doc,c.ink);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(name,x+6,y+8);
    const limit=Math.max(1,Math.floor((h-17)/8)),rows=entries.slice(0,limit),max=Math.max(1,...rows.map(([,value])=>value));
    if(!rows.length){doc.setFont('helvetica','normal');doc.setFontSize(7);text(doc,c.muted);doc.text('No data available.',x+6,y+20);return}
    const rowH=(h-17)/rows.length;doc.setFontSize(6.8);
    rows.forEach(([label,value],index)=>{const rowY=y+13+rowH*index;text(doc,c.ink);doc.setFont('helvetica','normal');doc.text(trim(label,w<100?21:32),x+6,rowY+2.5);text(doc,c.muted);doc.text(number(value),x+w-6,rowY+2.5,{align:'right'});fill(doc,c.paper);doc.roundedRect(x+6,rowY+4,w-12,2.2,1.1,1.1,'F');fill(doc,color);doc.roundedRect(x+6,rowY+4,Math.max(2,(w-12)*(value/max)),2.2,1.1,1.1,'F')});
  }
  const ranked=(map,name)=>[...map.values()].map(value=>[name(value),value.labels]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  function createReport(year){
    const report=window.LabelPrintReportExport?.annualReportData?.(year);if(!report)throw new Error('Report data is unavailable');
    const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true}),c=palette(),generated=new Date(),current=report.months.map(month=>month.labels),customers=ranked(report.customers,value=>value.name),users=ranked(report.users,value=>value.name),senders=ranked(report.senders,value=>value.name),layouts=[...report.layouts.entries()].map(([name,value])=>[name,value.labels]).sort((a,b)=>b[1]-a[1]);

    header(doc,year,generated,c,'Annual performance report');title(doc,'Executive overview','Annual label activity, efficiency, and usage leaders.',c);
    const y=49,w=90,h=27,g=6;card(doc,12,y,w,h,'TOTAL LABELS',number(report.totals.labels),`${number(report.totals.batches)} batches`,c,true);card(doc,12+w+g,y,w,h,'UNIQUE RECIPIENTS',number(report.totals.recipients),`${number(report.totals.activeMonths)} active months`,c);card(doc,12,y+h+g,w,h,'ESTIMATED A4 SHEETS',number(report.totals.sheets),`${report.totals.average.toFixed(1)} labels / batch`,c);const yoy=report.totals.previousLabels?`${(((report.totals.labels-report.totals.previousLabels)/report.totals.previousLabels)*100).toFixed(1)}%`:(report.totals.labels?'New':'0.0%');card(doc,12+w+g,y+h+g,w,h,'YEAR-ON-YEAR',yoy,`${number(report.totals.previousLabels)} labels last year`,c);
    lineChart(doc,{x:12,y:115,w:186,h:73,name:'Monthly label output',labels:months,series:current,previous:report.previousLabels,c});barChart(doc,{x:12,y:194,w:90,h:78,name:'Top recipients',entries:customers,c,color:c.primary});barChart(doc,{x:108,y:194,w:90,h:78,name:'Top users',entries:users,c,color:c.accent});

    doc.addPage();header(doc,year,generated,c,'Monthly performance');title(doc,'Monthly performance','Volume, batch activity, recipients, and year-on-year comparison.',c);barChart(doc,{x:12,y:49,w:90,h:48,name:'Monthly batches',entries:report.months.map((month,index)=>[months[index],month.batches]),c,color:c.primary});barChart(doc,{x:108,y:49,w:90,h:48,name:'Layout usage',entries:layouts,c,color:c.accent});barChart(doc,{x:12,y:103,w:186,h:46,name:'Sender usage',entries:senders,c,color:c.primary});
    doc.autoTable({startY:157,margin:{left:12,right:12,bottom:18},head:[['Month','Labels','Previous','YoY','Batches','Sheets','Recipients','Top customer','Top user']],body:report.months.map((month,index)=>{const customer=[...month.customers.entries()].sort((a,b)=>b[1]-a[1])[0],user=[...month.users.entries()].sort((a,b)=>b[1]-a[1])[0],change=report.previousLabels[index]?`${(((month.labels-report.previousLabels[index])/report.previousLabels[index])*100).toFixed(1)}%`:(month.labels?'New':'0.0%');return[months[index],number(month.labels),number(report.previousLabels[index]),change,number(month.batches),number(month.sheets),number(month.recipients.size),trim(report.customers.get(customer?.[0])?.name||'—',23),trim(report.users.get(user?.[0])?.name||'—',20)]}),theme:'grid',styles:{fontSize:5.7,cellPadding:1.6,textColor:c.ink,lineColor:c.line,lineWidth:.2,overflow:'linebreak'},headStyles:{fillColor:c.ink,textColor:c.white,fontStyle:'bold'},alternateRowStyles:{fillColor:c.paper},columnStyles:{0:{cellWidth:14},1:{cellWidth:16},2:{cellWidth:16},3:{cellWidth:15},4:{cellWidth:15},5:{cellWidth:15},6:{cellWidth:18},7:{cellWidth:45},8:{cellWidth:32}}});

    doc.addPage();header(doc,year,generated,c,'Leaders and concentration');title(doc,'Leaders and concentration','Top customers and users for the selected year.',c);barChart(doc,{x:12,y:49,w:90,h:64,name:'Leading recipients',entries:customers,c,color:c.primary});barChart(doc,{x:108,y:49,w:90,h:64,name:'Leading users',entries:users,c,color:c.accent});
    const sortedCustomers=[...report.customers.values()].sort((a,b)=>b.labels-a.labels||a.name.localeCompare(b.name)),sortedUsers=[...report.users.values()].sort((a,b)=>b.labels-a.labels||a.name.localeCompare(b.name));
    doc.autoTable({startY:121,margin:{left:12,right:12,bottom:18},head:[['Rank','Recipient','Labels','Share','Batches','User','Labels','Share','Batches']],body:Array.from({length:Math.max(Math.min(8,sortedCustomers.length),Math.min(8,sortedUsers.length))},(_,index)=>{const customer=sortedCustomers[index],user=sortedUsers[index];return[index+1,trim(customer?.name||'—',34),customer?number(customer.labels):'—',customer&&report.totals.labels?`${((customer.labels/report.totals.labels)*100).toFixed(1)}%`:'—',customer?number(customer.batches.size):'—',trim(user?.name||'—',28),user?number(user.labels):'—',user&&report.totals.labels?`${((user.labels/report.totals.labels)*100).toFixed(1)}%`:'—',user?number(user.batches.size):'—']}),theme:'grid',styles:{fontSize:6.2,cellPadding:1.8,lineColor:c.line,lineWidth:.2,textColor:c.ink,overflow:'linebreak'},headStyles:{fillColor:c.ink,textColor:c.white},alternateRowStyles:{fillColor:c.paper},columnStyles:{0:{cellWidth:11},1:{cellWidth:41},2:{cellWidth:15},3:{cellWidth:16},4:{cellWidth:18},5:{cellWidth:36},6:{cellWidth:15},7:{cellWidth:16},8:{cellWidth:18}}});

    doc.addPage();header(doc,year,generated,c,'Detailed activity');title(doc,'Detailed batch activity','Chronological batch log for audit and reconciliation.',c);doc.autoTable({startY:49,margin:{left:12,right:12,bottom:18},head:[['Date','Batch ID','User','Layout','Labels','Sheets','Recipients','Sender(s)','Sync']],body:report.selected.map(batch=>{const recipients=new Set(batch.labels.map(row=>clean(row.company)).filter(Boolean)),senderList=[...new Set(batch.labels.map(row=>clean(row.sender)||'KSB INDONESIA'))].join(' · ');return[dateText(batch._date),trim(batch.id,30),trim(batch.user||batch.nickname||'Unknown user',24),LAYOUTS[batch.layout]?.label||batch.layout||'Unknown',number(batch.labels.length),number(Math.ceil(batch.labels.length/(LAYOUTS[batch.layout]?.n||6))),number(recipients.size),trim(senderList,34),clean(batch.syncState)||'pending']}),theme:'grid',styles:{fontSize:5.7,cellPadding:1.5,lineColor:c.line,lineWidth:.2,textColor:c.ink,overflow:'linebreak'},headStyles:{fillColor:c.ink,textColor:c.white},alternateRowStyles:{fillColor:c.paper},columnStyles:{0:{cellWidth:20},1:{cellWidth:25},2:{cellWidth:24},3:{cellWidth:18},4:{cellWidth:13},5:{cellWidth:13},6:{cellWidth:17},7:{cellWidth:37},8:{cellWidth:19}}});

    doc.addPage();header(doc,year,generated,c,'Data quality');title(doc,'Data quality and synchronization','Validation checks for the report source and backend state.',c);const quality=[['Batches included',report.totals.batches,'Unique batches with valid timestamps and usable labels'],['Labels included',report.totals.labels,'All usable labels in the selected year'],['Duplicate records removed',report.duplicateRecords,'Only the most complete record per batch ID is counted'],['Invalid timestamps',report.invalidTimestamps,'Excluded from annual calculations'],['Missing batch IDs',report.missingBatchIds,'Excluded because they cannot be synchronized safely'],['Empty batches',report.emptyBatches,'Excluded because they contain no usable labels'],['Synced batches',report.totals.synced,'Confirmed by the backend'],['Pending batches',report.totals.pending,'Saved locally and awaiting confirmation'],['Failed batches',report.totals.failed,'Requires backend review']];doc.autoTable({startY:49,margin:{left:12,right:12,bottom:18},head:[['Check','Count','Interpretation']],body:quality.map(row=>[row[0],number(row[1]),row[2]]),theme:'grid',styles:{fontSize:7.5,cellPadding:2.6,lineColor:c.line,lineWidth:.2,textColor:c.ink,overflow:'linebreak'},headStyles:{fillColor:c.ink,textColor:c.white},alternateRowStyles:{fillColor:c.paper},columnStyles:{0:{cellWidth:52,fontStyle:'bold'},1:{cellWidth:24,halign:'right'},2:{cellWidth:110}}});const chartY=Math.min(207,doc.lastAutoTable.finalY+8);barChart(doc,{x:12,y:chartY,w:90,h:64,name:'Synchronization status',entries:[['Synced',report.totals.synced],['Pending',report.totals.pending],['Failed',report.totals.failed]],c,color:c.primary});barChart(doc,{x:108,y:chartY,w:90,h:64,name:'Active senders',entries:senders,c,color:c.accent});

    const totalPages=doc.getNumberOfPages();for(let pageNumber=1;pageNumber<=totalPages;pageNumber++){doc.setPage(pageNumber);draw(doc,c.line);doc.line(page.margin,page.footerLine,page.right,page.footerLine);doc.setFont('helvetica','normal');doc.setFontSize(7);text(doc,c.muted);doc.text(`KSB LabelPrint · ${year} report`,page.margin,page.footerText);doc.text(`Page ${pageNumber} of ${totalPages}`,page.right,page.footerText,{align:'right'})}
    return{doc,report};
  }

  async function download(){
    if(button.disabled)return;
    const year=Math.trunc(Number(document.getElementById('monthlyYear')?.value)||ensureMonthlyYear()),label=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Preparing PDF…';
    try{await ensureLibraries();const {doc,report}=createReport(year),stamp=new Date().toISOString().slice(0,10).replace(/-/g,'');doc.save(`KSB-LabelPrint-Annual-Report-${year}-${stamp}.pdf`);toast(report.selected.length?`Visual ${year} PDF report downloaded`:`${year} PDF downloaded · no batches found`)}catch(error){console.error('PDF report download failed:',error);toast(`PDF download failed: ${error?.message||error}`)}finally{button.disabled=false;button.removeAttribute('aria-busy');button.textContent=label}
  }
  button.onclick=download;const warm=()=>ensureLibraries().catch(()=>{});button.addEventListener('pointerdown',warm,{once:true,passive:true});button.addEventListener('pointerenter',warm,{once:true,passive:true});button.addEventListener('touchstart',warm,{once:true,passive:true});button.addEventListener('focus',warm,{once:true,passive:true});
})();

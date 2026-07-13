(()=>{
  const button=document.getElementById('downloadMonthlyReport');
  const reportApi=window.LabelPrintReportExport;
  if(!button||!reportApi?.buildWorkbook)return;

  const safe=value=>{const text=clean(value);return /^[=+\-@]/.test(text)?`'${text}`:text};
  function addTrackingColumns(book,report){
    const XLSX=window.XLSX;
    const sheet=book?.Sheets?.['Label Detail'];
    if(!XLSX||!sheet)return;
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});
    if(!rows.length)return;
    const header=rows[0];
    const invoiceIndex=header.indexOf('Invoice number');
    if(invoiceIndex>=0)return;
    header.push('Invoice number','Courier','AWB / Resi');
    let rowIndex=1;
    (report?.selected||[]).forEach(batch=>{
      (batch.labels||[]).forEach(raw=>{
        const label=normalizeLabel(raw||{});
        const row=rows[rowIndex]||(rows[rowIndex]=[]);
        row.push(safe(label.invoice),safe(label.courier),safe(label.awb));
        rowIndex++;
      });
    });
    const next=XLSX.utils.aoa_to_sheet(rows);
    next['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,rows.length-1),c:Math.max(0,header.length-1)}})};
    next['!cols']=[...(sheet['!cols']||[]),{wch:22},{wch:14},{wch:24}];
    book.Sheets['Label Detail']=next;
  }

  function saveWorkbook(book,fileName){
    const XLSX=window.XLSX;
    const data=XLSX.write(book,{bookType:'xlsx',type:'array',compression:true});
    const blob=new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    if(navigator.msSaveOrOpenBlob){navigator.msSaveOrOpenBlob(blob,fileName);return}
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=fileName;anchor.rel='noopener';anchor.style.display='none';document.body.appendChild(anchor);
    requestAnimationFrame(()=>{anchor.click();setTimeout(()=>anchor.remove(),1000)});
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }

  button.onclick=async()=>{
    if(button.disabled)return;
    const original=button.textContent;
    const year=Math.trunc(Number(document.getElementById('monthlyYear')?.value)||new Date().getFullYear());
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    button.textContent='Preparing report…';
    try{
      await ensureXlsxLibrary();
      const result=reportApi.buildWorkbook(year);
      addTrackingColumns(result.book,result.report);
      const stamp=new Date().toISOString().slice(0,10).replace(/-/g,'');
      saveWorkbook(result.book,`KSB-LabelPrint-Monthly-Report-${year}-${stamp}.xlsx`);
      toast(result.report.selected.length?`Detailed ${year} report downloaded`:`${year} report downloaded · no batches found`);
    }catch(error){
      console.error('Monthly report download failed:',error);
      toast(`Report download failed: ${error?.message||error}`);
    }finally{
      button.disabled=false;
      button.removeAttribute('aria-busy');
      button.textContent=original;
    }
  };
})();
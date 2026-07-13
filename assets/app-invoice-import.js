(()=>{
  function invoiceDuplicateKey(row){
    const n=normalizeLabel(row);
    return[n.prefix,n.company,n.invoice,n.attn,n.phone,n.address,n.sender,n.courier,n.awb]
      .map(value=>clean(value).toUpperCase().replace(/\s+/g,' ')).join('|');
  }

  function importRowsWithInvoice(){
    const parsed=$('paste').value.split(/\r?\n/).filter(Boolean).map(line=>{
      const c=line.split('\t');
      const raw=(c[1]||'').trim();
      const companyMatch=raw.match(/^(PT|CV|YAYASAN)\.?\s+(.+)$/i);
      const addressAndPhone=(c[5]||'').trim();
      const phoneMatch=addressAndPhone.match(/\(([^()]*)\)\s*$/);
      return{
        prefix:companyMatch?companyMatch[1].toUpperCase():'',
        company:companyMatch?companyMatch[2]:raw,
        invoice:(c[2]||'').trim(),
        courier:(c[3]||'').trim()||'JNE',
        awb:(c[4]||'').trim(),
        attn:(c[6]||'').trim(),
        phone:phoneMatch?phoneMatch[1].trim():'',
        address:phoneMatch?addressAndPhone.slice(0,phoneMatch.index).trim():addressAndPhone,
        sender:'KSB INDONESIA'
      };
    }).map(normalizeLabel).map(applyRememberedPrefix).filter(row=>row.company&&!/^(penerima|recipient|company)$/i.test(row.company));

    if(!parsed.length)return toast('No valid rows detected');
    const seen=new Set();
    const unique=parsed.filter(row=>{const key=invoiceDuplicateKey(row);if(seen.has(key))return false;seen.add(key);return true});
    const duplicateCount=parsed.length-unique.length;
    const rows=unique.slice(0,MAX_LABELS);
    rows.forEach(row=>rememberCompanyPrefix(row,false));
    save(COMPANY_PREFIX_KEY,companyPrefixes);
    labels=rows;
    selected=0;
    save('ksb-labels',labels);
    closeModals();
    renderAll();

    const limited=unique.length>MAX_LABELS;
    const tracked=rows.filter(row=>clean(row.awb)).length;
    const invoiced=rows.filter(row=>clean(row.invoice)).length;
    let message=limited?`Imported first ${MAX_LABELS} of ${unique.length} unique labels`:`${rows.length} labels imported`;
    if(tracked)message+=` · ${tracked} AWB${tracked===1?'':'s'}`;
    if(invoiced)message+=` · ${invoiced} invoice${invoiced===1?'':'s'}`;
    if(duplicateCount)message+=` · ${duplicateCount} duplicate${duplicateCount===1?'':'s'} removed`;
    toast(message);
  }

  bulkDuplicateKey=invoiceDuplicateKey;
  importRows=importRowsWithInvoice;
  const button=$('importRows');
  if(button)button.onclick=importRowsWithInvoice;
})();

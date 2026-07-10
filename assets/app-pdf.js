(function(){
  const PAGE_W=297,PAGE_H=210,PT_TO_MM=25.4/72;
  const clean=v=>String(v??'').trim();
  const upper=v=>clean(v).toUpperCase();
  const fullName=r=>[clean(r?.prefix),clean(r?.company)].filter(Boolean).join(' ').trim().toUpperCase();
  const lineHeight=(fontSize,factor=1.12)=>fontSize*PT_TO_MM*factor;

  async function loadImageData(url){
    if(!url)return null;
    try{
      const response=await fetch(url,{cache:'force-cache',mode:'cors'});
      if(!response.ok)throw new Error('Logo request failed');
      const blob=await response.blob();
      return await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=reject;
        reader.readAsDataURL(blob);
      });
    }catch(error){
      console.warn('PDF logo fallback used:',error);
      return null;
    }
  }

  function measureBlock(doc,row,w,h,scale,leftPad,rightPad){
    const name=fullName(row)||' ';
    const attn=clean(row?.attn)?`ATTN: ${upper(row.attn)}`:' ';
    const phone=clean(row?.phone);
    const address=[upper(row?.address),phone?`(${upper(phone)})`:''].filter(Boolean).join(' ')||' ';
    const nameWidth=Math.max(10,w-leftPad-rightPad-25*scale);
    const bodyWidth=Math.max(10,w-leftPad-rightPad);
    const availableBottom=46.2*scale-1.4*scale;
    const nameTop=10.1*scale;

    for(let fit=1;fit>=.52;fit-=.02){
      const nameSize=9.7*scale*fit;
      const bodySize=8.2*scale*fit;
      doc.setFont('helvetica','bold');doc.setFontSize(nameSize);
      const nameLines=doc.splitTextToSize(name,nameWidth);
      doc.setFont('helvetica','bolditalic');doc.setFontSize(bodySize);
      const attnLines=doc.splitTextToSize(attn,bodyWidth);
      doc.setFont('helvetica','bold');doc.setFontSize(bodySize);
      const addressLines=doc.splitTextToSize(address,bodyWidth);
      const total=nameTop+nameLines.length*lineHeight(nameSize,1.08)+2.1*scale+attnLines.length*lineHeight(bodySize,1.1)+2.4*scale+addressLines.length*lineHeight(bodySize,1.18);
      if(total<=availableBottom||fit<=.54)return{fit,nameSize,bodySize,nameLines,attnLines,addressLines,nameTop};
    }
    return null;
  }

  function drawLines(doc,lines,x,y,size,style,factor){
    doc.setFont('helvetica',style);
    doc.setFontSize(size);
    const step=lineHeight(size,factor);
    lines.forEach((line,index)=>doc.text(String(line),x,y+index*step,{baseline:'top'}));
    return y+lines.length*step;
  }

  function drawLogo(doc,logoData,x,y,w,h,scale){
    if(logoData){
      try{doc.addImage(logoData,'PNG',x,y,w,h,undefined,'FAST');return}catch(error){console.warn('Unable to place PDF logo:',error)}
    }
    doc.setTextColor(55,55,55);
    doc.setFont('helvetica','bold');
    doc.setFontSize(16*scale);
    doc.text('KSB',x+w,y+h*.78,{align:'right'});
    doc.setTextColor(0,0,0);
  }

  function drawLabel(doc,row,x,y,w,h,logoData,layoutKey){
    const scale=Math.min(w/91,h/62);
    const leftPad=(layoutKey==='2x3'?7.5:6.6*scale);
    const rightPad=(layoutKey==='2x3'?7.5:6.6*scale);
    const inset=1.3*scale;

    doc.setDrawColor(0,0,0);
    doc.setFillColor(255,255,255);
    doc.setLineWidth(.65*scale);
    doc.rect(x,y,w,h,'FD');
    doc.setLineWidth(.35*scale);
    doc.rect(x+inset,y+inset,w-2*inset,h-2*inset,'S');

    const logoW=23*scale,logoH=7.4*scale;
    drawLogo(doc,logoData,x+w-5*scale-logoW,y+4.5*scale,logoW,logoH,scale);

    const block=measureBlock(doc,row,w,h,scale,leftPad,rightPad);
    const fit=block?.fit||1;
    doc.setTextColor(0,0,0);
    doc.setFont('helvetica','normal');
    doc.setFontSize(7.5*scale*fit);
    doc.text('Penerima :',x+leftPad,y+6.3*scale,{baseline:'top'});

    let cursor=y+(block?.nameTop||10.1*scale);
    cursor=drawLines(doc,block?.nameLines||[fullName(row)],x+leftPad,cursor,block?.nameSize||9.7*scale,'bold',1.08);
    cursor+=2.1*scale;
    cursor=drawLines(doc,block?.attnLines||[' '],x+leftPad,cursor,block?.bodySize||8.2*scale,'bolditalic',1.1);
    cursor+=2.4*scale;
    drawLines(doc,block?.addressLines||[' '],x+leftPad,cursor,block?.bodySize||8.2*scale,'bold',1.18);

    const dividerY=y+46.2*scale;
    doc.setLineWidth(.4*scale);
    doc.line(x+leftPad,dividerY,x+w-rightPad,dividerY);

    const senderTop=y+48.1*scale;
    doc.setFont('helvetica','normal');
    doc.setFontSize(7.5*scale*fit);
    doc.text('Pengirim :',x+leftPad,senderTop,{baseline:'top'});
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.2*scale*fit);
    const sender=upper(row?.sender)||'KSB INDONESIA';
    const senderLines=doc.splitTextToSize(sender,Math.max(10,w-leftPad-rightPad));
    senderLines.slice(0,2).forEach((line,index)=>doc.text(String(line),x+leftPad,senderTop+3.2*scale+index*lineHeight(8.2*scale*fit,1.05),{baseline:'top'}));
  }

  function normalizedFileName(value){
    return clean(value).replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()||'LABEL';
  }

  async function generateLabelPdf(options={}){
    const jspdf=window.jspdf;
    if(!jspdf?.jsPDF)throw new Error('PDF generator is unavailable');
    const rows=Array.isArray(options.rows)?options.rows:[];
    const def=options.layoutDef;
    if(!rows.length||!def)throw new Error('No printable labels');

    const doc=new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
    doc.setProperties({title:normalizedFileName(options.filename),subject:'KSB shipping labels',creator:'LabelPrint'});
    const logoData=await loadImageData(options.logoUrl);
    const gapX=options.layoutKey==='2x3'?2:4;
    const gapY=4;
    const gridW=def.c*def.w+(def.c-1)*gapX;
    const gridH=def.r*def.h+(def.r-1)*gapY;
    const startX=(PAGE_W-gridW)/2;
    const startY=(PAGE_H-gridH)/2;
    const pageCount=Math.max(1,Math.ceil(rows.length/def.n));

    for(let pageIndex=0;pageIndex<pageCount;pageIndex++){
      if(pageIndex)doc.addPage('a4','landscape');
      doc.setFillColor(255,255,255);doc.rect(0,0,PAGE_W,PAGE_H,'F');
      const chunk=rows.slice(pageIndex*def.n,(pageIndex+1)*def.n);
      chunk.forEach((row,index)=>{
        const col=index%def.c,rowIndex=Math.floor(index/def.c);
        const x=startX+col*(def.w+gapX),y=startY+rowIndex*(def.h+gapY);
        drawLabel(doc,row,x,y,def.w,def.h,logoData,options.layoutKey);
      });
    }

    const fileName=`${normalizedFileName(options.filename)}.pdf`;
    doc.save(fileName);
    return{fileName,pageCount};
  }

  window.generateLabelPdf=generateLabelPdf;
})();
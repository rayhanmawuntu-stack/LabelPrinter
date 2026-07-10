(function(){
  const logoUrl='https://file.garden/ad-wGPVIV3ilAD_L/WORK%20PROJECT/LABEL%20MAKER/KSB_SVG.svg.png';
  async function setYellowKsbFavicon(){
    try{
      const response=await fetch(logoUrl,{cache:'force-cache',mode:'cors'});
      if(!response.ok)return;
      const objectUrl=URL.createObjectURL(await response.blob());
      const image=new Image();
      image.onload=()=>{
        try{
          const size=256,padding=22;
          const canvas=document.createElement('canvas');
          canvas.width=size;
          canvas.height=size;
          const context=canvas.getContext('2d');
          context.fillStyle='#DFFF3F';
          context.fillRect(0,0,size,size);
          const scale=Math.min((size-padding*2)/image.naturalWidth,(size-padding*2)/image.naturalHeight);
          const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
          context.drawImage(image,(size-width)/2,(size-height)/2,width,height);
          const icon=canvas.toDataURL('image/png');
          document.querySelectorAll('link[rel~="icon"]').forEach(link=>{link.type='image/png';link.href=icon});
          const apple=document.querySelector('link[rel="apple-touch-icon"]');
          if(apple)apple.href=icon;
        }finally{URL.revokeObjectURL(objectUrl)}
      };
      image.onerror=()=>URL.revokeObjectURL(objectUrl);
      image.src=objectUrl;
    }catch(error){console.warn('KSB favicon could not be prepared:',error)}
  }
  setYellowKsbFavicon();
})();
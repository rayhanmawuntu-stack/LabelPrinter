(function(){
  const logoUrl='https://file.garden/ad-wGPVIV3ilAD_L/WORK%20PROJECT/LABEL%20MAKER/KSB_SVG.svg.png';
  const yellow='#DFFF3F';

  function applyFavicon(icon){
    let icons=[...document.querySelectorAll('link[rel~="icon"]')];
    if(!icons.length){
      const link=document.createElement('link');
      link.rel='icon';
      document.head.appendChild(link);
      icons=[link];
    }
    icons.forEach(link=>{link.type='image/png';link.href=icon});
    let apple=document.querySelector('link[rel="apple-touch-icon"]');
    if(!apple){
      apple=document.createElement('link');
      apple.rel='apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href=icon;
  }

  async function setBlackKsbYellowFavicon(){
    try{
      const response=await fetch(logoUrl,{cache:'force-cache',mode:'cors'});
      if(!response.ok)throw new Error(`Logo request failed (${response.status})`);
      const objectUrl=URL.createObjectURL(await response.blob());
      const image=new Image();
      image.onload=()=>{
        try{
          const size=256,padding=26;
          const canvas=document.createElement('canvas');
          const logoCanvas=document.createElement('canvas');
          canvas.width=canvas.height=size;
          logoCanvas.width=logoCanvas.height=size;

          const context=canvas.getContext('2d');
          const logoContext=logoCanvas.getContext('2d');
          const scale=Math.min((size-padding*2)/image.naturalWidth,(size-padding*2)/image.naturalHeight);
          const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
          const x=(size-width)/2,y=(size-height)/2;

          logoContext.clearRect(0,0,size,size);
          logoContext.drawImage(image,x,y,width,height);
          logoContext.globalCompositeOperation='source-in';
          logoContext.fillStyle='#000000';
          logoContext.fillRect(0,0,size,size);
          logoContext.globalCompositeOperation='source-over';

          context.fillStyle=yellow;
          context.fillRect(0,0,size,size);
          context.drawImage(logoCanvas,0,0);
          applyFavicon(canvas.toDataURL('image/png'));
        }finally{
          URL.revokeObjectURL(objectUrl);
        }
      };
      image.onerror=()=>{
        URL.revokeObjectURL(objectUrl);
        console.warn('KSB favicon logo could not be decoded');
      };
      image.src=objectUrl;
    }catch(error){
      console.warn('KSB favicon could not be prepared:',error);
    }
  }

  setBlackKsbYellowFavicon();
})();
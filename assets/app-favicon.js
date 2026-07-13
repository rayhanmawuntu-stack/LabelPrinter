(()=>{
  const logoUrl='https://file.garden/ad-wGPVIV3ilAD_L/WORK%20PROJECT/LABEL%20MAKER/KSB_SVG.svg.png';
  const renderedIcons=new Map();
  let imagePromise=null;
  let activeKey='';
  let refreshFrame=0;

  function applyFavicon(icon){
    let icons=[...document.querySelectorAll('link[rel~="icon"]')];
    if(!icons.length){
      const link=document.createElement('link');
      link.rel='icon';
      document.head.appendChild(link);
      icons=[link];
    }
    icons.forEach(link=>{
      link.type='image/png';
      link.href=icon;
    });

    let apple=document.querySelector('link[rel="apple-touch-icon"]');
    if(!apple){
      apple=document.createElement('link');
      apple.rel='apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href=icon;
  }

  function themeColors(){
    const styles=getComputedStyle(document.documentElement);
    const background=(styles.getPropertyValue('--theme-primary')||styles.getPropertyValue('--scheme-primary')||'#DFFF3F').trim();
    const foreground=(styles.getPropertyValue('--theme-on-primary')||styles.getPropertyValue('--scheme-on-primary')||'#111315').trim();
    return{background,foreground};
  }

  function loadLogo(){
    if(imagePromise)return imagePromise;
    imagePromise=(async()=>{
      const response=await fetch(logoUrl,{cache:'force-cache',mode:'cors'});
      if(!response.ok)throw new Error(`Logo request failed (${response.status})`);
      const objectUrl=URL.createObjectURL(await response.blob());
      try{
        return await new Promise((resolve,reject)=>{
          const image=new Image();
          image.onload=()=>resolve(image);
          image.onerror=()=>reject(new Error('KSB favicon logo could not be decoded'));
          image.src=objectUrl;
        });
      }finally{
        URL.revokeObjectURL(objectUrl);
      }
    })().catch(error=>{
      imagePromise=null;
      throw error;
    });
    return imagePromise;
  }

  async function renderThemedFavicon(){
    const{background,foreground}=themeColors();
    const key=`${background}|${foreground}`;
    if(key===activeKey)return;
    if(renderedIcons.has(key)){
      activeKey=key;
      applyFavicon(renderedIcons.get(key));
      return;
    }

    try{
      const image=await loadLogo();
      const size=256,padding=26;
      const canvas=document.createElement('canvas');
      const logoCanvas=document.createElement('canvas');
      canvas.width=canvas.height=size;
      logoCanvas.width=logoCanvas.height=size;

      const context=canvas.getContext('2d');
      const logoContext=logoCanvas.getContext('2d');
      if(!context||!logoContext)throw new Error('Canvas is unavailable');

      const scale=Math.min((size-padding*2)/image.naturalWidth,(size-padding*2)/image.naturalHeight);
      const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
      const x=(size-width)/2,y=(size-height)/2;

      logoContext.clearRect(0,0,size,size);
      logoContext.drawImage(image,x,y,width,height);
      logoContext.globalCompositeOperation='source-in';
      logoContext.fillStyle=foreground;
      logoContext.fillRect(0,0,size,size);
      logoContext.globalCompositeOperation='source-over';

      context.fillStyle=background;
      context.fillRect(0,0,size,size);
      context.drawImage(logoCanvas,0,0);

      const icon=canvas.toDataURL('image/png');
      renderedIcons.set(key,icon);
      activeKey=key;
      applyFavicon(icon);
    }catch(error){
      console.warn('KSB favicon could not be prepared:',error);
    }
  }

  function scheduleRefresh(){
    cancelAnimationFrame(refreshFrame);
    refreshFrame=requestAnimationFrame(()=>renderThemedFavicon());
  }

  window.addEventListener('labelprint:palettechange',scheduleRefresh);
  window.addEventListener('labelprint:themechange',scheduleRefresh);
  scheduleRefresh();
})();
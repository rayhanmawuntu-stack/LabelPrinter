(()=>{
  const KEY='ksb-color-scheme';
  const root=document.documentElement;
  const valid=new Set(['ksb','blood-mint','shilo-killarney','teal-coral','tokyo']);
  const themeColors={
    ksb:'#DFFF3F',
    'blood-mint':'#930507',
    'shilo-killarney':'#31553B',
    'teal-coral':'#015551',
    tokyo:'#283845'
  };

  function syncThemeColor(palette){
    const meta=document.querySelector('meta[name="theme-color"]');
    if(!meta)return;
    meta.content=root.dataset.theme==='dark'?'#0D1014':(themeColors[palette]||themeColors.ksb);
  }

  function applyPalette(value,persist=false){
    const palette=valid.has(value)?value:'ksb';
    root.dataset.palette=palette;
    document.querySelectorAll('[data-palette-option]').forEach(button=>{
      const active=button.dataset.paletteOption===palette;
      button.setAttribute('aria-pressed',String(active));
      button.classList.toggle('active',active);
    });
    syncThemeColor(palette);
    if(persist){
      try{localStorage.setItem(KEY,palette)}catch{}
      if(typeof toast==='function')toast('Color scheme updated');
    }
    window.dispatchEvent(new CustomEvent('labelprint:palettechange',{detail:{palette}}));
    return palette;
  }

  let saved='ksb';
  try{saved=localStorage.getItem(KEY)||root.dataset.palette||'ksb'}catch{}
  let current=applyPalette(saved);

  document.querySelectorAll('[data-palette-option]').forEach(button=>{
    button.addEventListener('click',()=>{current=applyPalette(button.dataset.paletteOption,true)});
  });
  window.addEventListener('labelprint:themechange',()=>syncThemeColor(current));

  window.LabelPrintPalette={apply:applyPalette,get:()=>current};
})();
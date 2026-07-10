(()=>{
  const KEY='ksb-color-scheme';
  const root=document.documentElement;
  const valid=new Set(['ksb','blood-mint','shilo-killarney','teal-coral','tokyo']);

  function applyPalette(value,persist=false){
    const palette=valid.has(value)?value:'ksb';
    root.dataset.palette=palette;
    document.querySelectorAll('[data-palette-option]').forEach(button=>{
      const active=button.dataset.paletteOption===palette;
      button.setAttribute('aria-pressed',String(active));
      button.classList.toggle('active',active);
    });
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

  window.LabelPrintPalette={apply:applyPalette,get:()=>current};
})();

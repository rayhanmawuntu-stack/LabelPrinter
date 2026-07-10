(()=>{
  const THEME_KEY='ksb-theme';
  const root=document.documentElement;
  const button=document.getElementById('themeToggle');
  const label=document.getElementById('themeLabel');
  const icon=button?.querySelector('.theme-icon');
  const optionButtons=[...document.querySelectorAll('[data-theme-option]')];

  function preferredTheme(){
    try{
      const saved=localStorage.getItem(THEME_KEY);
      if(saved==='dark'||saved==='light')return saved;
    }catch{}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
  }

  function syncControls(theme){
    const dark=theme==='dark';
    if(button){
      button.setAttribute('aria-pressed',String(dark));
      button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
      button.title=dark?'Switch to light mode':'Switch to dark mode';
    }
    if(label)label.textContent=dark?'Light mode':'Dark mode';
    if(icon)icon.textContent=dark?'☀':'☾';
    optionButtons.forEach(option=>{
      const active=option.dataset.themeOption===theme;
      option.setAttribute('aria-pressed',String(active));
      option.classList.toggle('active',active);
    });
  }

  function applyTheme(value,persist=false){
    const theme=value==='dark'?'dark':'light';
    root.dataset.theme=theme;
    root.style.colorScheme=theme;
    syncControls(theme);
    if(persist){
      try{localStorage.setItem(THEME_KEY,theme)}catch{}
    }
    window.dispatchEvent(new CustomEvent('labelprint:themechange',{detail:{theme}}));
    return theme;
  }

  let theme=applyTheme(root.dataset.theme||preferredTheme());
  button?.addEventListener('click',()=>{theme=applyTheme(theme==='dark'?'light':'dark',true)});
  optionButtons.forEach(option=>option.addEventListener('click',()=>{theme=applyTheme(option.dataset.themeOption,true)}));
  window.LabelPrintTheme={apply:applyTheme,get:()=>theme};
})();
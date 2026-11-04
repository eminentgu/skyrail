/* Resolve before CSS paints; keep the document, controls and pictures in sync. */
(() => {
 const root=document.documentElement,key='skyrail-docs-theme';
 const valid=value=>value==='dark'||value==='light';
 const read=()=>{try{const value=localStorage.getItem(key);return valid(value)?value:null}catch{return null}};
 let preference=read();
 const apply=()=>{
  const theme=preference||'dark';
  root.dataset.theme=theme;
  document.querySelectorAll('picture source[media]').forEach(source=>{
   source.dataset.themeMedia ||= source.media;
   if(source.dataset.themeMedia.includes('prefers-color-scheme'))source.media=theme==='dark'?'all':'not all';
  });
  const button=document.querySelector('button[data-theme]');
  if(button){const label=theme==='dark'?button.dataset.themeLight:button.dataset.themeDark;button.setAttribute('aria-pressed',String(theme==='dark'));if(label){button.setAttribute('aria-label',label);button.title=label}}
 };
 apply();
 document.addEventListener('DOMContentLoaded',()=>{
  apply();document.querySelector('button[data-theme]')?.addEventListener('click',()=>{
   preference=root.dataset.theme==='dark'?'light':'dark';
   try{localStorage.setItem(key,preference)}catch{}
   root.classList.add('theme-changing');apply();setTimeout(()=>root.classList.remove('theme-changing'),220);
  });
 });
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=read();apply()}});
})();

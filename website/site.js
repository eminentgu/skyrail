(() => {
 const body=document.body,lang=body.dataset.lang,base=body.dataset.base;
 const labels=lang==='zh'?{copy:'复制',copied:'已复制',empty:'没有匹配的文档，试试其他关键词。',initial:'输入关键词，搜索全部文档。'}:{copy:'Copy',copied:'Copied',empty:'No matching pages. Try another term.',initial:'Type to search the documentation.'};
 const navButton=document.querySelector('[data-nav]');
 const closeNav=()=>{body.classList.remove('nav-open');navButton?.setAttribute('aria-expanded','false')};
 navButton?.addEventListener('click',()=>{const open=body.classList.toggle('nav-open');navButton.setAttribute('aria-expanded',String(open));});
 document.querySelector('[data-nav-close]')?.addEventListener('click',closeNav);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav()});
 document.querySelectorAll('.copy-code').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.parentElement.querySelector('code').textContent);button.textContent=labels.copied;setTimeout(()=>button.textContent=labels.copy,1500)}catch{button.textContent=lang==='zh'?'请手动选择复制':'Select text to copy'}}));
 const search=document.querySelector('.search-dialog'),input=search?.querySelector('input'),results=search?.querySelector('.search-results');let records,pending,searchRevision=0;
 const loadSearch=()=>pending||=(fetch(base+'assets/search-index.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>records=data.filter(p=>p.lang===lang)).catch(()=>{pending=null;return null}));
 const empty=message=>{results.replaceChildren();const p=document.createElement('p');p.className='search-empty';p.textContent=message;results.append(p)};
 const renderSearch=async()=>{const revision=++searchRevision,q=input.value.trim().toLocaleLowerCase();if(!q){empty(labels.initial);return}const data=await loadSearch();if(revision!==searchRevision)return;if(!data){empty(lang==='zh'?'搜索索引暂时不可用，请使用左侧导航。':'Search is unavailable. Please use the navigation.');return}
 const terms=q.split(/\s+/),ranked=data.map(p=>{const hay=(p.title+' '+p.description+' '+p.text).toLocaleLowerCase();return{p,score:terms.every(t=>hay.includes(t))?terms.reduce((n,t)=>n+(p.title.toLocaleLowerCase().includes(t)?8:1),0):0}}).filter(r=>r.score).sort((a,b)=>b.score-a.score).slice(0,9);results.replaceChildren();if(!ranked.length){empty(labels.empty);return}for(const {p} of ranked){const a=document.createElement('a');a.href=p.url;const title=document.createElement('strong');title.textContent=p.title;const sub=document.createElement('p');sub.textContent=p.description;a.append(title,sub);results.append(a)}};
 const openSearch=()=>{if(!search.open)search.showModal();closeNav();input.focus();renderSearch();loadSearch()};
 document.querySelectorAll('[data-search]').forEach(button=>button.addEventListener('click',openSearch));
 document.querySelector('[data-search-close]')?.addEventListener('click',()=>search.close());
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch()}});
 input?.addEventListener('input',renderSearch);input?.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('a')?.focus()}if(e.key==='Enter')results.querySelector('a')?.click()});
 search?.addEventListener('click',e=>{if(e.target===search)search.close()});
 const viewer=document.querySelector('.image-dialog');
 document.querySelectorAll('.prose figure img,.page-cover img,.story-image>img,.diagram-section img,.remote-demo-image>img').forEach(img=>{img.tabIndex=0;img.style.cursor='zoom-in';img.setAttribute('aria-label',(lang==='zh'?'放大图片：':'Expand image: ')+img.alt);const show=()=>{viewer.querySelector('img').src=img.currentSrc||img.src;viewer.querySelector('img').alt=img.alt;viewer.querySelector('p').textContent=img.alt;viewer.showModal()};img.addEventListener('click',show);img.addEventListener('keydown',e=>{if(e.key==='Enter')show()})});
 document.querySelector('[data-image-close]')?.addEventListener('click',()=>viewer.close());viewer?.addEventListener('click',e=>{if(e.target===viewer)viewer.close()});
 const headings=document.querySelectorAll('.prose h2,.prose h3');if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){document.querySelectorAll('.toc a.active').forEach(a=>a.classList.remove('active'));const target=Array.from(document.querySelectorAll('.toc a')).find(a=>a.hash==='#'+entry.target.id||decodeURIComponent(a.hash)==='#'+entry.target.id);target?.classList.add('active')}},{rootMargin:'-90px 0px -70% 0px'});headings.forEach(h=>observer.observe(h));}
})();

/* Detail tabs work with pointer, touch and the standard tab-list arrow keys. */
(() => {
 const tabs=Array.from(document.querySelectorAll('.tuning-tabs [role="tab"]'));
 const activate=tab=>{
  for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!selected}
 };
 tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>activate(tab));
  tab.addEventListener('keydown',event=>{
   const next=event.key==='ArrowRight'?(i+1)%tabs.length:event.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
   if(next!==null){event.preventDefault();activate(tabs[next]);tabs[next].focus()}
  });
 });
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 if('IntersectionObserver' in window&&!motion.matches){
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.remove('reveal-pending');observer.unobserve(entry.target)}},{threshold:0.08});
  const targets=document.querySelectorAll('.connection-wrap,.remote-showcase,.intro-section,.story,.tuning-section,.local-section,.diagram-section,.docs-section,.faq-section,.closing');
  targets.forEach(target=>{target.classList.add('reveal-pending');observer.observe(target)});
  motion.addEventListener('change',()=>{if(motion.matches){targets.forEach(target=>target.classList.remove('reveal-pending'));observer.disconnect()}});
 }
})();

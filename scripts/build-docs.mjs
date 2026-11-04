import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import path from 'node:path';
import {micromark} from 'micromark';
import {gfm,gfmHtml} from 'micromark-extension-gfm';
import {pages,repository} from '../website/catalog.mjs';
import {copy} from '../website/copy.mjs';
import {shell,landing,route,escape,icon} from '../website/templates.mjs';
const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(process.env.DOCS_OUT_DIR||path.join(root,'docs-dist'));
if(out===root||out===path.parse(out).root||root.startsWith(out+path.sep))throw Error('Unsafe docs output directory');
const site=new URL(process.env.SITE_URL||'https://eminentgu.github.io/skyrail/');
if(!['https:','http:'].includes(site.protocol))throw Error('SITE_URL must be HTTP(S)');
site.pathname=site.pathname.replace(/\/?$/,'/');site.search='';site.hash='';
const base=site.pathname;
await rm(out,{recursive:true,force:true});await mkdir(path.join(out,'assets'),{recursive:true});
await cp(path.join(root,'docs/assets'),path.join(out,'assets'),{recursive:true});
await cp(path.join(root,'website/site.css'),path.join(out,'assets/site.css'));
await cp(path.join(root,'website/site.js'),path.join(out,'assets/site.js'));
await cp(path.join(root,'website/theme.js'),path.join(out,'assets/theme.js'));
await writeFile(path.join(out,'assets/favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#e5eff5"/><path d="m9 30 15-21m-7 21L31 10M7 21h11" stroke="#294a60" stroke-width="3" stroke-linecap="round"/></svg>');
const clean=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
const slug=s=>clean(s).toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s/g,'-');
const sourceMap=new Map();for(const p of pages)for(const lang of ['en','zh'])sourceMap.set(p[lang],p.id);
function targetLink(raw,source,lang){
 if(/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(raw))return raw;
 const decoded=raw.replaceAll('&amp;','&');const [part,...fragments]=decoded.split('#');
 const file=path.posix.normalize(path.posix.join(path.posix.dirname(source),part));
 if(file.startsWith('docs/assets/'))return base+'assets/'+file.slice('docs/assets/'.length)+(fragments.length?'#'+fragments.join('#'):'');
 if(file==='README.md'||file==='README.zh-CN.md')return route(base,file.includes('zh-CN')?'zh':'en')+(fragments.length?'#'+fragments.join('#'):'');
 const page=sourceMap.get(file);
 if(page){const preferred=/\.zh-CN\.md$/.test(file)?'zh':pages.find(p=>p.id===page)?.en!==pages.find(p=>p.id===page)?.zh?'en':lang;return route(base,preferred,page)+(fragments.length?'#'+fragments.join('#'):'');}
 return repository+'/blob/main/'+file+(fragments.length?'#'+fragments.join('#'):'');
}
function render(source,text,lang){
 // The website supplies the breadcrumb, language control and primary title.
 text=text.replace(/^\*\*\[Skyrail\][^\n]*\*\*\s*\n/,'').replace(/^#[^\n]*\n/m,'').replace(/^\[(?:English|简体中文)\][^\n]*\n/m,'');
 text=text.replace(/^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\n((?:>[^\n]*(?:\n|$))+)/gm,(_,type,body)=>`<aside class="callout ${type.toLowerCase()}"><span>${type}</span>\n\n${body.replace(/^> ?/gm,'').trim()}\n\n</aside>\n`);
 let html=micromark(text,{allowDangerousHtml:true,extensions:[gfm()],htmlExtensions:[gfmHtml()]});
 html=html.replace(/\b(href|src|srcset)="([^"]+)"/g,(_,attr,link)=>`${attr}="${escape(targetLink(link,source,lang))}"`);
 const counts=new Map(),toc=[];
 html=html.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/g,(_,level,inner)=>{const original=slug(inner),count=counts.get(original)||0;counts.set(original,count+1);const id=original+(count?'-'+count:'');toc.push({id,text:clean(inner),level:Number(level)});return `<h${level} id="${id}">${inner}<a class="heading-anchor" href="#${id}" aria-label="${lang==='zh'?'本节链接':'Link to section'}">#</a></h${level}>`;});
 // Figures keep images useful and captions visible in every guide.
 html=html.replace(/<p>\s*(<img\b[^>]+>)\s*<\/p>/g,(_,img)=>{const alt=img.match(/alt="([^"]*)"/)?.[1]||'';return `<figure class="doc-figure">${img.replace('<img ','<img loading="lazy" ')}<figcaption>${alt}</figcaption></figure>`;});
 html=html.replace(/<table>/g,'<div class="table-scroll"><table>').replace(/<\/table>/g,'</table></div>');
 html=html.replace(/<pre><code([^>]*)>/g,`<div class="code-block"><button class="copy-code" type="button">${copy[lang].copy}</button><pre><code$1>`).replace(/<\/code><\/pre>/g,'</code></pre></div>');
 return{html,toc};
}
async function put(url,content){const relative=url.slice(base.length);const filename=path.join(out,relative,'index.html');await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename,content);}
const index=[],urls=[];
for(const lang of ['en','zh']){
 await put(route(base,lang),landing({lang,base,site}));urls.push(route(base,lang));
 for(let i=0;i<pages.length;i++){
  const p=pages[i],c=copy[lang],source=p[lang],title=p.title[lang==='zh'?1:0],description=p.description[lang==='zh'?1:0];
  const markdown=await readFile(path.join(root,source),'utf8'),{html,toc}=render(source,markdown,lang);
  const previous=pages[i-1],next=pages[i+1];
  const cover=(!p.cover||markdown.includes(p.cover+'-')||p.cover==='workspace'&&markdown.includes('workspace-example.png'))?'':p.cover==='workspace'?`<figure class="page-cover screenshot"><img src="${base}assets/workspace-example.png" alt="${c.demo}" width="1280" height="720"><figcaption>${c.demo}</figcaption></figure>`:p.cover?`<figure class="page-cover"><img src="${base}assets/${p.cover}-${lang}.svg" alt="${escape(description)}" width="1200" height="370"></figure>`:'';
  const content=`<main class="docs-main" id="main"><div class="doc-breadcrumb"><a href="${route(base,lang)}">Skyrail</a><span>/</span><a href="${route(base,lang,'overview')}">${c.docs}</a></div><header class="doc-heading"><span class="eyebrow">${lang==='zh'?'使用手册':'THE FIELD GUIDE'}</span><h1>${escape(title)}</h1><p>${escape(description)}</p><a class="source-note" href="${repository}/blob/main/${source}">${c.source} ↗</a></header>${cover}${p.original&&p.original!==lang?`<aside class="original-note">${c.original}</aside>`:''}<article class="prose" ${p.original?'lang="'+(p.original==='zh'?'zh-CN':'en')+'"':''}>${html}</article><nav class="page-pagination" aria-label="${lang==='zh'?'文档导航':'Document navigation'}">${previous?`<a href="${route(base,lang,previous.id)}"><span>← ${c.prev}</span><strong>${previous.title[lang==='zh'?1:0]}</strong></a>`:'<span></span>'}${next?`<a href="${route(base,lang,next.id)}"><span>${c.next} →</span><strong>${next.title[lang==='zh'?1:0]}</strong></a>`:''}</nav></main>`;
  await put(route(base,lang,p.id),shell({lang,base,site,title,description,content,kind:'docs',id:p.id,toc,source}));
  index.push({lang,title,description,url:route(base,lang,p.id),text:clean(html).replace(/\s+/g,' ')});urls.push(route(base,lang,p.id));
 }
}
await writeFile(path.join(out,'assets/search-index.json'),JSON.stringify(index));
await writeFile(path.join(out,'llms.txt'),(await readFile(path.join(root,'llms.txt'),'utf8'))+'\n## Website\n\n- [English documentation]('+new URL(route(base,'en','overview'),site)+')\n- [中文文档]('+new URL(route(base,'zh','overview'),site)+')\n');
await writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>`<url><loc>${escape(new URL(url,site).href)}</loc></url>`).join('')+'</urlset>');
await writeFile(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: '+new URL(base+'sitemap.xml',site)+'\n');
await writeFile(path.join(out,'.nojekyll'),'');
await writeFile(path.join(out,'404.html'),shell({lang:'en',base,site,title:'Page not found',description:'Return to Skyrail documentation.',kind:'landing',content:`<main class="not-found" id="main"><span class="eyebrow">404 / SKYRAIL</span><h1>This path ends here.</h1><p>Find your next step in the documentation.</p><a class="button primary" href="${route(base,'en','overview')}">Open documentation ${icon('arrow')}</a></main>`}));
console.log(`Built ${urls.length} pages in ${path.relative(root,out)} for ${site.href}`);

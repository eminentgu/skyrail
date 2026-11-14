import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
let temp,out,files,htmls;
async function walk(dir){const result=[];for(const file of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())result.push(...await walk(full));else result.push(full)}return result}
before(async()=>{temp=await mkdtemp(path.join(os.tmpdir(),'skyrail-docs-'));out=path.join(temp,'site');execFileSync(process.execPath,['scripts/build-docs.mjs'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,DOCS_OUT_DIR:out,SITE_URL:'https://example.test/skyrail/'},stdio:'pipe'});files=await walk(out);htmls=await Promise.all(files.filter(f=>f.endsWith('.html')).map(async file=>({file,html:await readFile(file,'utf8')})))});
after(async()=>{if(temp)await rm(temp,{recursive:true,force:true})});
test('static documentation publishes bilingual routes with correct project-base links',()=>{assert.equal(htmls.length,39);for(const {html,file} of htmls){assert.match(html,/<html lang="(?:en|zh-CN)"/);assert.match(html,/rel="canonical"/);assert.match(html,/hreflang="en"/);assert.match(html,/hreflang="zh-CN"/);assert.match(html,/rel="canonical" href="https:\/\/example\.test\/skyrail\//,file)}});
test('every generated internal document and image link resolves inside the static output',async()=>{const all=new Set(files),errors=[];for(const {file,html} of htmls){for(const match of html.matchAll(/\b(?:href|src|srcset)="([^"]+)"/g)){const url=match[1].replaceAll('&amp;','&');if(/^(?:[a-z][a-z\d+.-]*:|#)/i.test(url))continue;assert.ok(url.startsWith('/skyrail/'),`${file}: ${url}`);let target=path.join(out,decodeURIComponent(url.split(/[?#]/)[0].slice('/skyrail/'.length)));if(url.split(/[?#]/)[0].endsWith('/'))target=path.join(target,'index.html');if(!all.has(target))errors.push(`${path.relative(out,file)} -> ${url}`)}}assert.deepEqual(errors,[])});
test('local runtime data and source executables are excluded from the public artifact',()=>{for(const file of files){const rel=path.relative(out,file);assert.ok(!/(^|\/)(?:\.data|workspaces|node_modules|\.git|apps|packages)(\/|$)/.test(rel),rel);assert.ok(!/remote-access\.txt|threads\.json|permissions\.json|SkyrailMac/.test(rel),rel)}assert.ok(files.some(f=>f.endsWith('sitemap.xml')));assert.ok(files.some(f=>f.endsWith('llms.txt')))});
test('search indexes complete documentation in both languages without dropping long records',async()=>{const data=JSON.parse(await readFile(path.join(out,'assets/search-index.json'),'utf8'));assert.equal(data.length,36);for(const lang of ['en','zh']){const pages=data.filter(p=>p.lang===lang);assert.equal(pages.length,18);assert.ok(pages.some(p=>p.url.endsWith('/docs/visual-guide/')));assert.ok(pages.find(p=>p.url.endsWith('/docs/validation/')).text.length>10000)}});
test('site chrome exposes keyboard-accessible search, theme, navigation and image controls',()=>{for(const {html} of htmls){assert.match(html,/data-search/);assert.match(html,/data-theme/);assert.match(html,/class="search-dialog"/);assert.match(html,/class="image-dialog"/);assert.match(html,/class="skip-link"/)}const guide=htmls.find(p=>p.file.endsWith(path.join('zh','docs','getting-started','index.html'))).html;assert.match(guide,/class="copy-code"/);assert.match(guide,/class="doc-figure"/);assert.match(guide,/class="callout tip"/)});

test('custom-domain root emits resolvable assets and canonical URLs without the project prefix',async()=>{const custom=path.join(temp,'custom');execFileSync(process.execPath,['scripts/build-docs.mjs'],{env:{...process.env,DOCS_OUT_DIR:custom,SITE_URL:'https://docs.example.test'},stdio:'pipe'});const all=new Set(await walk(custom));for(const file of all){if(!file.endsWith('.html'))continue;const html=await readFile(file,'utf8');assert.match(html,/rel="canonical" href="https:\/\/docs\.example\.test\//);assert.doesNotMatch(html,/\b(?:src|href)="\/skyrail\//);assert.doesNotMatch(html,/src="[^" ]*main\.tsx/);for(const [,url] of html.matchAll(/\b(?:href|src)="(\/[^" ]*)"/g)){let target=path.join(custom,decodeURIComponent(url.split(/[?#]/)[0]));if(url.split(/[?#]/)[0].endsWith('/'))target=path.join(target,'index.html');assert.ok(all.has(target),file+': '+url)}}});

test('styles and behavior carry one content-based revision across every page',()=>{const revisions=new Set();for(const {html} of htmls){for(const name of ['site.css','site.js','theme.js']){const match=html.match(new RegExp('assets/'+name.replace('.','\\.')+'\\?v=([a-f0-9]{12})'));assert.ok(match,name);revisions.add(match[1])}}assert.equal(revisions.size,1)});

test('landing uses current raster product captures with accurate demo boundaries',async()=>{
 for(const lang of ['en','zh']){
  const file=path.join(out,lang==='zh'?'zh':'','index.html');
  const html=await readFile(file,'utf8');
  assert.ok(html.includes('product-desktop-'+lang+'.jpg'));
  assert.ok(html.includes('product-mobile-'+lang+'.jpg'));
  assert.ok(html.includes('chrome-studio-'+lang+'.jpg'));
  assert.ok(!html.includes('product-desktop-'+(lang==='en'?'zh':'en')+'.jpg'));
  assert.doesNotMatch(html,/recorded official Calculator observation|已记录的官方计算器观察/);
  assert.doesNotMatch(html,/remote-demo-(?:en|zh)\.svg/);
  assert.match(html,lang==='zh'?/非 iPhone 实机验收/:/not iPhone device acceptance/);
 }
 const manifest=JSON.parse(await readFile(path.join(out,'assets/product-captures.json'),'utf8'));
 assert.equal(manifest.files.length,6);
 assert.equal(manifest.desktop,'Floating Chrome window in both locales.');
 for(const locale of ['en','zh'])assert.deepEqual(manifest.files.filter(f=>f.locale===locale).map(f=>f.kind).sort(),['chrome-studio','product-desktop','product-mobile']);
 const {createHash}=await import('node:crypto');
 for(const entry of manifest.files){
  const bytes=await readFile(path.join(out,'assets',entry.file));
  assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 }
});

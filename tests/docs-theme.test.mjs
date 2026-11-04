import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../website/theme.js',import.meta.url),'utf8');
function browser({stored=null,dark=false,denied=false}={}){
 const listeners={},documentListeners={},rootListeners={},buttonListeners={},attributes={};
 const root={dataset:{},classList:{add(){},remove(){}},addEventListener:(name,fn)=>rootListeners[name]=fn};
 const button={dataset:{themeLight:'Use light',themeDark:'Use dark'},setAttribute:(key,value)=>attributes[key]=value,addEventListener:(name,fn)=>buttonListeners[name]=fn};
 const source={dataset:{},media:'(prefers-color-scheme:dark)'};
 const media={matches:dark,addEventListener:(name,fn)=>listeners['media:'+name]=fn};
 const document={documentElement:root,querySelector:selector=>selector==='button[data-theme]'?button:selector==='[data-theme]'&&root.dataset.theme?root:null,querySelectorAll:()=>[source],addEventListener:(name,fn)=>documentListeners[name]=fn};
 const storage={value:stored,getItem(){if(denied)throw Error('Storage blocked');return this.value},setItem(_key,value){if(denied)throw Error('Storage blocked');this.value=value}};
 vm.runInNewContext(code,{document,localStorage:storage,matchMedia:()=>media,window:{addEventListener:(name,fn)=>listeners[name]=fn},setTimeout:fn=>fn()});
 // The root theme exists before DOMContentLoaded, exactly as in the browser.
 documentListeners.DOMContentLoaded();
 return{root,rootListeners,buttonListeners,attributes,source,media,storage,listeners};
}
test('first visit defaults to dark and clicks bind only to the actual theme button',()=>{
 const b=browser({dark:false});assert.equal(b.root.dataset.theme,'dark');assert.equal(b.rootListeners.click,undefined);assert.equal(typeof b.buttonListeners.click,'function');assert.equal(b.source.media,'all');b.buttonListeners.click();assert.equal(b.root.dataset.theme,'light');assert.equal(b.storage.value,'light');assert.equal(b.attributes['aria-label'],'Use dark');assert.equal(b.source.media,'not all');b.buttonListeners.click();assert.equal(b.source.media,'all');assert.equal(b.attributes['aria-pressed'],'true');
});
test('explicit light selection survives navigation and overrides the default',()=>{
 const b=browser({stored:'light',dark:true});assert.equal(b.root.dataset.theme,'light');assert.equal(b.source.media,'not all');assert.equal(browser({stored:b.storage.value}).root.dataset.theme,'light');
});
test('unset or invalid preferences always use dark, independent of system appearance',()=>{
 for(const stored of [null,'invalid'])for(const dark of [true,false]){const b=browser({stored,dark});assert.equal(b.root.dataset.theme,'dark');assert.equal(b.source.media,'all')}
});
test('cross-tab preference changes synchronize pictures; clearing restores the dark default',()=>{
 const b=browser();b.storage.value='light';b.listeners.storage({key:'skyrail-docs-theme'});assert.equal(b.root.dataset.theme,'light');assert.equal(b.source.media,'not all');b.storage.value=null;b.listeners.storage({key:null});assert.equal(b.root.dataset.theme,'dark');assert.equal(b.attributes['aria-label'],'Use light');
});
test('theme remains usable when browser storage is blocked',()=>{
 const b=browser({denied:true,dark:false});assert.equal(b.root.dataset.theme,'dark');b.buttonListeners.click();assert.equal(b.root.dataset.theme,'light');
});

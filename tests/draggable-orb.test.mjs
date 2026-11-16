import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../apps/client/src/useDraggableOrb.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(saved){
 const slots=[],effects=[],storage=new Map(saved?[['skyrail.computer-orb-position',JSON.stringify(saved)]]:[]);
 const window=new EventTarget(),viewport=new EventTarget();Object.assign(viewport,{width:800,height:600,offsetLeft:0,offsetTop:0});window.visualViewport=viewport;
 let cursor=0,output,toggles=0,dirty=true;
 const button={getBoundingClientRect:()=>({left:output?.style?.left??14,top:output?.style?.top??530,width:52,height:52}),setPointerCapture(){}};
 const hooks={useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return[slots[i].value,v=>{slots[i].value=v;dirty=true}]},useRef(initial){const i=cursor++;return slots[i]??={current:initial}},useEffect(effect){const i=cursor++;if(!slots[i]){slots[i]={mounted:true};effects.push(effect)}}};
 const exports={};vm.runInNewContext(code,{exports,require:()=>hooks,window,innerWidth:800,innerHeight:600,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}});
 function render(){for(let i=0;dirty;i++){assert.ok(i<10);dirty=false;cursor=0;output=exports.useDraggableOrb({current:button},()=>toggles++);for(const effect of effects.splice(0))effect();}}
 render();
 const event=(x,y,id=1)=>({button:0,pointerId:id,clientX:x,clientY:y,currentTarget:button,preventDefault(){this.prevented=true},stopPropagation(){}});
 return{get output(){return output},get toggles(){return toggles},viewport,storage,render,event};
}
test('orb tap and keyboard activation toggle once without persisting tiny finger jitter',()=>{
 const f=fixture();f.output.onPointerDown(f.event(30,550));f.output.onPointerMove(f.event(33,551));f.output.onPointerUp(f.event(33,551));
 f.output.onClick({detail:1});assert.equal(f.toggles,1);assert.equal(f.storage.size,0);
 f.output.onClick({detail:0});assert.equal(f.toggles,2);
});
test('orb drag moves and persists, suppresses its click, then accepts the next tap',()=>{
 const f=fixture();f.output.onPointerDown(f.event(30,550));f.output.onPointerMove(f.event(630,210));f.render();
 f.output.onPointerUp(f.event(630,210));f.output.onLostPointerCapture();
 f.output.onClick({detail:1,preventDefault(){},stopPropagation(){}});assert.equal(f.toggles,0);
 assert.equal(f.output.style.left,614);assert.equal(f.output.style.top,190);
 const saved=JSON.parse(f.storage.get('skyrail.computer-orb-position'));assert.equal(saved.left,614);
 f.output.onPointerDown(f.event(630,210,2));f.output.onPointerUp(f.event(630,210,2));f.output.onClick({detail:1});assert.equal(f.toggles,1);
});
test('viewport changes keep a moved orb reachable without toggling the computer',()=>{
 const f=fixture({left:700,top:500});f.viewport.width=350;f.viewport.height=280;f.viewport.offsetTop=80;
 f.viewport.dispatchEvent(new Event('resize'));f.render();
 assert.equal(f.output.style.left,290);assert.equal(f.output.style.top,300);assert.equal(f.toggles,0);
 f.output.onPointerDown(f.event(310,320));f.output.onPointerMove(f.event(0,0));f.render();f.output.onPointerCancel();
 f.output.onClick({detail:0});assert.equal(f.toggles,1,'cancelled drag must not eat keyboard activation');
});

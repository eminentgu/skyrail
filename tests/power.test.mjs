import {test} from 'node:test';import assert from 'node:assert/strict';import{EventEmitter}from'node:events';
import{MacPower}from'../packages/macos/power.mjs';
function fixture(options={}){
 const calls=[];let kills=0;
 const power=new MacPower({platform:'darwin',...options,launch:(file,args)=>{calls.push({file,args});const child=new EventEmitter();child.kill=()=>{kills++;child.emit('exit')};child.unref=()=>{};return child}});
 return{power,calls,kills:()=>kills};
}
test('remote activity wakes and holds the display only for the active session',()=>{const f=fixture();f.power.setActive(true);f.power.setActive(true);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].args,['-d','-u','-i','-w',String(process.pid)]);f.power.setActive(false);assert.equal(f.kills(),1);f.power.setActive(true);assert.equal(f.calls.length,2);f.power.close();assert.equal(f.kills(),2);f.power.setActive(true);assert.equal(f.calls.length,2)});
test('headless mode keeps CPU awake without requesting physical display wake',()=>{const f=fixture({wakeDisplay:false});f.power.setActive(true);assert.deepEqual(f.calls[0].args,['-i','-w',String(process.pid)]);f.power.close()});
test('failed snapshot releases its temporary power hold',async()=>{const f=fixture({wakeDisplay:false});await assert.rejects(f.power.withCapture(async()=>{throw Error('capture failed')}));assert.equal(f.calls.length,1);assert.equal(f.kills(),1);assert.equal(f.power.captures,0)});
test('snapshot does not release the hold needed by another active viewer',async()=>{const f=fixture({wakeDisplay:false});f.power.setActive(true);await f.power.withCapture(async()=>{});assert.equal(f.kills(),0);f.power.setActive(false);assert.equal(f.kills(),1)});
test('non-Mac tests do not launch a system power utility',()=>{const f=fixture({platform:'linux'});f.power.setActive(true);assert.equal(f.calls.length,0)});

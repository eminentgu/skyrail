import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FrameDecoder,MacStream} from '../packages/macos/stream.mjs';
const packet=b=>{const size=Buffer.alloc(4);size.writeUInt32BE(b.length);return Buffer.concat([size,b])};
test('native decoder handles split headers and multiple frames without corruption',()=>{const d=new FrameDecoder();const a=Buffer.from('jpeg-one'),b=Buffer.from('jpeg-two');const bytes=Buffer.concat([packet(a),packet(b)]);assert.deepEqual(d.push(bytes.subarray(0,2)),[]);assert.deepEqual(d.push(bytes.subarray(2,8)),[]);assert.deepEqual(d.push(bytes.subarray(8)),[a,b]);assert.equal(d.buffer.length,0)});
test('native decoder rejects unbounded frame allocation',()=>{const b=Buffer.alloc(4);b.writeUInt32BE(32*1024*1024);assert.throws(()=>new FrameDecoder().push(b))});
test('slow viewers drop frames instead of buffering old video',()=>{const s=new MacStream('/tmp');let writes=0;s.write({destroyed:false,writableNeedDrain:true,write:()=>writes++},Buffer.from('frame'));assert.equal(writes,0)});
test('reselect closes old viewers and removes cached pixels',()=>{const s=new MacStream('/tmp');let ended=false;s.clients.add({end:()=>ended=true});s.latest=Buffer.from('old');s.select('new',42);assert.equal(ended,true);assert.equal(s.latest,null);assert.equal(s.app,'new');assert.equal(s.windowId,42);assert.equal(s.clients.size,0)});

import {PassThrough} from 'node:stream';
function recoveryFixture(rpc){
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('exit');
 const bridge={rpc,child:{kill(){}}};const chunks=[];
 const stream=new MacStream('/tmp',{spawnNative:()=>child,makeSnapshotBridge:()=>bridge});
 stream.app='selected';stream.windowId=7;stream.clients.add({write:chunk=>chunks.push(chunk),end(){}});
 return{stream,child,chunks};
}
import {EventEmitter} from 'node:events';
test('video recovery streams window PNG frames without accepting late native frames',async()=>{
 const calls=[];const f=recoveryFixture(async(method,args)=>{calls.push({method,args});return{image:'data:image/png;base64,'+Buffer.from('fresh-png').toString('base64')}});
 f.stream.start();f.stream.fallback(f.stream.generation,'no native frames');await new Promise(setImmediate);
 assert.equal(f.stream.state.status,'live');assert.equal(f.stream.state.captureMode,'window-snapshots');assert.equal(f.stream.latest.toString(),'fresh-png');assert.equal(calls[0].method,'observe');assert.equal(calls[0].args.app,'selected');
 f.child.stdout.write(packet(Buffer.from('late-jpeg')));assert.equal(f.stream.latest.toString(),'fresh-png');assert.match(f.chunks[0],/Content-Type: image\/png/);f.stream.stop();
});
test('reselection discards an in-flight recovery frame from the previous window',async()=>{
 let complete;const f=recoveryFixture(()=>new Promise(r=>complete=r));f.stream.start();f.stream.fallback(f.stream.generation,'no frames');f.stream.select('new-app',8);complete({image:'data:image/png;base64,'+Buffer.from('old').toString('base64')});await new Promise(setImmediate);assert.equal(f.stream.latest,null);assert.equal(f.stream.app,'new-app');assert.equal(f.stream.state.frames,0);f.stream.stop();
});
test('capture recovery errors disconnect instead of displaying cached pixels',async()=>{
 const f=recoveryFixture(async()=>{throw Error('Mac 当前已锁屏')});f.stream.start();f.stream.fallback(f.stream.generation,'no video');await new Promise(setImmediate);assert.equal(f.stream.state.status,'disconnected');assert.match(f.stream.state.error,/已锁屏/);assert.equal(f.stream.latest,null);f.stream.stop();
});

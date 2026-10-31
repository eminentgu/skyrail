import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FrameDecoder,MacStream} from '../packages/macos/stream.mjs';
const packet=b=>{const size=Buffer.alloc(4);size.writeUInt32BE(b.length);return Buffer.concat([size,b])};
test('native decoder handles split headers and multiple frames without corruption',()=>{const d=new FrameDecoder();const a=Buffer.from('jpeg-one'),b=Buffer.from('jpeg-two');const bytes=Buffer.concat([packet(a),packet(b)]);assert.deepEqual(d.push(bytes.subarray(0,2)),[]);assert.deepEqual(d.push(bytes.subarray(2,8)),[]);assert.deepEqual(d.push(bytes.subarray(8)),[a,b]);assert.equal(d.buffer.length,0)});
test('native decoder rejects unbounded frame allocation',()=>{const b=Buffer.alloc(4);b.writeUInt32BE(32*1024*1024);assert.throws(()=>new FrameDecoder().push(b))});
test('slow viewers drop frames instead of buffering old video',()=>{const s=new MacStream('/tmp');let writes=0;s.write({destroyed:false,writableNeedDrain:true,write:()=>writes++},Buffer.from('frame'));assert.equal(writes,0)});
test('reselect closes old viewers and removes cached pixels',()=>{const s=new MacStream('/tmp');let ended=false;s.clients.add({end:()=>ended=true});s.latest=Buffer.from('old');s.select('new',42);assert.equal(ended,true);assert.equal(s.latest,null);assert.equal(s.app,'new');assert.equal(s.windowId,42);assert.equal(s.clients.size,0)});

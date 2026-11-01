import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {DesktopConsole,probeDesktop} from '../packages/macos/desktop.mjs';

const clientId='test-client-123456789';const token='test-local-token';
async function fixture(t,options={}){
 const peers=new Set(),received=[];
 const rfb=net.createServer(socket=>{peers.add(socket);socket.on('close',()=>peers.delete(socket));socket.write('RFB 003.889\n');socket.on('data',data=>{received.push(data);socket.write(data)});socket.on('error',()=>{})});
 await new Promise(r=>rfb.listen(0,'127.0.0.1',r));
 let acquired=0;const desktop=new DesktopConsole({port:rfb.address().port,beforeAcquire:async()=>{acquired++},...options});
 const server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const host=`127.0.0.1:${server.address().port}`;
 server.on('upgrade',(req,socket,head)=>desktop.upgrade(req,socket,head,{host,token}));
 t.after(async()=>{desktop.close();for(const p of peers)p.destroy();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>rfb.close(r))])});
 const open=(ticket,{origin=`http://${host}`,cookie=`skyrail=${token}`,path='/v1/desktop/socket'}={})=>new WebSocket(`ws://${host}${path}`,['binary','skyrail.'+ticket],{headers:{...(origin?{Origin:origin}:{}),Cookie:cookie}});
 return {desktop,open,host,received,rfb,get acquired(){return acquired}};
}
async function rejected(ws,status){await new Promise((resolve,reject)=>{ws.once('unexpected-response',(_req,res)=>{assert.equal(res.statusCode,status);res.resume();ws.terminate();resolve()});ws.once('open',()=>reject(Error('unexpected accepted socket')));ws.on('error',()=>{})})}

test('human desktop requires local auth, origin, ticket; binary RFB forwards and disconnect releases',async t=>{
 const f=await fixture(t);assert.equal((await probeDesktop({port:f.rfb.address().port})).available,true);
 const lease=await f.desktop.start(clientId);assert.equal(f.acquired,1);assert.equal(JSON.stringify(f.desktop.status()).includes(lease.ticket),false);
 await assert.rejects(f.desktop.start('another-client-123456789'),/已被打开/);
 await rejected(f.open(lease.ticket,{cookie:''}),403);await rejected(f.open(lease.ticket,{origin:''}),403);await rejected(f.open(lease.ticket,{origin:'https://untrusted.example'}),403);
 await rejected(f.open('0'.repeat(64)),403);await rejected(f.open(lease.ticket,{path:'/v1/desktop/socket?target=example.com:22'}),403);
 const ws=f.open(lease.ticket);const banner=once(ws,'message');await once(ws,'open');assert.equal((await banner)[0].toString(),'RFB 003.889\n');
 const echo=once(ws,'message');ws.send(Buffer.from('RFB 003.008\n'));assert.equal((await echo)[0].toString(),'RFB 003.008\n');assert.equal(f.received.length,1);
 await rejected(f.open(lease.ticket),403);assert.throws(()=>f.desktop.stop('different-client-123456789',lease.ticket),/属于另一页面/);
 assert.ok(f.desktop.renew(clientId,lease.ticket).expiresAt);const closed=once(ws,'close');f.desktop.stop(clientId,lease.ticket);await closed;assert.equal(f.desktop.active,false);
 await rejected(f.open(lease.ticket),403);
});

test('human desktop expires idle and absolute leases; stale stop cannot close replacement',async t=>{
 let now=1000;const f=await fixture(t,{now:()=>now,pendingMs:10,idleMs:20,maxMs:50});
 const first=await f.desktop.start(clientId);now+=11;f.desktop.sweep();assert.equal(f.desktop.active,false);
 const second=await f.desktop.start(clientId);assert.throws(()=>f.desktop.stop(clientId,first.ticket),/过期/);assert.equal(f.desktop.active,true);
 const ws=f.open(second.ticket);await once(ws,'open');now+=10;f.desktop.renew(clientId,second.ticket);now+=19;f.desktop.renew(clientId,second.ticket);now+=19;f.desktop.renew(clientId,second.ticket);
 const closed=once(ws,'close');now+=3;f.desktop.sweep();await closed;assert.equal(f.desktop.active,false);
});

test('human desktop rejects text and releases on transport loss',async t=>{
 const f=await fixture(t);const first=await f.desktop.start(clientId);const ws=f.open(first.ticket);await once(ws,'open');const closed=once(ws,'close');ws.send('not-binary');await closed;assert.equal(f.desktop.active,false);
 const second=await f.desktop.start(clientId);const next=f.open(second.ticket);await once(next,'open');const gone=once(next,'close'),released=once(f.desktop,'change');next.terminate();await gone;await released;assert.equal(f.desktop.active,false);
});

test('failed desktop preparation frees reservation and invalid Unicode tickets fail cleanly',async t=>{
 const f=await fixture(t,{beforeAcquire:async()=>{throw Error('handoff failed')}});await assert.rejects(f.desktop.start(clientId),/handoff failed/);assert.equal(f.desktop.active,false);
 f.desktop.beforeAcquire=async()=>{};await f.desktop.start(clientId);assert.throws(()=>f.desktop.verify(clientId,'密'.repeat(64)),/过期/);assert.equal(f.desktop.active,true);
});

test('handing control to Codex keeps the desktop connected and resume reacquires ownership',async t=>{
 const f=await fixture(t);const lease=await f.desktop.start(clientId),ws=f.open(lease.ticket);await once(ws,'open');await assert.rejects(f.desktop.control(clientId,lease.ticket,'view'),/尚未完成认证/);
 f.desktop.lease.gate.ready=true;await f.desktop.control(clientId,lease.ticket,'view');assert.equal(f.desktop.active,false);assert.equal(f.desktop.connected,true);assert.equal(ws.readyState,WebSocket.OPEN);
 await f.desktop.control(clientId,lease.ticket,'human');assert.equal(f.acquired,2);assert.equal(f.desktop.active,true);assert.equal(ws.readyState,WebSocket.OPEN);
});
test('explicit device switch replaces the old connection without accepting its old ticket',async t=>{
 const f=await fixture(t);const old=await f.desktop.start(clientId),ws=f.open(old.ticket);await once(ws,'open');const closed=once(ws,'close');const next=await f.desktop.start('new-client-123456789',{replace:true});await closed;assert.notEqual(next.ticket,old.ticket);assert.throws(()=>f.desktop.stop(clientId,old.ticket),/过期/);assert.equal(f.desktop.active,true);
});

import net from 'node:net';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {WebSocketServer,createWebSocketStream} from 'ws';
import {RFBInputGate} from './rfb-input.mjs';

const fail=(message,status=409)=>Object.assign(Error(message),{status});
export function rejectUpgrade(socket,status=403){socket.on('error',()=>socket.destroy());if(socket.writable)socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);else socket.destroy()}
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

// Only loopback is supported. No HTTP argument or environment variable selects
// an arbitrary destination; test ports are injected by the test harness only.
export function probeDesktop({port=5900,timeout=800}={}){
 return new Promise(resolve=>{
  const socket=net.connect({host:'127.0.0.1',port});let banner=Buffer.alloc(0),done=false;
  const finish=available=>{if(done)return;done=true;socket.destroy();resolve({available,message:available?'系统屏幕共享可连接':'请在 Mac 的系统设置 → 通用 → 共享中开启屏幕共享，并只允许你的账户。',transport:'rfb'})};
  socket.setTimeout(timeout,()=>finish(false));socket.on('error',()=>finish(false));socket.on('end',()=>finish(false));
  socket.on('data',chunk=>{banner=Buffer.concat([banner,chunk]);if(banner.length>=12)finish(/^RFB \d{3}\.\d{3}\n$/.test(banner.subarray(0,12).toString('ascii')))});
 });
}

export class DesktopConsole extends EventEmitter{
 constructor({beforeAcquire=async()=>{},port=5900,now=Date.now,pendingMs=30000,idleMs=90000,maxMs=24*60*60*1000}={}){
  super();Object.assign(this,{beforeAcquire,port,now,pendingMs,idleMs,maxMs});this.lease=null;
  this.wss=new WebSocketServer({noServer:true,perMessageDeflate:false,maxPayload:65536,handleProtocols:protocols=>protocols.has('binary')?'binary':false});
  this.timer=setInterval(()=>this.sweep(),1000);this.timer.unref();
 }
 get active(){return !!this.lease&&this.lease.mode!=='view'}
 get connected(){return !!this.lease?.ws}
 status(){return {active:this.active,connected:this.connected,control:this.lease?.mode||'none',ready:!!this.lease?.gate?.ready,expiresAt:this.lease?.absolute||null}}
 changed(){this.emit('change')}
 async start(clientId,{replace=false}={}){
  if(typeof clientId!=='string'||!(/^[a-zA-Z0-9-]{16,80}$/).test(clientId))throw fail('无效客户端',400);
  if(this.lease){if(!replace)throw fail('人工控制台已被打开，请先在原页面断开');this.release()}
  const lease={clientId,mode:'human',ticket:randomBytes(32).toString('hex'),expires:this.now()+this.pendingMs,absolute:this.now()+this.maxMs};
  this.lease=lease;this.changed();
  try{
   const status=await probeDesktop({port:this.port});if(!status.available)throw fail(status.message,503);
   await this.beforeAcquire();
   if(this.lease!==lease)throw fail('控制台连接已取消');
   lease.expires=this.now()+this.pendingMs;this.changed();return {ticket:lease.ticket,expiresAt:lease.absolute};
  }catch(e){if(this.lease===lease)this.release();throw e}
 }
 verify(clientId,ticket){this.sweep();const lease=this.lease;if(!lease||lease.clientId!==clientId||!same(lease.ticket,ticket))throw fail('人工控制台已过期或属于另一页面');return lease}
 renew(clientId,ticket){const lease=this.verify(clientId,ticket);if(!lease.ws)throw fail('画面尚未连接');lease.expires=Math.min(this.now()+this.idleMs,lease.absolute);return {expiresAt:lease.absolute}}
 stop(clientId,ticket){this.verify(clientId,ticket);this.release()}
 async control(clientId,ticket,mode){
  if(!['view','human'].includes(mode))throw fail('无效控制模式',400);
  const lease=this.verify(clientId,ticket);if(!lease.gate?.ready)throw fail('桌面尚未完成认证');if(lease.switching)throw fail('正在交接，请稍候');
  if(mode===lease.mode)return this.status();
  if(mode==='view'){lease.gate.park();lease.mode='view';this.changed();return this.status()}
  lease.switching=true;lease.mode='resuming';this.changed();
  try{await this.beforeAcquire();if(this.lease!==lease)throw fail('连接已断开');lease.gate.resumeInput();lease.mode='human';return this.status()}
  catch(e){if(this.lease===lease)lease.mode='view';throw e}finally{lease.switching=false;this.changed()}
 }
 sweep(){if(this.lease&&(this.now()>=this.lease.expires||this.now()>=this.lease.absolute))this.release()}
 release(){
  const lease=this.lease;if(!lease)return;this.lease=null;
  // Transport teardown, never replay buffered input into a replacement session.
  lease.gate?.destroy();lease.tcp?.destroy();lease.duplex?.destroy();lease.ws?.terminate();this.changed();
 }
 upgrade(req,socket,head,{host,token}){
  let url;try{url=new URL(req.url,`http://${host}`)}catch{return rejectUpgrade(socket)}
  if(url.pathname!=='/v1/desktop/socket')return false;
  if(req.headers.host!==host||req.headers.origin!==`http://${host}`||url.search||!req.headers.cookie?.split('; ').includes(`skyrail=${token}`))return rejectUpgrade(socket);
  const protocols=(req.headers['sec-websocket-protocol']||'').split(',').map(s=>s.trim());
  const proof=protocols.find(s=>/^skyrail\.[a-f0-9]{64}$/.test(s))?.slice(8);this.sweep();const lease=this.lease;
  if(!lease||lease.ws||!same(lease.ticket,proof)||!protocols.includes('binary'))return rejectUpgrade(socket);
  // Reserve before handshake. A second upgrade cannot attach the same ticket.
  lease.ws={terminate:()=>socket.destroy()};
  try{this.wss.handleUpgrade(req,socket,head,ws=>{
   if(this.lease!==lease){ws.terminate();return}
   lease.ws=ws;lease.expires=Math.min(this.now()+this.idleMs,lease.absolute);
   const tcp=net.connect({host:'127.0.0.1',port:this.port});lease.tcp=tcp;
   const finish=()=>{if(this.lease===lease)this.release()};
   // Frames and credentials are forwarded only; never decoded, captured or logged.
   ws.on('message',(_data,binary)=>{if(!binary)finish()});
   const duplex=createWebSocketStream(ws);lease.duplex=duplex;
   const gate=new RFBInputGate();lease.gate=gate;gate.on('error',finish);gate.on('ready',()=>this.changed());tcp.on('data',chunk=>gate.observe(chunk));
   tcp.on('error',finish);tcp.on('close',finish);duplex.on('error',finish);ws.on('error',finish);ws.on('close',finish);
   tcp.pipe(duplex).pipe(gate).pipe(tcp);this.changed();
  })}catch{if(this.lease===lease)this.release();socket.destroy()}
  return true;
 }
 close(){clearInterval(this.timer);this.release();this.wss.close()}
}

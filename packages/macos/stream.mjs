import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {MacBridge} from './index.mjs';

export class FrameDecoder {
 buffer=Buffer.alloc(0);
 push(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);const frames=[];while(this.buffer.length>=4){const size=this.buffer.readUInt32BE(0);if(size<1||size>16*1024*1024)throw Error('Invalid native frame length');if(this.buffer.length<size+4)break;frames.push(this.buffer.subarray(4,size+4));this.buffer=this.buffer.subarray(size+4)}return frames}
}
export class MacStream extends EventEmitter {
 constructor(root,{spawnNative=spawn,makeSnapshotBridge=()=>new MacBridge(root)}={}){
  super();this.root=root;this.spawnNative=spawnNative;this.makeSnapshotBridge=makeSnapshotBridge;this.clients=new Set();this.generation=0;this.state={status:'disconnected',frames:0,fps:0,error:null};
 }
 select(app,windowId){this.stop();this.app=app;this.windowId=windowId;this.latest=null;this.state={status:'disconnected',frames:0,fps:0,error:null};this.emit('change')}
 start(){
  if(this.child||this.snapshot||!this.app)return;
  const generation=++this.generation;
  this.state={status:'connecting',frames:0,fps:0,error:null,captureMode:'scstream'};this.latest=null;this.emit('change');
  this.began=this.measured=this.lastHeartbeat=Date.now();this.count=0;this.lastPublished=0;
  const decoder=new FrameDecoder();
  const child=this.spawnNative(path.join(this.root,'.data/Skyrail Mac.app/Contents/MacOS/SkyrailMac'),['--stream',this.app,String(this.windowId)],{stdio:['ignore','pipe','pipe']});this.child=child;
  const current=()=>this.generation===generation&&this.child===child;
  child.on('error',e=>{if(current())this.fallback(generation,e.message)});
  child.on('exit',()=>{if(current())this.fallback(generation,'原生视频进程已退出')});
  createInterface({input:child.stderr}).on('line',line=>{if(!current())return;try{const s=JSON.parse(line);this.lastHeartbeat=Date.now();if(s.error)this.fallback(generation,s.error)}catch{}});
  child.stdout.on('data',chunk=>{if(!current())return;try{for(const frame of decoder.push(chunk))this.frame(frame,'image/jpeg')}catch(e){this.fallback(generation,e.message)}});
  this.watchdog=setInterval(()=>{
   if(this.generation!==generation)return;
   if(this.child&&this.state.frames===0&&Date.now()-this.began>1500)this.fallback(generation,'原生视频未输出画面');
   else if(Date.now()-this.lastHeartbeat>12000)this.fail(generation,'窗口采集没有响应，请重新连接');
   else this.emit('change');
  },500);
 }
 fallback(generation,reason){
  if(this.generation!==generation||this.snapshot)return;
  const child=this.child;this.child=null;child?.kill();
  // A separate native process reads frames; it never changes the agent's AX
  // indices. This recovery retries captures only, never an input or write.
  const bridge=this.makeSnapshotBridge();this.snapshot=bridge;this.lastHeartbeat=Date.now();
  this.state={...this.state,captureMode:'window-snapshots',recoveryReason:reason,error:null};this.emit('change');
  const capture=async()=>{
   const began=Date.now();
   try{
    const result=await bridge.rpc('observe',{app:this.app,windowId:this.windowId});
    if(this.generation!==generation||this.snapshot!==bridge)return;
    if(!result.image?.startsWith('data:image/png;base64,'))throw Error('窗口没有返回有效画面');
    const bytes=Buffer.from(result.image.slice('data:image/png;base64,'.length),'base64');
    if(!bytes.length||bytes.length>16*1024*1024)throw Error('窗口画面超出采集大小限制');
    this.frame(bytes,'image/png');
    this.captureTimer=setTimeout(capture,Math.max(0,200-(Date.now()-began)));
   }catch(e){if(this.generation===generation&&this.snapshot===bridge)this.fail(generation,e.message)}
  };
  void capture();
 }
 frame(frame,mime){
  this.latest=frame;this.latestType=mime;this.count++;this.state.frames++;this.state.status='live';this.state.error=null;this.state.lastFrameAt=this.lastHeartbeat=Date.now();
  for(const response of this.clients)this.write(response,frame,mime);
  if(Date.now()-this.measured>=1000){this.state.fps=Number((this.count*1000/(Date.now()-this.measured)).toFixed(1));this.count=0;this.measured=Date.now()}
  if(Date.now()-this.lastPublished>=1000||!this.lastPublished){this.lastPublished=Date.now();this.emit('change')}
 }
 fail(generation,message){if(this.generation!==generation)return;this.state={...this.state,status:'disconnected',error:message};this.stop(true);this.latest=null;this.emit('change')}
 write(response,frame,mime='image/jpeg'){if(response.destroyed||response.writableNeedDrain)return;response.write(`--skyrail-frame\r\nContent-Type: ${mime}\r\nContent-Length: ${frame.length}\r\n\r\n`);response.write(frame);response.write('\r\n')}
 attach(response){
  clearTimeout(this.idleTimer);response.writeHead(200,{'Content-Type':'multipart/x-mixed-replace; boundary=skyrail-frame','Cache-Control':'no-store','X-Accel-Buffering':'no'});this.clients.add(response);this.emit('activity');
  if(this.latest)this.write(response,this.latest,this.latestType);this.start();
  response.on('close',()=>{this.clients.delete(response);this.emit('activity');if(!this.clients.size)this.idleTimer=setTimeout(()=>{this.stop();this.state.status='disconnected';this.emit('change')},1500)});
 }
 stop(keepState=false){
  this.generation++;clearInterval(this.watchdog);clearTimeout(this.idleTimer);clearTimeout(this.captureTimer);
  const child=this.child;this.child=null;child?.kill();const snapshot=this.snapshot;this.snapshot=null;snapshot?.child?.kill();
  for(const c of this.clients)c.end();this.clients.clear();this.emit('activity');if(!keepState)this.latest=null;
 }
}

import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';

export class FrameDecoder {
 buffer=Buffer.alloc(0);
 push(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);const frames=[];while(this.buffer.length>=4){const size=this.buffer.readUInt32BE(0);if(size<1||size>16*1024*1024)throw Error('Invalid native frame length');if(this.buffer.length<size+4)break;frames.push(this.buffer.subarray(4,size+4));this.buffer=this.buffer.subarray(size+4)}return frames}
}
export class MacStream extends EventEmitter {
 constructor(root){super();this.root=root;this.clients=new Set();this.generation=0;this.state={status:'disconnected',frames:0,fps:0,error:null};}
 select(app,windowId){this.stop();this.app=app;this.windowId=windowId;this.latest=null;this.state={status:'disconnected',frames:0,fps:0,error:null};this.emit('change')}
 start(){if(this.child||!this.app)return;const generation=++this.generation;this.state={status:'connecting',frames:0,fps:0,error:null};this.emit('change');const decoder=new FrameDecoder();const began=Date.now();let count=0;let measured=began;this.lastHeartbeat=began;
 const child=spawn(path.join(this.root,'.data/Skyrail Mac.app/Contents/MacOS/SkyrailMac'),['--stream',this.app,String(this.windowId)],{stdio:['ignore','pipe','pipe']});this.child=child;
 const fail=message=>{if(this.generation!==generation)return;this.state={...this.state,status:'disconnected',error:message};this.emit('change');this.stop(true)};
 child.on('error',e=>fail(e.message));child.on('exit',()=>fail('窗口串流已结束，点击重连'));
 createInterface({input:child.stderr}).on('line',line=>{if(this.generation!==generation)return;try{const s=JSON.parse(line);this.lastHeartbeat=Date.now();if(s.error)fail(s.error)}catch{}});
 child.stdout.on('data',chunk=>{if(this.generation!==generation)return;try{for(const frame of decoder.push(chunk)){this.latest=frame;count++;this.state.frames++;this.state.status='live';this.state.error=null;this.state.lastFrameAt=Date.now();for(const response of this.clients)this.write(response,frame)}if(Date.now()-measured>=1000){this.state.fps=Number((count*1000/(Date.now()-measured)).toFixed(1));count=0;measured=Date.now();this.emit('change')}}catch(e){fail(e.message)}});
 this.watchdog=setInterval(()=>{if(this.generation!==generation)return;if(Date.now()-this.lastHeartbeat>6000)fail('串流没有响应，请重新连接');else if(this.state.status==='connecting'&&Date.now()-began>12000)fail('未收到窗口画面，请确认窗口已打开');else this.emit('change')},1000);
 }
 write(response,frame){if(response.destroyed||response.writableNeedDrain)return;response.write(`--skyrail-frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);response.write(frame);response.write('\r\n')}
 attach(response){clearTimeout(this.idleTimer);response.writeHead(200,{'Content-Type':'multipart/x-mixed-replace; boundary=skyrail-frame','Cache-Control':'no-store','X-Accel-Buffering':'no'});this.clients.add(response);if(this.latest)this.write(response,this.latest);this.start();response.on('close',()=>{this.clients.delete(response);if(!this.clients.size)this.idleTimer=setTimeout(()=>{this.stop();this.state.status='disconnected';this.emit('change')},1500)})}
 stop(keepState=false){this.generation++;clearInterval(this.watchdog);clearTimeout(this.idleTimer);this.child?.kill();this.child=null;for(const c of this.clients)c.end();this.clients.clear();if(!keepState)this.latest=null}
}

// Manual browser QA fixture. Entirely synthetic data, loopback only. Never
// connects to the actual desktop or Codex. Run after `npm run build`.
import http from 'node:http';import net from 'node:net';import {readFile} from 'node:fs/promises';import path from 'node:path';
import {DesktopConsole,probeDesktop,rejectUpgrade} from '../../packages/macos/desktop.mjs';
import {getDiffieHellman} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../../dist'),token='synthetic-preview-token';let frames=0,keys=0,pointers=0,authAttempts=0;const appInputs=[];let appBound=false;let appOwner='human';let appEpoch=1;
const rfb=net.createServer(socket=>{
 let stage=0,buffer=Buffer.alloc(0),sent=false;socket.on('error',()=>{});socket.write('RFB 003.889\n');
 socket.on('data',data=>{buffer=Buffer.concat([buffer,data]);while(true){
  if(stage===0){if(buffer.length<12)return;buffer=buffer.subarray(12);socket.write(Buffer.from([1,30]));stage=1}
  else if(stage===1){if(!buffer.length)return;if(buffer[0]!==30)return socket.destroy();buffer=buffer.subarray(1);const dh=getDiffieHellman('modp2');dh.generateKeys();socket.write(Buffer.concat([Buffer.from([0,2,0,128]),dh.getPrime(),dh.getPublicKey()]));stage=1.5}
  // Synthetic auth accepts any 128-byte encrypted credential block + key.
  // Never use this fixture as a real VNC server or with real account details.
  else if(stage===1.5){if(buffer.length<256)return;buffer=buffer.subarray(256);authAttempts++;socket.write(Buffer.alloc(4));stage=2}
  else if(stage===2){if(!buffer.length)return;buffer=buffer.subarray(1);const name=Buffer.from('Skyrail synthetic desktop');const init=Buffer.alloc(24);init.writeUInt16BE(640);init.writeUInt16BE(400,2);init[4]=32;init[5]=24;init[7]=1;init.writeUInt16BE(255,8);init.writeUInt16BE(255,10);init.writeUInt16BE(255,12);init[14]=16;init[15]=8;init.writeUInt32BE(name.length,20);socket.write(Buffer.concat([init,name]));stage=3}
  else{
   if(!buffer.length)return;const type=buffer[0];let length;
   if(type===0)length=20;else if(type===2){if(buffer.length<4)return;length=4+buffer.readUInt16BE(2)*4}else if(type===3)length=10;else if(type===4)length=8;else if(type===5)length=6;else if(type===6){if(buffer.length<8)return;length=8+buffer.readUInt32BE(4)}else return socket.destroy();
   if(buffer.length<length)return;buffer=buffer.subarray(length);
   if(type===4)keys++;if(type===5)pointers++;
   if(type===3&&!sent){sent=true;const header=Buffer.alloc(16);header.writeUInt16BE(1,2);header.writeUInt16BE(640,8);header.writeUInt16BE(400,10);const pixels=Buffer.alloc(640*400*4);for(let y=0;y<400;y++)for(let x=0;x<640;x++){const i=(y*640+x)*4;pixels[i]=y<100?88:175;pixels[i+1]=x<320?139:185;pixels[i+2]=y<100?57:220;}socket.write(Buffer.concat([header,pixels]));frames++}
  }
 }});
});await new Promise(r=>rfb.listen(0,'127.0.0.1',r));
const desktop=new DesktopConsole({port:rfb.address().port});
const threads=[],clients=new Set();let globalClient=null;
const snapshot=()=>({service:{protocol:6,id:'synthetic'},desktop:desktop.status(),threads,runtime:'connected',stream:{status:appBound?'live':'idle'},lease:{owner:appOwner,epoch:appEpoch,app:appBound?'synthetic.app':null,threadId:appBound?'synthetic-thread':null,humanClientId:globalClient,frame:appBound?{windowTitle:'Synthetic app',width:640,height:400}:null,health:{locked:false,screenRecording:true,accessibility:true}}});
const publish=()=>{for(const client of clients)client.write('data: '+JSON.stringify(snapshot())+'\n\n')};desktop.on('change',publish);
const server=http.createServer(async(req,res)=>{
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))};
 if(req.url==='/v1/bootstrap'){res.setHeader('Set-Cookie',`skyrail=${token}; Path=/v1; HttpOnly; SameSite=Strict`);return json({token,...snapshot()})}
 if(req.url==='/v1/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});clients.add(res);res.write('data: '+JSON.stringify(snapshot())+'\n\n');req.on('close',()=>clients.delete(res));return}
 if(req.url==='/qa-counts')return json({frames,keys,pointers,authAttempts,active:desktop.active,appInputs});
 if(req.url?.startsWith('/v1/mac/stream?')){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#d7e1e4"/><text x="40" y="70" fill="#233a4b" font-size="30">Synthetic App</text><rect x="220" y="160" width="200" height="80" rx="16" fill="#344f65"/><text x="245" y="210" fill="white" font-size="24">Tap target</text></svg>');}
 if(req.method==='POST'){
  if(req.headers['x-skyrail-token']!==token)return json({},403);let raw='';for await(const data of req)raw+=data;const body=JSON.parse(raw||'{}');
  try{if(req.url==='/v1/threads'){const thread={id:'synthetic-thread',title:'界面验收',messages:[],status:'idle'};threads.push(thread);publish();return json(thread)}if(req.url==='/v1/threads/synthetic-thread/messages'){threads[0].messages.push({id:'qa-user',role:'user',text:body.text},{id:'qa-assistant',role:'assistant',text:'合成测试回复：未调用真实模型。'});threads[0].status='completed';publish();return json(threads[0])}switch(req.url){case '/v1/sessions/list':return json({sessions:[{id:'qa-a',title:'排查手机点按',cwd:'/projects/skyrail/workspaces/a',project:{id:'/projects/skyrail',name:'skyrail',path:'/projects/skyrail'},updatedAt:1793491200},{id:'qa-b',title:'整理交接流程',cwd:'/projects/skyrail',project:{id:'/projects/skyrail',name:'skyrail',path:'/projects/skyrail'},updatedAt:1793491200},{id:'qa-c',title:'网站导航',cwd:'/projects/website',project:{id:'/projects/website',name:'website',path:'/projects/website'},updatedAt:1793491200}],nextCursor:null});case '/v1/mac/health':return json(snapshot().lease.health);case '/v1/mac/apps':return json({apps:[{id:'synthetic.app',name:'Synthetic App'}]});case '/v1/mac/windows':return json({windows:[{id:1,title:'Synthetic App'}]});case '/v1/mac/bind':globalClient=body.clientId;appBound=true;appOwner='human';appEpoch++;publish();return json(snapshot());case '/v1/control':appOwner=body.owner;globalClient=body.clientId;appEpoch++;publish();return json(snapshot());case '/v1/mac/release':return json({ok:true});case '/v1/mac/input':appInputs.push(body.input);return json({ok:true});case '/v1/desktop/status':return json({...await probeDesktop({port:rfb.address().port}),...desktop.status(),username:'synthetic-user'});case '/v1/desktop/start':return json(await desktop.start(body.clientId,{replace:body.replace===true}));case '/v1/desktop/renew':return json(desktop.renew(body.clientId,body.ticket));case '/v1/desktop/control':return json(await desktop.control(body.clientId,body.ticket,body.mode));case '/v1/desktop/stop':desktop.stop(body.clientId,body.ticket);return json({ok:true});default:return json({},404)}}catch(e){return json({message:e.message},e.status||500)}
 }
 const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return json({},403);
 try{const bytes=await readFile(file);const types={'.js':'text/javascript','.css':'text/css','.html':'text/html'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes)}catch{json({},404)}
});
server.on('upgrade',(req,socket,head)=>{if(req.url!=='/v1/desktop/socket')return rejectUpgrade(socket);desktop.upgrade(req,socket,head,{host:`127.0.0.1:${server.address().port}`,token})});
server.listen(0,'127.0.0.1',()=>console.log(`Synthetic browser preview: http://127.0.0.1:${server.address().port}`));
const close=()=>{desktop.close();server.closeAllConnections();server.close();rfb.close();process.exit(0)};process.on('SIGTERM',close);process.on('SIGINT',close);

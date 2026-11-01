import http from 'node:http';
import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {rejectUpgrade} from '../../packages/macos/desktop.mjs';
const root=path.resolve(import.meta.dirname,'../..');const dataRoot=process.env.SKYRAIL_GATEWAY_DATA||path.join(root,'.data');await mkdir(dataRoot,{recursive:true});
const publicHost=process.env.SKYRAIL_REMOTE_HOST;
if(!publicHost||!/^[a-z0-9.-]+$/i.test(publicHost))throw Error('Set SKYRAIL_REMOTE_HOST to your HTTPS hostname, without scheme or port');
const port=Number(process.env.GATEWAY_PORT||4318);const upstreamPort=Number(process.env.PORT||4317);
const credentialFile=path.join(dataRoot,'remote-access.txt');let password;
try{password=(await readFile(credentialFile,'utf8')).trim()}catch(e){if(e.code!=='ENOENT')throw e;password=randomBytes(24).toString('base64url');await writeFile(credentialFile,password+'\n',{mode:0o600,flag:'wx'})}
const key=randomBytes(32);const digest=v=>createHash('sha256').update(v).digest();const same=(a,b)=>timingSafeEqual(digest(a),digest(b));
const sign=value=>createHmac('sha256',key).update(value).digest('base64url');
function authenticated(req){const value=req.headers.cookie?.split('; ').find(c=>c.startsWith('__Host-skyrail_access='))?.split('=').slice(1).join('=');if(!value)return false;const [time,signature]=value.split('.');return Number(time)>Date.now()&&!!signature&&same(signature,sign(time))}
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录 Skyrail</title><style>body{font:16px -apple-system,BlinkMacSystemFont,sans-serif;color:#233a4b;background:linear-gradient(140deg,#afc9dd,#f0dfcc);min-height:95vh;display:grid;place-items:center;margin:0}main{background:#ffffffdf;border-radius:24px;padding:36px;width:min(340px,75vw)}h1{font-size:28px;font-weight:500}p{font-size:14px;line-height:1.7;color:#506779}label{display:block;font-size:13px;margin-bottom:8px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:13px;border:1px solid #a1b5bf;border-radius:10px}button{margin-top:16px;background:#344f65;color:white;border:0;cursor:pointer}small{display:block;margin-top:18px;color:#506779;font-size:11px;line-height:1.7}</style><main><h1>Skyrail</h1><p>登录后访问你的 Mac 工作台。</p><form action="/_access/login" method="post"><label for="password">远程访问密码</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button>登录</button></form><small>密码保存在运行 Skyrail 的 Mac 上，位于项目 .data/remote-access.txt。</small></main></html>`;
const attempts=new Map();
const server=http.createServer(async(req,res)=>{
 const host=req.headers.host;if(host!==publicHost&&host!==`127.0.0.1:${port}`){res.writeHead(403);return res.end('Invalid host')}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 if(req.url==='/_health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"status":"ready"}')}
 if(req.headers.origin&&req.headers.origin!==`https://${publicHost}`&&req.headers.origin!==`http://127.0.0.1:${port}`){res.writeHead(403);return res.end('Invalid origin')}
 if(req.url==='/_access/login'&&req.method==='POST'){
  const ip=req.headers['cf-connecting-ip']||req.socket.remoteAddress;const now=Date.now();let entry=attempts.get(ip);if(!entry||now-entry.since>60000)entry={since:now,count:0};attempts.set(ip,entry);if(++entry.count>10){res.writeHead(429);return res.end('Too many attempts')}
  let body='';for await(const part of req){body+=part;if(body.length>4096){res.writeHead(413);return res.end('Too large')}}
  const supplied=new URLSearchParams(body).get('password')||'';
  if(!same(supplied,password)){res.writeHead(401,{'Content-Type':'text/html; charset=utf-8'});return res.end(html.replace('<p>登录后访问你的 Mac 工作台。</p>','<p role="alert">密码不正确，请使用 Mac 上保存的远程访问密码。</p>'))}
  const time=String(Date.now()+24*60*60*1000);res.setHeader('Set-Cookie',`__Host-skyrail_access=${time}.${sign(time)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400`);res.writeHead(303,{Location:'/'});return res.end();
 }
 if(!authenticated(req)){if(req.url.startsWith('/v1/')){res.writeHead(401,{'Content-Type':'application/json'});return res.end('{"message":"请先登录 Skyrail 远程入口"}')};res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"});return res.end(html)}
 const headers={...req.headers,host:`127.0.0.1:${upstreamPort}`};if(headers.origin)headers.origin=`http://127.0.0.1:${upstreamPort}`;delete headers['x-forwarded-host'];
 const proxy=http.request({hostname:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers},upstream=>{res.writeHead(upstream.statusCode,upstream.headers);res.flushHeaders();upstream.pipe(res)});
 proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});res.end('Skyrail 本地服务未启动，请在 Mac 上启动工作台。')});res.on('close',()=>proxy.destroy());req.pipe(proxy);
});
// WebSocket upgrades bypass the HTTP handler above: validate all boundaries
// again, then proxy only the dedicated human desktop endpoint. No payload logs.
const desktopSockets=new Set();
server.on('upgrade',(req,socket,head)=>{
 if(req.url!=='/v1/desktop/socket')return rejectUpgrade(socket,404);
 const allowedHosts=[publicHost,`127.0.0.1:${port}`];
 if(!allowedHosts.includes(req.headers.host)||![`https://${publicHost}`,`http://127.0.0.1:${port}`].includes(req.headers.origin))return rejectUpgrade(socket);
 if(!authenticated(req))return rejectUpgrade(socket,401);
 const headers={...req.headers,host:`127.0.0.1:${upstreamPort}`,origin:`http://127.0.0.1:${upstreamPort}`};delete headers['x-forwarded-host'];
 const proxy=http.request({hostname:'127.0.0.1',port:upstreamPort,path:'/v1/desktop/socket',method:'GET',headers});
 let upstreamSocket;const expire=setInterval(()=>{if(!authenticated(req))socket.destroy()},10000);expire.unref();
 const cleanup=()=>{clearInterval(expire);desktopSockets.delete(socket);proxy.destroy();upstreamSocket?.destroy()};
 socket.on('close',cleanup);socket.on('error',cleanup);desktopSockets.add(socket);
 proxy.setTimeout(10000,()=>{rejectUpgrade(socket,504);cleanup()});
 proxy.on('error',()=>{rejectUpgrade(socket,502);cleanup()});
 proxy.on('response',response=>{response.resume();rejectUpgrade(socket,[400,401,403,404,409,503].includes(response.statusCode)?response.statusCode:502);cleanup()});
 proxy.on('upgrade',(upstream,peer,upstreamHead)=>{
  upstreamSocket=peer;proxy.setTimeout(0);
  const response=['HTTP/1.1 101 Switching Protocols'];for(let i=0;i<upstream.rawHeaders.length;i+=2)response.push(`${upstream.rawHeaders[i]}: ${upstream.rawHeaders[i+1]}`);
  socket.write(response.join('\r\n')+'\r\n\r\n');if(upstreamHead.length)socket.write(upstreamHead);if(head.length)peer.write(head);
  peer.on('error',()=>socket.destroy());peer.on('close',()=>socket.destroy());socket.pipe(peer).pipe(socket);
 });
 proxy.end();
});
server.listen(port,'127.0.0.1',()=>console.log(`Skyrail remote gateway ready on 127.0.0.1:${port} for ${publicHost}`));
const close=()=>{for(const socket of desktopSockets)socket.destroy();server.close(()=>process.exit(0))};
process.on('SIGTERM',close);process.on('SIGINT',close);

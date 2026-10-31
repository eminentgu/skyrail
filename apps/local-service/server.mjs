import http from 'node:http';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createServer as createViteServer} from 'vite';
import {Codex} from '../../packages/codex/index.mjs';
import {transition} from '../../packages/computer/lease.mjs';
const root=path.resolve(import.meta.dirname,'../..');process.chdir(root);
await mkdir('.data',{recursive:true});await mkdir('workspaces',{recursive:true});
let threads=[];try{threads=JSON.parse(await readFile('.data/threads.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
for(const t of threads)if(t.status==='running'||t.status==='submitting')t.status='interrupted';
let persist=Promise.resolve();function save(){const data=JSON.stringify(threads);persist=persist.then(async()=>{await writeFile('.data/threads.tmp',data,{mode:0o600});await rename('.data/threads.tmp','.data/threads.json')});return persist}
const codex=new Codex();let runtime='disconnected';const resumed=new Set();const clients=new Set();
let lease={owner:'none',epoch:0,mode:'simulation'};
const snapshot=()=>({threads,runtime,lease});
function publish(){const data='data: '+JSON.stringify(snapshot())+'\n\n';for(const c of clients)c.write(data)}
codex.on('offline',()=>{runtime='disconnected';resumed.clear();for(const t of threads)if(['running','submitting'].includes(t.status))t.status='interrupted';save();publish()});
codex.on('notification',({method,params:p})=>{
 const t=threads.find(t=>t.codexId===p?.threadId);if(!t)return;
 if(method==='item/agentMessage/delta'){
 let m=t.messages.find(m=>m.id===p.itemId);if(!m){m={id:p.itemId,role:'assistant',text:''};t.messages.push(m)}m.text+=p.delta;
 }
 if(method==='turn/started'){t.turnId=p.turn.id;t.status='running'}
 if(method==='turn/completed'){t.status=p.turn.status;t.error=p.turn.error?.message||null}
 if(method==='error')t.error=p.error?.message||'运行时错误';
 save();publish();
});
const token=randomBytes(32).toString('hex');const port=Number(process.env.PORT||4317);const host=`127.0.0.1:${port}`;
const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))};
const server=http.createServer(async(req,res)=>{
 if(req.headers.host!==host){res.writeHead(403);return res.end('Invalid host')}
 const url=new URL(req.url,`http://${host}`);
 if(!url.pathname.startsWith('/v1/'))return vite.middlewares(req,res);
 res.setHeader('Cache-Control','no-store');
 if(req.headers.origin && req.headers.origin!==`http://${host}`)return json(res,403,{message:'来源不受支持'});
 if(url.pathname==='/v1/bootstrap' && req.method==='GET')return json(res,200,{token,...snapshot()});
 if(req.method==='GET' && url.pathname==='/v1/events'){
 if(!req.headers.cookie?.split('; ').includes(`skyrail=${token}`))return json(res,401,{message:'需要连接会话'});
 res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});clients.add(res);res.write('data: '+JSON.stringify(snapshot())+'\n\n');req.on('close',()=>clients.delete(res));return;
 }
 if(req.method!=='POST'||req.headers['x-skyrail-token']!==token)return json(res,403,{message:'会话校验失败'});
 try{
 let raw='';for await(const c of req){raw+=c;if(raw.length>64000)throw Object.assign(new Error('消息过长'),{status:413})}const body=JSON.parse(raw||'{}');
 if(url.pathname==='/v1/connect'){await codex.connect();runtime='connected';res.setHeader('Set-Cookie',`skyrail=${token}; HttpOnly; SameSite=Strict; Path=/v1`);publish();return json(res,200,snapshot())}
 if(url.pathname==='/v1/threads'){const t={id:randomUUID(),title:'新对话',messages:[],status:'idle'};threads.unshift(t);await save();publish();return json(res,200,t)}
 if(url.pathname==='/v1/control'){lease=transition(lease,body.expectedEpoch,body.owner);publish();return json(res,200,lease)}
 const match=url.pathname.match(/^\/v1\/threads\/([^/]+)\/(messages|stop)$/);const t=threads.find(t=>t.id===match?.[1]);
 if(!t)return json(res,404,{message:'对话不存在'});
 if(match[2]==='stop'){await codex.rpc('turn/interrupt',{threadId:t.codexId,turnId:t.turnId});return json(res,202,{accepted:true})}
 if(typeof body.text!=='string'||!body.text.trim()||typeof body.clientMessageId!=='string')return json(res,400,{message:'请输入消息与消息编号'});
 if(t.messages.some(m=>m.id===body.clientMessageId))return json(res,200,t);
 if(['running','submitting'].includes(t.status))return json(res,409,{message:'请等待当前回复结束后再补充'});
 if(!codex.ready)return json(res,503,{message:'请先连接 Codex'});
 t.status='submitting';t.error=null;t.messages.push({id:body.clientMessageId,role:'user',text:body.text});t.title=body.text.slice(0,26);await save();publish();
 try{
 const cwd=path.join(root,'workspaces',t.id);await mkdir(cwd,{recursive:true});
 if(!t.codexId){const r=await codex.rpc('thread/start',{cwd,approvalPolicy:'untrusted',sandbox:'read-only'});t.codexId=r.thread.id;resumed.add(t.id);await save()}
 else if(!resumed.has(t.id)){await codex.rpc('thread/resume',{threadId:t.codexId,cwd,approvalPolicy:'untrusted',sandbox:'read-only'});resumed.add(t.id)}
 const r=await codex.rpc('turn/start',{threadId:t.codexId,input:[{type:'text',text:body.text}]});t.turnId=r.turn.id;
 if(t.status==='submitting')t.status='running';await save();publish();return json(res,202,t);
 }catch(e){t.status='failed';t.error=e.message;await save();publish();throw e}
 }catch(e){json(res,e.status||500,{message:e.message})}
});
server.listen(port,'127.0.0.1',()=>console.log(`Skyrail ready: http://${host}`));
async function close(){codex.close();for(const c of clients)c.end();await vite.close();server.close();process.exit(0)}
process.on('SIGINT',close);process.on('SIGTERM',close);

import http from 'node:http';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createServer as createViteServer} from 'vite';
import {Codex} from '../../packages/codex/index.mjs';
import {MacStream} from '../../packages/macos/stream.mjs';
import {MacBridge,computerTools,macInstructions} from '../../packages/macos/index.mjs';
const root=path.resolve(import.meta.dirname,'../..');process.chdir(root);
await mkdir('.data',{recursive:true});await mkdir('workspaces',{recursive:true});
let threads=[];try{threads=JSON.parse(await readFile('.data/threads.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
for(const t of threads)if(t.status==='running'||t.status==='submitting')t.status='interrupted';
let persist=Promise.resolve();function save(){const data=JSON.stringify(threads);persist=persist.then(async()=>{await writeFile('.data/threads.tmp',data,{mode:0o600});await rename('.data/threads.tmp','.data/threads.json')});return persist}
const codex=new Codex();let runtime='disconnected';const resumed=new Set();const clients=new Set();
const stream=new MacStream(root);
stream.on('change',()=>publish());
const mac=new MacBridge(root);const approvals=new Map();
mac.on('change',()=>publish());
const snapshot=()=>({threads,runtime,lease:{...mac.state,frame:mac.state.frame?{windowTitle:mac.state.frame.windowTitle,capturedAt:mac.state.frame.capturedAt,width:mac.state.frame.width,height:mac.state.frame.height}:null},stream:stream.state,approvals:[...approvals.values()].map(({resolve,...a})=>a)});
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
codex.toolHandler=async p=>{
 if(p.tool!=='mac_computer')throw Error('未知工具');
 const thread=threads.find(t=>t.codexId===p.threadId);if(!thread)throw Error('线程不存在');
 const epoch=mac.state.epoch;
 if(mac.state.owner!=='agent'||mac.state.threadId!==thread.id)throw Error('请在电脑面板选择应用并交还 Codex');
 if(p.arguments.action!=='observe'){
   await new Promise((resolve,reject)=>{const id=p.callId;const timer=setTimeout(()=>{approvals.delete(id);publish();reject(Error('操作审批已过期'))},120000);approvals.set(id,{id,threadId:thread.id,app:mac.state.app,args:p.arguments,epoch,resolve:allow=>{clearTimeout(timer);allow?resolve():reject(Error('用户拒绝操作'))}});publish()});
 }
 const frame=await mac.execute(thread.id,epoch,p.arguments);
 return {success:true,contentItems:[{type:'inputText',text:frame.text},{type:'inputImage',imageUrl:frame.image}]};
};
const token=randomBytes(32).toString('hex');const port=Number(process.env.PORT||4317);const host=`127.0.0.1:${port}`;
const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))};
const server=http.createServer(async(req,res)=>{
 if(req.headers.host!==host){res.writeHead(403);return res.end('Invalid host')}
 const url=new URL(req.url,`http://${host}`);
 if(!url.pathname.startsWith('/v1/'))return vite.middlewares(req,res);
 res.setHeader('Cache-Control','no-store');
 if(req.headers.origin && req.headers.origin!==`http://${host}`)return json(res,403,{message:'来源不受支持'});
 if(url.pathname==='/v1/bootstrap' && req.method==='GET'){res.setHeader('Set-Cookie',`skyrail=${token}; HttpOnly; SameSite=Strict; Path=/v1`);return json(res,200,{token,...snapshot()})}
 if(url.pathname==='/v1/mac/stream'&&req.method==='GET'){
  if(!req.headers.cookie?.split('; ').includes(`skyrail=${token}`))return json(res,401,{message:'需要连接会话'});
  if(!mac.state.app||url.searchParams.get('threadId')!==mac.state.threadId||url.searchParams.get('app')!==mac.state.app)return json(res,409,{message:'电脑已切换到其他对话或应用'});
  stream.attach(res);return;
 }
 if(req.method==='GET' && url.pathname==='/v1/events'){
 if(!req.headers.cookie?.split('; ').includes(`skyrail=${token}`))return json(res,401,{message:'需要连接会话'});
 res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});clients.add(res);res.write('data: '+JSON.stringify(snapshot())+'\n\n');req.on('close',()=>clients.delete(res));return;
 }
 if(req.method!=='POST'||req.headers['x-skyrail-token']!==token)return json(res,403,{message:'会话校验失败'});
 try{
 let raw='';for await(const c of req){raw+=c;if(raw.length>64000)throw Object.assign(new Error('消息过长'),{status:413})}const body=JSON.parse(raw||'{}');
 if(url.pathname==='/v1/connect'){await codex.connect();runtime='connected';res.setHeader('Set-Cookie',`skyrail=${token}; HttpOnly; SameSite=Strict; Path=/v1`);publish();return json(res,200,snapshot())}
 if(url.pathname==='/v1/threads'){const t={id:randomUUID(),title:'新对话',messages:[],status:'idle'};threads.unshift(t);await save();publish();return json(res,200,t)}
 if(url.pathname==='/v1/mac/health')return json(res,200,await mac.health());
 if(url.pathname==='/v1/mac/permissions')return json(res,200,await mac.rpc('requestPermissions'));
 if(url.pathname==='/v1/mac/windows')return json(res,200,await mac.rpc('windows',{app:body.app}));
 if(url.pathname==='/v1/mac/apps')return json(res,200,await mac.rpc('apps'));
 if(url.pathname==='/v1/mac/bind'){
  if(!threads.some(t=>t.id===body.threadId))return json(res,404,{message:'先创建对话'});
  const target=threads.find(t=>t.id===body.threadId);if(target.codexId&&!target.toolVersion)return json(res,409,{message:'此对话来自旧版，请在历史中创建新对话后连接 Mac'});await mac.bind(body.app,body.threadId,body.windowId);mac.state.humanClientId=body.clientId;stream.select(mac.state.app,mac.state.frame.windowId);publish();return json(res,200,snapshot());
 }
 if(url.pathname==='/v1/mac/input')return json(res,200,await mac.humanInput(body.threadId,body.epoch,body.clientId,body.input||{}));
 if(url.pathname==='/v1/mac/release'){
  if(mac.state.owner!=='human'||body.clientId!==mac.state.humanClientId||body.epoch!==mac.state.epoch)return json(res,409,{message:'控制权已变化'});
  await mac.rpc('releaseInput');return json(res,200,{ok:true});
 }
 if(url.pathname==='/v1/mac/disconnect'){
  if(body.threadId!==mac.state.threadId||body.expectedEpoch!==mac.state.epoch||mac.state.transitioning)return json(res,409,{message:'窗口绑定或控制权已改变'});
  for(const [id,a] of approvals){approvals.delete(id);a.resolve(false)}
  const t=threads.find(t=>t.id===mac.state.threadId);const operation=mac.disconnect(body.expectedEpoch);stream.select(null,null);
  if(t?.status==='running')codex.rpc('turn/interrupt',{threadId:t.codexId,turnId:t.turnId}).catch(()=>{});
  await operation;publish();return json(res,200,snapshot());
 }
 if(url.pathname==='/v1/mac/observe'){await mac.observe();return json(res,200,snapshot())}
 if(url.pathname==='/v1/approval'){
  const approval=approvals.get(body.id);if(!approval)return json(res,409,{message:'审批已失效'});
  approvals.delete(body.id);approval.resolve(body.allow===true);publish();return json(res,200,{ok:true});
 }
 if(url.pathname==='/v1/control'){
  if(body.threadId!==mac.state.threadId||body.expectedEpoch!==mac.state.epoch||mac.state.transitioning)return json(res,409,{message:'此电脑的对话或控制权已变化，请重新确认'});
  for(const [id,a] of approvals){approvals.delete(id);a.resolve(false)}
  const control=mac.control(body.expectedEpoch,body.owner);
  if(body.owner!=='agent'){
   const t=threads.find(t=>t.id===mac.state.threadId);
   if(t?.status==='running')codex.rpc('turn/interrupt',{threadId:t.codexId,turnId:t.turnId}).catch(()=>{});
  }
  await control;mac.state.humanClientId=body.owner==='human'?body.clientId:null;publish();return json(res,200,snapshot());
 }
 const match=url.pathname.match(/^\/v1\/threads\/([^/]+)\/(messages|stop)$/);const t=threads.find(t=>t.id===match?.[1]);
 if(!t)return json(res,404,{message:'对话不存在'});
 if(match[2]==='stop'){if(mac.state.threadId===t.id)await mac.control(mac.state.epoch,'none');for(const [id,a] of approvals){if(a.threadId===t.id){approvals.delete(id);a.resolve(false)}}await codex.rpc('turn/interrupt',{threadId:t.codexId,turnId:t.turnId});return json(res,202,{accepted:true})}
 if(typeof body.text!=='string'||!body.text.trim()||typeof body.clientMessageId!=='string')return json(res,400,{message:'请输入消息与消息编号'});
 if(t.messages.some(m=>m.id===body.clientMessageId))return json(res,200,t);
 if(['running','submitting'].includes(t.status))return json(res,409,{message:'请等待当前回复结束后再补充'});
 if(!codex.ready)return json(res,503,{message:'请先连接 Codex'});
 t.status='submitting';t.error=null;t.messages.push({id:body.clientMessageId,role:'user',text:body.text});t.title=body.text.slice(0,26);await save();publish();
 try{
 const cwd=path.join(root,'workspaces',t.id);await mkdir(cwd,{recursive:true});
 if(!t.codexId){const r=await codex.rpc('thread/start',{cwd,approvalPolicy:'untrusted',sandbox:'read-only',dynamicTools:computerTools,developerInstructions:macInstructions});t.codexId=r.thread.id;t.toolVersion='mac-v1';resumed.add(t.id);await save()}
 else if(!resumed.has(t.id)){await codex.rpc('thread/resume',{threadId:t.codexId,cwd,approvalPolicy:'untrusted',sandbox:'read-only',developerInstructions:macInstructions});resumed.add(t.id)}
 const r=await codex.rpc('turn/start',{threadId:t.codexId,input:[{type:'text',text:body.text}]});t.turnId=r.turn.id;
 if(t.status==='submitting')t.status='running';await save();publish();return json(res,202,t);
 }catch(e){t.status='failed';t.error=e.message;await save();publish();throw e}
 }catch(e){json(res,e.status||500,{message:e.message})}
});
server.listen(port,'127.0.0.1',()=>console.log(`Skyrail ready: http://${host}`));
async function close(){stream.stop();await mac.close();codex.close();for(const c of clients)c.end();await vite.close();server.close();process.exit(0)}
process.on('SIGINT',close);process.on('SIGTERM',close);

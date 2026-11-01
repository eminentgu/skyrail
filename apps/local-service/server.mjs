import http from 'node:http';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {userInfo} from 'node:os';
import {createClientHandler} from './client.mjs';
import {projectForCwd} from '../../packages/codex/projects.mjs';
import {createServer as createViteServer} from 'vite';
import {Codex} from '../../packages/codex/index.mjs';
import {SessionWriters} from '../../packages/codex/writers.mjs';
import {prepareSession} from '../../packages/codex/session.mjs';
import {readSession,applySession,messagesFromTurns} from '../../packages/codex/history.mjs';
import {MacStream} from '../../packages/macos/stream.mjs';
import {MacPower} from '../../packages/macos/power.mjs';
import {DesktopConsole,probeDesktop,rejectUpgrade} from '../../packages/macos/desktop.mjs';
import {MacBridge,computerTools,macInstructions} from '../../packages/macos/index.mjs';
const root=path.resolve(import.meta.dirname,'../..');process.chdir(root);
await mkdir('.data',{recursive:true});await mkdir('workspaces',{recursive:true});
let threads=[];try{threads=JSON.parse(await readFile('.data/threads.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
for(const t of threads)if(['running','submitting','syncing'].includes(t.status))t.status='interrupted';
let persist=Promise.resolve();function save(){const data=JSON.stringify(threads);persist=persist.then(async()=>{await writeFile('.data/threads.tmp',data,{mode:0o600});await rename('.data/threads.tmp','.data/threads.json')});return persist}
const skillPath=path.join(root,'skills/skyrail-computer-use/SKILL.md');
const skillText=await readFile(skillPath,'utf8');
const instructions=macInstructions+'\n\n'+skillText;
const codex=new Codex();let runtime='disconnected';const resumed=new Set();const clients=new Set();
const historyCodex=new Codex();const syncing=new Map();
const writers=new SessionWriters({onNotification:handleNotification,onTool:p=>codex.toolHandler(p),onOffline:(thread,message)=>{
 resumed.delete(thread.id);thread.status='interrupted';thread.error=message;
 for(const [id,a] of approvals)if(a.threadId===thread.id){approvals.delete(id);a.resolve(false)}
 if(mac.state.threadId===thread.id&&mac.state.owner==='agent'&&!mac.state.transitioning)void mac.control(mac.state.epoch,'none').catch(()=>{});
 void save();publish();
}});
async function syncNative(thread){
 if(!thread.codexId||['running','submitting','syncing'].includes(thread.status))return;
 if(syncing.has(thread.id))return syncing.get(thread.id);
 const work=(async()=>{
  try{
   await historyCodex.connect();const native=await readSession(historyCodex,thread.codexId);
   const previousMessages=[];
   for(const id of new Set(thread.previousCodexIds||[]))if(id!==thread.codexId)previousMessages.push(...messagesFromTurns((await readSession(historyCodex,id)).turns));
   const changed=applySession(thread,native,{previousMessages});if(changed)await save();publish();return native;
  }catch(e){thread.syncError=e.message;publish();throw e}
 })().finally(()=>syncing.delete(thread.id));syncing.set(thread.id,work);return work;
}
const stream=new MacStream(root);
const power=new MacPower({onError:()=>console.warn('Skyrail could not prevent system idle sleep')});
const syncPower=()=>power.setActive(desktop.connected||desktop.active||stream.clients.size>0||threads.some(t=>['running','submitting'].includes(t.status)),{display:desktop.connected||desktop.active||stream.clients.size>0||!!(mac.state.app&&!mac.state.health?.locked&&threads.some(t=>t.id===mac.state.threadId&&['running','submitting'].includes(t.status)))});
stream.on('activity',syncPower);
stream.on('change',()=>publish());
const mac=new MacBridge(root,{power});const approvals=new Map();
const desktop=new DesktopConsole({beforeAcquire:async()=>{
 for(const [id,a] of approvals){approvals.delete(id);a.resolve(false)}
 if(mac.state.transitioning)throw Object.assign(Error('窗口正在交接，请稍后打开人工控制台'),{status:409});
 if(mac.state.app){await mac.disconnect(mac.state.epoch);stream.select(null,null)}
 await Promise.all(threads.filter(t=>['running','submitting'].includes(t.status)&&writers.get(t.id)).map(t=>interruptThread(t).catch(()=>{})));
}});
desktop.on('change',()=>publish());
mac.externalControl=()=>desktop.active;
mac.on('change',()=>publish());
const serviceId=randomUUID();
const snapshot=()=>({service:{id:serviceId,protocol:8},desktop:desktop.status(),threads:threads.filter(t=>!t.deletedAt),deletedThreads:threads.filter(t=>t.deletedAt).map(t=>({id:t.id,title:t.title,deletedAt:t.deletedAt})),runtime,lease:{...mac.state,frame:mac.state.frame?{windowTitle:mac.state.frame.windowTitle,capturedAt:mac.state.frame.capturedAt,width:mac.state.frame.width,height:mac.state.frame.height}:null},stream:stream.state,approvals:[...approvals.values()].map(({resolve,...a})=>a)});
function publish(){syncPower();const data='data: '+JSON.stringify(snapshot())+'\n\n';for(const c of clients)c.write(data)}
codex.on('offline',()=>{runtime='disconnected';publish()});
function handleNotification({method,params:p}){
 const t=threads.find(t=>t.codexId===p?.threadId);if(!t)return;
 if(method==='item/agentMessage/delta'){
 let m=t.messages.find(m=>m.id===p.itemId);if(!m){m={id:p.itemId,role:'assistant',text:'',createdAt:new Date().toISOString()};t.messages.push(m)}m.text+=p.delta;
 }
 if(method==='turn/started'){t.turnId=p.turn.id;t.status='running'}
 if(method==='turn/completed'){
  t.status='syncing';t.error=p.turn.error?.message||null;
  void (async()=>{try{await writers.release(t.id);resumed.delete(t.id);t.needsResume=true}catch(e){t.syncError=e.message}finally{t.status=p.turn.status;await save();await syncNative(t).catch(()=>{});publish()}})().catch(e=>{t.status='failed';t.error='会话记录保存失败：'+e.message;publish()});
 }
 if(method==='error')t.error=p.error?.message||'运行时错误';
 save();publish();
}
function interruptThread(thread){const writer=writers.get(thread.id);if(!writer)return Promise.reject(Object.assign(Error('这个轮次不由 Skyrail 执行，请在原 Codex 客户端停止'),{status:409}));return writer.rpc('turn/interrupt',{threadId:thread.codexId,turnId:thread.turnId})}
function askApproval(thread,info){
 return new Promise((resolve,reject)=>{
  const id=info.id;const timer=setTimeout(()=>{approvals.delete(id);publish();reject(Error('等待确认已超时；请重新发送任务'))},120000);
  approvals.set(id,{...info,threadId:thread.id,resolve:(allow,options={})=>{clearTimeout(timer);allow?resolve(options):reject(Error('你拒绝了这次操作'))}});publish();
 });
}
const labels={status:'检查电脑连接',list_apps:'查看 Mac 应用',open_app:'打开应用',observe:'观察窗口',press:'点击控件',setValue:'填写内容',key:'按键操作'};
codex.toolHandler=async p=>{
 if(p.tool!=='skyrail_computer')throw Error('请使用 skyrail_computer；当前客户端不提供桌面宿主的 Computer Use 授权');
 const thread=threads.find(t=>t.codexId===p.threadId);if(!thread)throw Error('线程不存在');
 const args=p.arguments;const activity={id:'tool:'+p.callId,role:'tool',action:args.action,app:args.app||mac.state.app,text:labels[args.action]||'电脑操作',status:'running',createdAt:new Date().toISOString()};
 thread.messages.push(activity);let openedApp=null;await save();publish();
 const finish=async(result)=>{activity.status='completed';await save();publish();return {success:true,contentItems:[{type:'inputText',text:result.text},...(result.image?[{type:'inputImage',imageUrl:result.image}]:[])]}};
 try{
  if(!['status','list_apps'].includes(args.action)){if(desktop.active)throw Error('电脑正在由用户操作；请等待用户交给 Codex，桌面连接无需断开');mac.assertUnlocked();}
  if(args.action==='status'){const health=await mac.health();return await finish({text:JSON.stringify({backend:'Skyrail native macOS',systemPermissions:health,app:mac.state.app,owner:mac.state.owner,boundToThisThread:mac.state.threadId===thread.id,confirmationMode:mac.state.approvalMode,guidance:health.locked?'Mac 当前已锁屏，请用户在电脑页接手并手动解锁，桌面连接可保留':!health.accessibility||!health.screenRecording?'打开电脑面板中的系统权限入口':!mac.state.app?'调用 open_app 请求应用授权并连接窗口':'observe 获取当前窗口；写操作由聊天审批卡确认'})})}
  if(args.action==='list_apps')return await finish({text:JSON.stringify(await mac.rpc('apps'))});
  if(args.action==='open_app'){
   if(typeof args.app!=='string'||!args.app.trim())throw Error('请提供要打开的应用名称');
   activity.status='waiting_approval';publish();
   const permission=await askApproval(thread,{id:p.callId,kind:'application',app:args.app,args:{action:'open_app',app:args.app}});
   activity.status='running';publish();
   const launched=await mac.rpc('openApp',{app:args.app});openedApp=launched.name;
   const frame=await mac.bind(launched.app,thread.id);
   stream.select(mac.state.app,frame.windowId);await mac.control(mac.state.epoch,'agent');mac.state.humanClientId=null;if(permission.allowAll)mac.setApprovalMode(thread.id,mac.state.epoch,mac.state.sessionId,'allow_session');
   mac.agentObservationVersion=mac.state.observationVersion;
   activity.app=launched.name;activity.text='已打开 '+launched.name;
   return await finish({text:'Skyrail 已打开并观察应用 '+launched.name+'。当前由 Codex 控制。\n'+mac.state.frame.text,image:mac.state.frame.image});
  }
  const epoch=mac.state.epoch;
  if(mac.state.threadId!==thread.id||mac.state.owner!=='agent')throw Error('SKYRAIL_CONTROL_REQUIRED：当前应用未交给 Codex。请在电脑面板点击“交给 Codex”，或调用 open_app 请求连接应用；这不是 macOS 权限被拒绝。');
  if(args.action!=='observe'&&mac.state.approvalMode!=='allow_session'){
   activity.status='waiting_approval';publish();
   const permission=await askApproval(thread,{id:p.callId,kind:'operation',app:mac.state.app,args,epoch,sessionId:mac.state.sessionId});
   if(permission.allowAll)mac.setApprovalMode(thread.id,epoch,mac.state.sessionId,'allow_session');
   activity.status='running';publish();
  }
  const frame=await mac.execute(thread.id,epoch,args);return await finish(frame);
 }catch(e){const reason=openedApp?'应用 '+openedApp+' 已打开，但画面连接未完成：'+e.message:e.message;activity.status='failed';activity.error=reason;await save();publish();return {success:false,contentItems:[{type:'inputText',text:reason}]}}
};
const token=randomBytes(32).toString('hex');const port=Number(process.env.PORT||4317);const host=`127.0.0.1:${port}`;
const production=process.env.SKYRAIL_MANAGED_SERVICE==='1'||process.env.SKYRAIL_SERVE_DIST==='1';
const vite=production?null:await createViteServer({server:{middlewareMode:true},appType:'spa'});
const clientHandler=production?await createClientHandler(path.join(root,'dist'),{snapshotTo:path.join(root,'.data/client-build',serviceId)}):(req,res)=>vite.middlewares(req,res);
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))};
const server=http.createServer(async(req,res)=>{
 if(req.headers.host!==host){res.writeHead(403);return res.end('Invalid host')}
 const url=new URL(req.url,`http://${host}`);
 if(!url.pathname.startsWith('/v1/'))return clientHandler(req,res);
 res.setHeader('Cache-Control','no-store');
 if(req.headers.origin && req.headers.origin!==`http://${host}`)return json(res,403,{message:'来源不受支持'});
 if(url.pathname==='/v1/bootstrap' && req.method==='GET'){res.setHeader('Set-Cookie',`skyrail=${token}; HttpOnly; SameSite=Strict; Path=/v1`);return json(res,200,{token,...snapshot()})}
 if(url.pathname==='/v1/mac/stream'&&req.method==='GET'){
  if(!req.headers.cookie?.split('; ').includes(`skyrail=${token}`))return json(res,401,{message:'需要连接会话'});
  if(!mac.state.app||url.searchParams.get('threadId')!==mac.state.threadId||url.searchParams.get('app')!==mac.state.app)return json(res,409,{message:'电脑已切换到其他对话或应用'});
  try{mac.assertUnlocked()}catch(e){return json(res,e.status||423,{message:e.message})}
  stream.attach(res);return;
 }
 if(req.method==='GET' && url.pathname==='/v1/events'){
 if(!req.headers.cookie?.split('; ').includes(`skyrail=${token}`))return json(res,401,{message:'需要连接会话'});
 res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});clients.add(res);res.write('data: '+JSON.stringify(snapshot())+'\n\n');req.on('close',()=>clients.delete(res));return;
 }
 if(req.method!=='POST'||req.headers['x-skyrail-token']!==token)return json(res,403,{message:'会话校验失败'});
 try{
 let raw='';for await(const c of req){raw+=c;if(raw.length>64000)throw Object.assign(new Error('消息过长'),{status:413})}const body=JSON.parse(raw||'{}');
 if(url.pathname==='/v1/desktop/status')return json(res,200,{...await probeDesktop(),...desktop.status(),username:userInfo().username});
 if(url.pathname==='/v1/desktop/start')return json(res,200,await desktop.start(body.clientId,{replace:body.replace===true}));
 if(url.pathname==='/v1/desktop/renew')return json(res,200,desktop.renew(body.clientId,body.ticket));
 if(url.pathname==='/v1/desktop/stop'){desktop.stop(body.clientId,body.ticket);return json(res,200,{ok:true})}
 if(url.pathname==='/v1/desktop/control')return json(res,200,await desktop.control(body.clientId,body.ticket,body.mode));
 if(desktop.active&&['/v1/mac/bind','/v1/mac/observe','/v1/mac/input','/v1/mac/policy','/v1/control','/v1/mac/disconnect'].includes(url.pathname))return json(res,409,{message:'请先将电脑交给 Codex，再连接应用；无需断开桌面'});
 if(url.pathname==='/v1/connect'){await codex.connect();runtime='connected';res.setHeader('Set-Cookie',`skyrail=${token}; HttpOnly; SameSite=Strict; Path=/v1`);publish();for(const t of threads)if(t.codexId&&!t.deletedAt)void syncNative(t).catch(()=>{});return json(res,200,snapshot())}
 if(url.pathname==='/v1/threads'){const t={id:randomUUID(),title:'新对话',messages:[],status:'idle'};threads.unshift(t);await save();publish();return json(res,200,t)}
 if(url.pathname==='/v1/sessions/list'){
  await historyCodex.connect();const result=await historyCodex.rpc('thread/list',{limit:30,sourceKinds:['cli','vscode','exec','appServer','unknown'],sortKey:'updated_at',...(body.cursor?{cursor:body.cursor}:{}),...(body.search?{searchTerm:String(body.search).slice(0,200)}:{})});
  const sessions=await Promise.all(result.data.map(async t=>({id:t.id,title:t.name||t.preview?.slice(0,80)||'未命名会话',cwd:t.cwd,project:await projectForCwd(t.cwd),updatedAt:t.updatedAt,originator:t.originator,linked:threads.some(local=>local.codexId===t.id&&!local.deletedAt)})));
  return json(res,200,{sessions,nextCursor:result.nextCursor});
 }
 if(url.pathname==='/v1/sessions/import'){
  if(typeof body.codexId!=='string'||body.codexId.length>150)throw Error('无效的 Codex 会话编号');
  await historyCodex.connect();const native=await readSession(historyCodex,body.codexId);
  let t=threads.find(t=>t.codexId===native.id);
  if(!t){t={id:randomUUID(),title:native.name||native.preview?.slice(0,50)||'Codex 会话',messages:[],status:'idle',codexId:native.id,originator:native.originator,imported:true};threads.unshift(t)}
  if(!['running','submitting','syncing'].includes(t.status)){t.deletedAt=null;applySession(t,native);await save()}publish();return json(res,200,{threadId:t.id,...snapshot()});
 }
 if(url.pathname==='/v1/mac/health')return json(res,200,await mac.health());
 if(url.pathname==='/v1/mac/permissions')return json(res,200,await mac.rpc('requestPermissions'));
 if(url.pathname==='/v1/mac/windows')return json(res,200,await mac.rpc('windows',{app:body.app}));
 if(url.pathname==='/v1/mac/apps')return json(res,200,await mac.rpc('apps'));
 if(url.pathname==='/v1/mac/bind'){
  if(!threads.some(t=>t.id===body.threadId&&!t.deletedAt))return json(res,404,{message:'先创建对话'});
  mac.assertUnlocked();
  const target=threads.find(t=>t.id===body.threadId);await mac.bind(body.app,body.threadId,body.windowId);mac.state.humanClientId=body.clientId;stream.select(mac.state.app,mac.state.frame.windowId);publish();return json(res,200,snapshot());
 }
 if(url.pathname==='/v1/mac/policy'){
  mac.setApprovalMode(body.threadId,body.expectedEpoch,body.sessionId,body.mode);publish();return json(res,200,snapshot());
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
  if(t?.status==='running')interruptThread(t).catch(()=>{});
  await operation;publish();return json(res,200,snapshot());
 }
 if(url.pathname==='/v1/mac/observe'){await mac.observe();return json(res,200,snapshot())}
 if(url.pathname==='/v1/approval'){
  const approval=approvals.get(body.id);if(!approval)return json(res,409,{message:'审批已失效'});
  approvals.delete(body.id);approval.resolve(body.allow===true,{allowAll:body.allowAll===true});publish();return json(res,200,{ok:true});
 }
 if(url.pathname==='/v1/control'){
  if(body.threadId!==mac.state.threadId||body.expectedEpoch!==mac.state.epoch||mac.state.transitioning)return json(res,409,{message:'此电脑的对话或控制权已变化，请重新确认'});
  for(const [id,a] of approvals){approvals.delete(id);a.resolve(false)}
  const control=mac.control(body.expectedEpoch,body.owner);
  if(body.owner!=='agent'){
   const t=threads.find(t=>t.id===mac.state.threadId);
   if(t?.status==='running')interruptThread(t).catch(()=>{});
  }
  await control;mac.state.humanClientId=body.owner==='human'?body.clientId:null;publish();return json(res,200,snapshot());
 }
 const match=url.pathname.match(/^\/v1\/threads\/([^/]+)\/(messages|stop|delete|restore|sync)$/);const t=threads.find(t=>t.id===match?.[1]);
 if(!t)return json(res,404,{message:'对话不存在'});
 if(match[2]==='delete'){
  if(['running','submitting','syncing'].includes(t.status))return json(res,409,{message:'这段对话仍在执行或同步，请等待结束后再删除'});
  if(mac.state.threadId===t.id){await mac.disconnect(mac.state.epoch);stream.select(null,null)}
  t.deletedAt=new Date().toISOString();await save();publish();return json(res,200,snapshot());
 }
 if(match[2]==='restore'){t.deletedAt=null;await save();publish();return json(res,200,snapshot())}
 if(t.deletedAt)return json(res,410,{message:'这段对话已移到最近删除，可从历史记录恢复'});
 if(match[2]==='sync'){await syncNative(t);return json(res,200,snapshot())}
 if(match[2]==='stop'){if(mac.state.threadId===t.id)await mac.control(mac.state.epoch,'none');for(const [id,a] of approvals){if(a.threadId===t.id){approvals.delete(id);a.resolve(false)}}await interruptThread(t);return json(res,202,{accepted:true})}
 if(desktop.active)return json(res,409,{message:'人工全桌面控制期间已暂停新任务，请先断开控制台'});
 if(typeof body.text!=='string'||!body.text.trim()||typeof body.clientMessageId!=='string')return json(res,400,{message:'请输入消息与消息编号'});
 if(t.messages.some(m=>m.id===body.clientMessageId))return json(res,200,t);
 if(['running','submitting','syncing'].includes(t.status))return json(res,409,{message:'请等待当前回复与记录同步结束后再补充'});
 if(t.codexId)await syncNative(t);
 if(t.status==='external_running')return json(res,409,{message:'这个会话正在其他 Codex 客户端执行；请等待结束后同步记录再继续'});
 await codex.connect();runtime='connected';
 if(t.messages.some(m=>m.id===body.clientMessageId))return json(res,200,t);
 if(['running','submitting','syncing','external_running'].includes(t.status))return json(res,409,{message:'会话正在执行或同步，请等待结束后继续'});
 t.status='submitting';t.error=null;if(mac.state.threadId===t.id)mac.agentObservationVersion=-1;const userMessage={id:body.clientMessageId,role:'user',text:body.text,createdAt:new Date().toISOString(),pending:true};t.messages.push(userMessage);if(!t.title||t.title==='新对话')t.title=body.text.slice(0,40);await save();publish();
 let turnRequested=false;
 try{
 const cwd=t.cwd||path.join(root,'workspaces',t.id);await mkdir(cwd,{recursive:true});
 const writer=await writers.acquire(t);
 await prepareSession(writer,t,{cwd,tools:computerTools,instructions,resumed,save});
 if(!t.nativeNamed&&!t.imported){try{await writer.rpc('thread/name/set',{threadId:t.codexId,name:t.title});t.nativeNamed=true}catch{}}
 const input=[{type:'skill',name:'skyrail-computer-use',path:skillPath},{type:'text',text:body.text}];
 if(desktop.active)throw Object.assign(Error('人工控制台已打开，新任务已取消；请关闭控制台后再发送'),{status:409});
 turnRequested=true;const r=await writer.rpc('turn/start',{threadId:t.codexId,input,clientUserMessageId:body.clientMessageId});t.turnId=r.turn.id;userMessage.pending=false;
 if(t.status==='submitting')t.status='running';await save();publish();return json(res,202,t);
 }catch(e){
  if(!turnRequested)t.messages=t.messages.filter(m=>m!==userMessage);
  if(/active writer/i.test(e.message)){e.message='这个 Codex 会话仍由另一客户端占用。请在原客户端释放会话后重试；记录仍可同步。';e.status=409}
  t.status='failed';t.error=e.message;await writers.release(t.id).catch(()=>{});resumed.delete(t.id);await save();publish();throw e;
 }
 }catch(e){json(res,e.status||500,{message:e.message})}
});
server.on('upgrade',(req,socket,head)=>{if(new URL(req.url,`http://${host}`).pathname==='/v1/desktop/socket')desktop.upgrade(req,socket,head,{host,token});else if(production||!req.headers['sec-websocket-protocol']?.includes('vite-hmr'))rejectUpgrade(socket)});
let checkingLock=false;
const lockTimer=setInterval(async()=>{
 if(checkingLock||!clients.size)return;checkingLock=true;
 try{
  const status=mac.readStatus();const changed=mac.state.health?.locked!==status.locked||mac.state.health?.available!==status.available;
  mac.state.health={...mac.state.health,...status};if(changed)publish();
  if(status.locked&&mac.state.app&&!mac.state.transitioning){
   for(const [id,a] of approvals){approvals.delete(id);a.resolve(false)}
   const target=threads.find(t=>t.id===mac.state.threadId);const disconnect=mac.disconnect(mac.state.epoch);stream.select(null,null);
   if(target?.status==='running')void interruptThread(target).catch(()=>{});
   await disconnect;publish();
  }
 }catch{}finally{checkingLock=false}
},2000);lockTimer.unref();
server.listen(port,'127.0.0.1',()=>console.log(`Skyrail ready: http://${host}`));
let closing=false;
async function close(){if(closing)return;closing=true;clearInterval(lockTimer);desktop.close();power.close();stream.stop();await mac.close();await writers.close();codex.close();historyCodex.close();for(const c of clients)c.end();await vite?.close();server.close();process.exit(0)}
process.on('SIGINT',close);process.on('SIGTERM',close);
// launchctl can terminate the native wrapper before its Node child. Do not leave
// an orphan holding the port and the previous macOS permission attribution.
if(process.env.SKYRAIL_MANAGED_SERVICE==='1'){
 const wrapperPid=process.ppid;
 setInterval(()=>{try{process.kill(wrapperPid,0)}catch{void close()}},1000).unref();
}

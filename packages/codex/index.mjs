import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {EventEmitter} from 'node:events';
export class Codex extends EventEmitter {
 pending=new Map();nextId=0;ready=false;
 constructor({launch=spawn}={}){super();this.launch=launch}
 async connect(){
  if(this.ready)return;if(this.connecting)return this.connecting;
  const promise=this.initialize().catch(e=>{if(this.connecting===promise)this.connecting=null;throw e});this.connecting=promise;return promise;
 }
 async initialize(){
  const child=this.launch(process.env.CODEX_BIN||'codex',['app-server','--listen','stdio://','--disable','computer_use',
   '-c','mcp_servers.computer-use.enabled=false','-c','mcp_servers.node_repl.enabled=false',
   '-c','plugins."computer-use@openai-bundled".enabled=false','-c','plugins."unified-computer-use@openai-bundled".enabled=false'],{stdio:['pipe','pipe','pipe']});
  this.child=child;const live=()=>this.child===child;
  child.stderr.on('data',()=>{});child.stdin.on('error',e=>this.fail(e,child));
  child.on('error',e=>this.fail(e,child));child.on('exit',()=>this.fail(Error('Codex 进程已退出，正在等待重新连接'),child));
  createInterface({input:child.stdout}).on('line',line=>{
   if(!live())return;let msg;try{msg=JSON.parse(line)}catch{return}
   if(msg.id!==undefined&&!msg.method){
    const p=this.pending.get(msg.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(msg.id);
    msg.error?p.reject(Object.assign(Error(msg.error.message),{code:msg.error.code,details:msg.error.data})):p.resolve(msg.result);
   }else if(msg.method&&msg.id!==undefined){
    if(msg.method==='item/tool/call'&&this.toolHandler){
     Promise.resolve().then(()=>this.toolHandler(msg.params)).then(result=>this.respond(msg.id,result,child)).catch(e=>this.respond(msg.id,{contentItems:[{type:'inputText',text:e.message}],success:false},child));
    }else if(live())child.stdin.write(JSON.stringify({id:msg.id,error:{code:-32601,message:'Skyrail 尚未支持此请求；不会自动批准'}})+'\n');
   }else if(msg.method)this.emit('notification',msg);
  });
  try{
   await this.rpc('initialize',{clientInfo:{name:'skyrail',title:'Skyrail',version:'0.2.0'},capabilities:{experimentalApi:true}});
   if(!live())throw Error('Codex 连接已被替换');child.stdin.write(JSON.stringify({method:'initialized'})+'\n');this.ready=true;
  }catch(e){this.fail(e,child);throw e}
 }
 respond(id,result,child=this.child){if(child&&this.child===child&&child.stdin.writable)child.stdin.write(JSON.stringify({id,result})+'\n')}
 fail(e,child=this.child){
  if(child!==this.child)return;this.child=null;this.ready=false;this.connecting=null;child?.kill();
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e)}this.pending.clear();this.emit('offline',e.message);
 }
 rpc(method,params){return new Promise((resolve,reject)=>{
  if(!this.child?.stdin.writable)return reject(Error('Codex 未连接，请重新连接后继续'));
  const id=++this.nextId;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Codex 请求超时，结果需核对；请勿重复发送任务'))},30000);
  this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,method,params})+'\n');
 })}
 close(){this.fail(Error('Codex 连接已关闭'))}
 async closeAndWait(){
  const child=this.child;if(!child)return;
  if(child.exitCode!==null&&child.exitCode!==undefined){this.close();return}
  let timer;const exited=new Promise(resolve=>child.once('exit',resolve));
  this.close();await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(()=>{child.kill('SIGKILL');resolve()},3000)})]);clearTimeout(timer);
 }
}

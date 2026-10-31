import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {EventEmitter} from 'node:events';
export class Codex extends EventEmitter {
  pending=new Map(); nextId=0; ready=false;
  async connect(){
    if(this.ready) return;
    if(this.connecting) return this.connecting;
    this.connecting=this.initialize().catch(e=>{this.connecting=null;throw e});
    return this.connecting;
  }
  async initialize(){
    this.child=spawn(process.env.CODEX_BIN||'codex',['app-server','--listen','stdio://'],{stdio:['pipe','pipe','pipe']});
    this.child.stderr.on('data',()=>{});
    this.child.on('error',e=>this.fail(e));
    this.child.on('exit',()=>this.fail(new Error('Codex 进程已退出，请重启本地服务')));
    createInterface({input:this.child.stdout}).on('line',line=>{
      let msg;try{msg=JSON.parse(line)}catch{return}
      if(msg.id!==undefined && !msg.method){const p=this.pending.get(msg.id);if(p){clearTimeout(p.timer);this.pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result)}}
      else if(msg.method && msg.id!==undefined){
        // Unimplemented server requests fail closed; never silently approve execution.
        this.child.stdin.write(JSON.stringify({id:msg.id,error:{code:-32601,message:'Skyrail 尚未支持此审批或工具请求'}})+'\n');
        this.emit('approvalUnsupported',msg.method);
      } else if(msg.method) this.emit('notification',msg);
    });
    await this.rpc('initialize',{clientInfo:{name:'skyrail',title:'Skyrail',version:'0.1.0'}});
    this.child.stdin.write(JSON.stringify({method:'initialized'})+'\n');this.ready=true;
  }
  fail(e){this.ready=false;this.connecting=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e)}this.pending.clear();this.emit('offline',e.message)}
  rpc(method,params){return new Promise((resolve,reject)=>{const id=++this.nextId;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Codex 请求超时，结果需核对；请勿重复发送任务'))},30000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,method,params})+'\n')})}
  close(){this.child?.kill()}
}

import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
export class DesktopCredentials {
 constructor(root,{launch=spawn,available}={}){this.executable=path.join(root,'.data/SkyrailCredentials');this.launch=launch;this.available=available??existsSync(this.executable);this.queue=Promise.resolve();}
 async run(method,value){
  if(!this.available)return {saved:false,available:false};
  const job=this.queue.then(()=>this.dispatch(method,value));this.queue=job.catch(()=>{});return job;
 }
 dispatch(method,value){
  return new Promise((resolve,reject)=>{
   const child=this.launch(this.executable,[method],{stdio:['pipe','pipe','pipe']});let output='';
   const timer=setTimeout(()=>{child.kill();reject(Error('本机钥匙串没有响应，请手动连接'))},4000);
   child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
   child.stdout.on('data',data=>{output+=data;if(output.length>16000){child.kill();clearTimeout(timer);reject(Error('钥匙串返回无效数据'))}});
   child.on('error',()=>{clearTimeout(timer);reject(Error('无法访问本机钥匙串，请手动连接'))});
   child.on('exit',code=>{clearTimeout(timer);try{const result=JSON.parse(output);if(code!==0||result.error)throw Error();resolve({...result,available:true})}catch{reject(Error('钥匙串暂不可用，请手动连接；未更改系统登录设置'))}});
   // Passwords are passed only over stdin, never as process arguments or logs.
   child.stdin.end(value?JSON.stringify(value):'');
  });
 }
 async status(){try{return await this.run('status')}catch{return {saved:false,available:this.available,locked:true}}}
 read(){return this.run('get')}
 save(value){if(!this.available)throw Error('当前无法记住连接，请手动输入');if(!value||typeof value.username!=='string'||typeof value.password!=='string'||!value.password||value.username.length>256||value.password.length>2048)throw Error('无效连接凭据');return this.run('set',{username:value.username,password:value.password})}
 forget(){return this.run('delete')}
}

// A remembered password is only released once, to the browser that owns a real
// RFB authentication handshake. Saving requires successful RFB authentication.
export async function desktopCredentialRequest(desktop, store, action, body) {
 const lease=desktop.verify(body.clientId,body.ticket);
 const denied=message=>{throw Object.assign(Error(message),{status:409})};
 if(action==='read'){
  if(!lease.ws||lease.gate?.cs!=='auth'||!['ard','challenge','wait-auth'].includes(lease.gate?.ss)||lease.credentialsRead)
   denied('连接凭据只在首次认证时提供');
  lease.credentialsRead=true;
  return store.read();
 }
 if(action==='save'){
  if(!lease.gate?.ready)denied('连接成功后才能记住凭据');
  return store.save(body.credentials);
 }
 denied('不支持的凭据请求');
}

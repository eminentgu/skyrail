import{Codex}from'./index.mjs';
// A local app-server keeps an idle writer for its inactivity grace period.
// Close only the finished session's process so another client can take over.
export class SessionWriters {
 constructor({create=()=>new Codex(),onNotification=()=>{},onTool,onOffline=()=>{}}={}){this.create=create;this.onNotification=onNotification;this.onTool=onTool;this.onOffline=onOffline;this.entries=new Map()}
 async acquire(thread){
  let writer=this.entries.get(thread.id);
  if(!writer){
   writer=this.create();this.entries.set(thread.id,writer);
   writer.on('notification',message=>this.onNotification(message));
   writer.on('offline',message=>{if(this.entries.get(thread.id)!==writer)return;this.entries.delete(thread.id);this.onOffline(thread,message)});
   writer.toolHandler=params=>{if(params.threadId!==thread.codexId)throw Error('会话工具请求不属于当前执行连接');return this.onTool(params)};
  }
  await writer.connect();return writer;
 }
 get(id){return this.entries.get(id)}
 async release(id){const writer=this.entries.get(id);if(!writer)return;this.entries.delete(id);await writer.closeAndWait()}
 async close(){await Promise.all([...this.entries.keys()].map(id=>this.release(id)))}
}

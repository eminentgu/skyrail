import {createHash} from 'node:crypto';
const labels={status:'检查电脑连接',list_apps:'查看 Mac 应用',open_app:'打开应用',observe:'观察窗口',press:'点击控件',setValue:'填写内容',key:'按键操作'};
const completedStatus=(item)=>item.success===false||['failed','declined'].includes(item.status)?'failed':['inProgress','in_progress'].includes(item.status)?'running':'completed';
export function messagesFromTurns(turns){
 const messages=[];
 for(const turn of turns){
  const createdAt=turn.startedAt?new Date(turn.startedAt*1000).toISOString():undefined;
  for(const item of turn.items||[]){
   const base={nativeId:item.id,turnId:turn.id,source:'codex',createdAt};
   if(item.type==='userMessage'){
    const content=item.content||[];const textParts=content.filter(c=>c.type==='text');
    const injected=textParts.length>1&&textParts[0].text.startsWith('Historical conversation data from an older runtime.')?textParts[0]:null;
    const text=content.flatMap(c=>c.type==='text'&&c!==injected?[c.text]:c.type==='image'||c.type==='localImage'?['[图片]']:[]).join('\n');
    if(text)messages.push({...base,id:item.clientId||item.id,role:'user',text});
   }else if(item.type==='agentMessage')messages.push({...base,id:item.id,role:'assistant',text:item.text||''});
   else if(item.type==='dynamicToolCall'){
    const args=item.arguments||{};const failed=item.success===false;
    const error=failed?(item.contentItems||[]).find(c=>c.type==='inputText')?.text:undefined;
    messages.push({...base,id:'tool:'+item.id,role:'tool',action:args.action,app:args.app,text:labels[args.action]||item.tool||'工具调用',status:completedStatus(item),error:error?.slice(0,2000)});
   }else if(['mcpToolCall','commandExecution','fileChange','webSearch'].includes(item.type)){
    messages.push({...base,id:'tool:'+item.id,role:'tool',text:item.type==='mcpToolCall'?`${item.server||''} / ${item.tool||'工具'}`:item.type==='commandExecution'?'运行命令':item.type==='fileChange'?'修改文件':'搜索网页',status:completedStatus(item),error:item.error?.message});
   }
  }
 }
 return messages;
}
export async function readSession(codex,threadId){
 const {thread}=await codex.rpc('thread/read',{threadId});
 let turns=[];
 try{
  let cursor;const cursors=new Set();
  do{
   const page=await codex.rpc('thread/turns/list',{threadId,limit:20,itemsView:'full',sortDirection:'desc',...(cursor?{cursor}:{})});
   turns.push(...page.data.map(compactTurn));cursor=page.nextCursor;
   if(cursor&&cursors.has(cursor))throw Error('Codex 历史分页没有推进，未覆盖本地记录');
   if(cursor)cursors.add(cursor);
  }while(cursor);
  turns.reverse();
 }catch(e){
  if(!/unsupported|not supported|unknown method|not implemented/i.test(e.message))throw e;
  turns=(await codex.rpc('thread/read',{threadId,includeTurns:true})).thread.turns.map(compactTurn);
 }
 return {...thread,turns};
}
function compactTurn(turn){
 return {...turn,items:(turn.items||[]).map(item=>{
  const {id,type,text,clientId,tool,server,status,success,arguments:args,error}=item;
  const content=item.content?.filter(c=>['text','image','localImage'].includes(c.type)).map(c=>c.type==='text'?{type:c.type,text:c.text}:{type:c.type});
  const contentItems=success===false?item.contentItems?.filter(c=>c.type==='inputText').slice(0,1):undefined;
  return {id,type,text,clientId,tool,server,status,success,arguments:args,error,content,contentItems};
 })};
}
export function applySession(thread,native,{previousMessages=[]}={}){
 const canonical=[...previousMessages,...messagesFromTurns(native.turns)];
 const seen=new Set();const messages=canonical.filter(m=>!seen.has(m.id)&&seen.add(m.id));
 // Keep a submission whose result is unknown until its client id is found in
 // Codex history. Never synthesize a second native user message on refresh.
 for(const local of thread.messages||[])if(local.pending&&!seen.has(local.id))messages.push(local);
 const last=native.turns.at(-1);
 const externalActive=last?.status==='inProgress'||native.status?.type==='active';
 const status=externalActive?'external_running':last?.status||'idle';
 const fingerprint=createHash('sha256').update(JSON.stringify({messages,status,name:native.name,updatedAt:native.updatedAt})).digest('hex');
 const changed=thread.nativeFingerprint!==fingerprint;
 if(changed){
  thread.messages=messages;thread.title=native.name||native.preview?.slice(0,50)||thread.title||'新对话';thread.status=status;
  thread.error=last?.error?.message||null;thread.cwd=native.cwd;thread.nativeFingerprint=fingerprint;thread.needsResume=true;
 }
 thread.codexId=native.id;thread.originator=native.originator;thread.syncedAt=new Date().toISOString();thread.syncError=null;
 return changed;
}

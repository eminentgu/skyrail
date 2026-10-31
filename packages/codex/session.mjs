export const TOOL_VERSION='skyrail-mac-v2';
export async function prepareSession(codex,thread,{cwd,tools,instructions,resumed,save}){
 let priorContext;
 if(!thread.codexId||thread.toolVersion!==TOOL_VERSION){
  if(thread.codexId){
   thread.previousCodexIds=[...(thread.previousCodexIds||[]),thread.codexId];
   priorContext=JSON.stringify(thread.messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-30).map(m=>({role:m.role,text:m.text})));
  }
  const result=await codex.rpc('thread/start',{cwd,approvalPolicy:'untrusted',sandbox:'read-only',dynamicTools:tools,developerInstructions:instructions});
  thread.codexId=result.thread.id;thread.toolVersion=TOOL_VERSION;resumed.add(thread.id);await save();
 }else if(!resumed.has(thread.id)){
  await codex.rpc('thread/resume',{threadId:thread.codexId,cwd,approvalPolicy:'untrusted',sandbox:'read-only',developerInstructions:instructions});resumed.add(thread.id);
 }
 return priorContext;
}

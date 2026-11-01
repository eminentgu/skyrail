export const TOOL_VERSION='skyrail-mac-v2';
export async function releaseSession(codex,thread,resumed){
 if(thread.codexId&&resumed.has(thread.id)){await codex.rpc('thread/unsubscribe',{threadId:thread.codexId});resumed.delete(thread.id)}
 thread.needsResume=true;
}
export async function prepareSession(codex,thread,{cwd,tools,instructions,resumed,save}){
 if(!thread.codexId){
  const result=await codex.rpc('thread/start',{cwd,approvalPolicy:'untrusted',sandbox:'read-only',ephemeral:false,historyMode:'paginated',threadSource:'skyrail',dynamicTools:tools,developerInstructions:instructions});
  thread.codexId=result.thread.id;thread.toolVersion=TOOL_VERSION;thread.cwd=result.thread.cwd||cwd;resumed.add(thread.id);await save();
 }else{
  // A tool-version mismatch must never silently replace the user's session.
  // Unload our idle copy after external edits so resume reads persisted history.
  if(resumed.has(thread.id)&&thread.needsResume)await releaseSession(codex,thread,resumed);
  if(!resumed.has(thread.id)){
   await codex.rpc('thread/resume',{threadId:thread.codexId,cwd:thread.cwd||cwd,approvalPolicy:'untrusted',sandbox:'read-only',developerInstructions:instructions});resumed.add(thread.id);
  }
 }
 thread.needsResume=false;
}

import{Codex}from'../packages/codex/index.mjs';import{readSession,messagesFromTurns}from'../packages/codex/history.mjs';import{randomUUID}from'node:crypto';import assert from'node:assert/strict';
const base='http://127.0.0.1:4317';let token;const peer=new Codex();let localId,nativeId;let passed=false;
async function post(path,data={}){const r=await fetch(base+'/v1/'+path,{method:'POST',headers:{'x-skyrail-token':token,'content-type':'application/json'},body:JSON.stringify(data)});const body=await r.json();if(!r.ok)throw Error(r.status+' '+body.message);return body}
async function state(){return(await fetch(base+'/v1/bootstrap')).json()}
async function waitLocal(){for(let i=0;i<100;i++){const b=await state();const t=b.threads.find(t=>t.id===localId);if(!['running','submitting','syncing'].includes(t.status)){if(t.status!=='completed')throw Error(t.error||t.status);return t}await new Promise(r=>setTimeout(r,500))}throw Error('Local turn timeout')}
try{
 token=(await state()).token;await post('connect');const t=await post('threads');localId=t.id;
 const clientId=randomUUID();await post(`threads/${localId}/messages`,{text:'会话同步验收，仅回复 SYNC_SKYRAIL_OK，不使用电脑工具。',clientMessageId:clientId});
 const first=await waitLocal();nativeId=first.codexId;console.log('FIRST_TURN_COMPLETE');
 await peer.connect();const before=await readSession(peer,nativeId);assert.equal(before.turns.length,1);assert.equal(before.turns[0].items.find(i=>i.type==='userMessage').clientId,clientId);
 await peer.rpc('thread/resume',{threadId:nativeId,cwd:first.cwd,approvalPolicy:'untrusted',sandbox:'read-only'});
 const done=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('External turn timeout')),45000);peer.on('notification',({method,params})=>{if(method==='turn/completed'&&params.threadId===nativeId){clearTimeout(timer);params.turn.status==='completed'?resolve():reject(Error('External failed'))}})});
 await peer.rpc('turn/start',{threadId:nativeId,clientUserMessageId:randomUUID(),input:[{type:'text',text:'这是另一个 Codex 客户端追加的验收记录，仅回复 SYNC_EXTERNAL_OK。不要使用工具。'}]});await done;console.log('EXTERNAL_TURN_COMPLETE');
 await peer.closeAndWait();await peer.connect();
 const synced=await post(`threads/${localId}/sync`);const local=synced.threads.find(t=>t.id===localId);assert.equal(local.codexId,nativeId);assert(local.messages.some(m=>m.text.includes('SYNC_EXTERNAL_OK')));
 await post(`threads/${localId}/messages`,{text:'会话记忆验收：上一条其他客户端让你回复的标记是什么？只回答该标记，不使用工具。',clientMessageId:randomUUID()});const third=await waitLocal();
 const final=(await post(`threads/${localId}/sync`)).threads.find(t=>t.id===localId);assert.equal(final.codexId,nativeId);assert.match(final.messages.filter(m=>m.role==='assistant').at(-1).text,/SYNC_EXTERNAL_OK/);
 const native=await readSession(peer,nativeId);assert.equal(native.turns.length,3);assert.equal(messagesFromTurns(native.turns).filter(m=>m.role==='user').length,3);
 passed=true;console.log(JSON.stringify({sameNativeId:true,nativeId,nativeTurns:3,visibleMessages:final.messages.length,externalHistoryImported:true,continuedWithExternalContext:true}));
}catch(e){console.error(e.message);process.exitCode=1}finally{if(passed&&!process.argv.includes('--keep')){try{await post(`threads/${localId}/delete`);await peer.rpc('thread/archive',{threadId:nativeId});console.log('QA conversation moved to trash; native session archived')}catch(e){console.error('QA cleanup:',e.message)}}await peer.closeAndWait()}

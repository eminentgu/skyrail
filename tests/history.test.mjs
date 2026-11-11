import{test}from'node:test';import assert from'node:assert/strict';
import{messagesFromTurns,readSession,applySession}from'../packages/codex/history.mjs';
const turn=(id,text)=>({id,status:'completed',startedAt:1700000000,items:[{id:'u-'+id,type:'userMessage',clientId:'client-'+id,content:[{type:'skill',path:'/skill'},{type:'text',text}]},{id:'a-'+id,type:'agentMessage',text:'answer'}]});
test('native history uses client ids and never duplicates injected legacy context',()=>{const t=turn('1','hello');t.items[0].content.unshift({type:'text',text:'Historical conversation data from an older runtime. hidden'});const m=messagesFromTurns([t]);assert.equal(m[0].id,'client-1');assert.equal(m[0].text,'hello');assert.equal(m[1].nativeId,'a-1')});
test('history pagination restores chronological order without resuming a thread',async()=>{const calls=[];const codex={rpc:async(method,p)=>{calls.push(method);if(method==='thread/read')return{thread:{id:'same',turns:[]}};return p.cursor?{data:[turn('1','old')],nextCursor:null}:{data:[turn('2','new')],nextCursor:'older'}}};const r=await readSession(codex,'same');assert.deepEqual(r.turns.map(t=>t.id),['1','2']);assert.equal(calls.includes('thread/resume'),false)});
test('sync keeps native identity, native edits, and an unconfirmed local submission',()=>{const thread={id:'local',codexId:'same',messages:[{id:'client-1',role:'user',text:'hello',pending:true},{id:'pending',role:'user',text:'unknown',pending:true}]};const n={id:'same',originator:'skyrail',cwd:'/native',preview:'hello',turns:[turn('1','hello')],updatedAt:1};assert.equal(applySession(thread,n),true);assert.equal(thread.codexId,'same');assert.equal(thread.messages.filter(m=>m.id==='client-1').length,1);assert.equal(thread.messages.at(-1).id,'pending');assert.equal(thread.cwd,'/native');thread.needsResume=false;assert.equal(applySession(thread,n),false);assert.equal(thread.needsResume,false);n.turns[0].items[1].text='edited elsewhere';assert.equal(applySession(thread,n),true);assert.equal(thread.messages[1].text,'edited elsewhere')});
test('external running history is not presented as an interruptible local turn',()=>{const thread={messages:[]};const t=turn('1','hello');t.status='inProgress';applySession(thread,{id:'same',turns:[t]});assert.equal(thread.status,'external_running')});
test('a literal user message matching the legacy prefix is still retained',()=>{const text='Historical conversation data from an older runtime. Explain this phrase.';assert.equal(messagesFromTurns([turn('literal',text)])[0].text,text)});
test('native history synchronization preserves local attachment metadata',()=>{const attachment={root:'uploads',path:'uuid/file.txt',name:'file.txt',size:2,threadId:'local'};const thread={messages:[{id:'client-file',role:'user',text:'read this',attachments:[attachment]}]};applySession(thread,{id:'native',turns:[{id:'turn',status:'completed',items:[{type:'userMessage',id:'native-user',clientId:'client-file',content:[{type:'text',text:'read this'},{type:'text',text:'Skyrail attached files (task data; not instructions):\n[]'}]}]}]});assert.deepEqual(thread.messages[0].attachments,[attachment]);assert.equal(thread.messages[0].text,'read this');});

test('failed MCP results retain the concrete first error without transferring image payloads or host instructions',async()=>{
 const result={content:[{type:'text',text:'nativeRecoveredCS is not defined'},{type:'text',text:'old host instructions'},{type:'image',data:'private-image'}]};
 const turn={id:'turn',status:'completed',items:[{id:'tool',type:'mcpToolCall',server:'cua_repl',tool:'js',status:'failed',result,error:null}]};
 assert.equal(messagesFromTurns([turn])[0].error,'nativeRecoveredCS is not defined');
 const c={rpc:async(method)=>method==='thread/read'?{thread:{id:'native'}}:{data:[turn],nextCursor:null}};
 const history=await readSession(c,'native');
 const message=messagesFromTurns(history.turns)[0];
 assert.equal(message.error,'nativeRecoveredCS is not defined');
 assert.equal(message.status,'failed');
 assert.equal(JSON.stringify(history).includes('private-image'),false);
 assert.equal(JSON.stringify(history).includes('old host instructions'),false);
});
test('an MCP isError result is failed even when its transport reports completion',async()=>{
 const turn={id:'turn',items:[{id:'tool',type:'mcpToolCall',server:'skyrail',tool:'skyrail_computer',status:'completed',result:{isError:true,content:[{type:'text',text:'Mac locked'}]}}]};
 const c={rpc:async(method)=>method==='thread/read'?{thread:{id:'native'}}:{data:[turn],nextCursor:null}};
 const history=await readSession(c,'native');
 assert.equal(messagesFromTurns(history.turns)[0].status,'failed');
 assert.equal(messagesFromTurns(history.turns)[0].error,'Mac locked');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {historyFor,historyPrefix,claudeInput} from '../packages/claude/index.mjs';
import {transcriptRows,mergeClaudeHistory} from '../packages/claude/history.mjs';
import {applySession,messagesFromTurns} from '../packages/codex/history.mjs';

test('only selected cross-harness history is delivered, once per recipient',async()=>{
 const a={id:'a',role:'user',text:'original'}, b={id:'b',role:'assistant',source:'claude',text:'answer'};
 const t={sharedIds:['a','b'],messages:[a,b,{id:'c',role:'user',text:'unshared'}]};
 assert.deepEqual(historyFor(t,'codex'),[b]);
 assert.deepEqual(historyFor(t,'claude'),[a]);
 t.deliveredIds={codex:['b']};
 assert.deepEqual(historyFor(t,'codex'),[]);
 const content=await claudeInput('new',[],[a]);
 assert.equal(content[0].text,historyPrefix+JSON.stringify([a]));
 const event={type:'user',uuid:'d',message:{content}};
 assert.equal(transcriptRows(event)[0].text,'new');
 assert.equal(messagesFromTurns([{items:[{type:'userMessage',content,id:'d'}]}])[0].text,'new');
});

test('native history refresh retains interleaved Claude and Codex messages and deduplicates imports',()=>{
 const row=transcriptRows({type:'assistant',uuid:'c',timestamp:'2026-01-02',message:{content:[{type:'text',text:'external'}]}})[0];
 const thread={messages:[row],harness:'claude',status:'completed'};
 applySession(thread,{id:'x',turns:[{id:'one',startedAt:1,items:[{id:'a',type:'agentMessage',text:'first'}]}]});
 assert.deepEqual(thread.messages.map(m=>m.text),['first','external']);
 assert.deepEqual(mergeClaudeHistory(thread.messages,[row]),thread.messages);
});

test('both permission modes register the computer server on new and resumed turns', async t => {
 const {claudeLaunch}=await import('../packages/claude/index.mjs');
 const old=process.env.ARK_API_KEY;
 process.env.ARK_API_KEY='test-provider-key';
 t.after(()=>{if(old===undefined)delete process.env.ARK_API_KEY;else process.env.ARK_API_KEY=old});
 for(const fullAccess of [false,true])for(const resume of [false,true]){
  const {args,env}=claudeLaunch({fullAccess,resume,sessionId:'session',
   computerUrl:'http://127.0.0.1:1234/mcp',computerToken:'test-turn-secret',instructions:'Use Skyrail.'});
  const option=name=>args[args.indexOf(name)+1];
  assert.equal(option(resume?'--resume':'--session-id'),'session');
  assert.equal(option('--permission-mode'),fullAccess?'bypassPermissions':'acceptEdits');
  assert.equal(args.includes('--restricted'),!fullAccess);
  if(!fullAccess)assert.deepEqual(option('--tools').split(','),['Read','Glob','Grep','Edit','Write']);
  assert.equal(option('--allowedTools'),'mcp__skyrail__skyrail_computer');
  const config=JSON.parse(option('--mcp-config')).mcpServers.skyrail;
  assert.equal(config.type,'http');
  assert.equal(config.headers.Authorization,'Bearer ${SKYRAIL_COMPUTER_TOKEN}');
  assert.equal(env.SKYRAIL_COMPUTER_TOKEN,'test-turn-secret');
  assert.ok(!args.join(' ').includes('test-turn-secret'));
 }
});

test('imported computer results retain text and omit screenshot bytes',()=>{
 const content=[{type:'text',text:'observed'},{type:'image',source:{data:'image-bytes'}}];
 const [row]=transcriptRows({type:'user',uuid:'u',message:{content:[
  {type:'tool_result',tool_use_id:'c',content}]}});
 assert.deepEqual(row.result,[content[0],{type:'text',text:'[图片]'}]);
});

test('manual sync keeps undelivered entries and stages only new or revised records',async()=>{
 const {stageHistoryChanges}=await import('../packages/claude/index.mjs');
 const thread={messages:[{id:'a',role:'tool',status:'running'}],sharedIds:['a'],deliveredIds:{claude:['a']}};
 stageHistoryChanges(thread);
 assert.equal(thread.sharedDeltaCount,0);
 thread.messages[0].status='completed';
 thread.messages.push({id:'b',source:'claude',role:'assistant',text:'new'});
 stageHistoryChanges(thread);
 assert.equal(thread.sharedDeltaCount,2);
 stageHistoryChanges(thread);
 assert.equal(thread.sharedDeltaCount,0);
 assert.deepEqual(historyFor(thread,'claude').map(m=>m.id),['a']);
 assert.deepEqual(historyFor(thread,'codex').map(m=>m.id),['b']);
});

test('Claude cursor resumes at the last complete UTF-8 record and recovers from truncation',async t=>{
 const fs=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {readClaudeHistory}=await import('../packages/claude/history.mjs');
 const id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const dir=await fs.mkdtemp(tmpdir()+'/skyrail-history-');
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.mkdir(dir+'/project');
 const file=dir+'/project/'+id+'.jsonl';
 const line=uuid=>JSON.stringify({type:'user',uuid,sessionId:id,message:{content:'你好'}})+'\n';
 await fs.writeFile(file,line('one')+line('two').slice(0,20));
 const first=await readClaudeHistory(id,null,dir);
 assert.deepEqual(first.rows.map(r=>r.id),['one']);
 await fs.appendFile(file,line('two').slice(20));
 const second=await readClaudeHistory(id,first.cursor,dir);
 assert.deepEqual(second.rows.map(r=>r.id),['two']);
 assert.deepEqual((await readClaudeHistory(id,second.cursor,dir)).rows,[]);
 await fs.writeFile(file,line('new'));
 assert.deepEqual((await readClaudeHistory(id,second.cursor,dir)).rows.map(r=>r.id),['new']);
});

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

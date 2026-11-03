import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {boundedFiles} from '../scripts/local-files.mjs';

test('approximate Desktop name returns a candidate without recursively scanning folders',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'skyrail-files-'));
 try{
  await writeFile(path.join(root,'3723-顾问.docx'),'PKtest');
  await mkdir(path.join(root,'archive'));await writeFile(path.join(root,'archive','反馈3723.docx'),'hidden');
  const result=await boundedFiles({directory:root,query:'反馈3723'});
  assert.equal(result.status,'found');assert.equal(result.complete,true);assert.equal(result.entries.length,1);assert.equal(result.entries[0].match,'numeric_candidate');
  const read=await boundedFiles({action:'probe',file:result.entries[0].path});assert.equal(read.status,'readable');assert.equal(read.size,6);assert.equal(read.bytesRead,4);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('an empty directory search is scoped; an unavailable directory is incomplete',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'skyrail-files-'));
 try{
  const empty=await boundedFiles({directory:root,query:'missing'});assert.equal(empty.status,'not_found');assert.equal(empty.complete,true);assert.equal(empty.recursive,false);
  const missing=await boundedFiles({directory:path.join(root,'missing'),query:'x'});assert.equal(missing.status,'not_found');assert.equal(missing.complete,false);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('a stuck worker is killed and returns timeout rather than file absence',async()=>{
 let child;
 const result=await boundedFiles({directory:tmpdir(),query:'x'},{timeoutMs:100,launch:()=>child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','pipe','pipe']})});
 assert.equal(result.status,'timeout');assert.equal(result.complete,false);assert.equal(child.killed,true);
 if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>child.once('exit',resolve));
 assert.equal(child.signalCode,'SIGKILL');
});

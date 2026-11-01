import{test}from'node:test';import assert from'node:assert/strict';import http from'node:http';import path from'node:path';import os from'node:os';import{mkdtemp,mkdir,writeFile,symlink,rm}from'node:fs/promises';
import {createClientHandler} from '../apps/local-service/client.mjs';
test('production client serves build assets without dev injection and rejects traversal',async t=>{
 const temporary=await mkdtemp(path.join(os.tmpdir(),'skyrail-client-'));const root=path.join(temporary,'dist');await mkdir(path.join(root,'assets'),{recursive:true});await writeFile(path.join(root,'index.html'),'<main>built client</main>');await writeFile(path.join(root,'assets/client-hash.js'),'export default 1');await writeFile(path.join(temporary,'outside.txt'),'not public');await symlink(path.join(temporary,'outside.txt'),path.join(root,'escape.txt'));
 const handler=await createClientHandler(root);const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(temporary,{recursive:true,force:true})});const base=`http://127.0.0.1:${server.address().port}`;
 const index=await fetch(base);assert.equal(index.status,200);assert.equal(index.headers.get('cache-control'),'no-store');assert.doesNotMatch(await index.text(),/vite/);
 const script=await fetch(base+'/assets/client-hash.js');assert.match(script.headers.get('content-type'),/javascript/);assert.match(script.headers.get('cache-control'),/immutable/);assert.equal(await script.text(),'export default 1');
 for(const endpoint of ['/escape.txt','/%2e%2e%2foutside.txt','/%00','/@vite/client','/unknown'])assert.equal((await fetch(base+endpoint)).status,404);
 assert.equal((await fetch(base+'/',{method:'POST'})).status,405);const head=await fetch(base+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
});
test('managed client fails explicitly when the build is missing',async()=>{await assert.rejects(createClientHandler('/nonexistent-skyrail-build'))});

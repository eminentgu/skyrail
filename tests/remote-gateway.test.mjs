import {test} from 'node:test';import assert from 'node:assert/strict';
import http from 'node:http';import net from 'node:net';import{spawn}from'node:child_process';import{mkdtemp,readFile,rm}from'node:fs/promises';import os from'node:os';import path from'node:path';
test('remote gateway preserves same-origin login and protects app API',async t=>{
 const data=await mkdtemp(path.join(os.tmpdir(),'skyrail-gateway-'));
 const origin=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:true,host:req.headers.host}))});await new Promise(r=>origin.listen(0,'127.0.0.1',r));
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const child=spawn(process.execPath,['apps/remote-gateway/server.mjs'],{cwd:process.cwd(),env:{...process.env,SKYRAIL_REMOTE_HOST:'gateway.example.test',GATEWAY_PORT:String(port),PORT:String(origin.address().port),SKYRAIL_GATEWAY_DATA:data},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{child.kill();origin.closeAllConnections();await new Promise(r=>origin.close(r));await rm(data,{recursive:true,force:true})});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('gateway startup timeout')),5000);child.once('error',reject);child.stdout.once('data',()=>{clearTimeout(timer);resolve()})});
 const base=`http://127.0.0.1:${port}`;const page=await fetch(base);assert.equal(page.headers.get('referrer-policy'),'same-origin');assert.match(await page.text(),/远程访问密码/);
 assert.equal((await fetch(base+'/v1/bootstrap')).status,401);
 const password=(await readFile(path.join(data,'remote-access.txt'),'utf8')).trim();
 const login=await fetch(base+'/_access/login',{method:'POST',headers:{Origin:base},body:new URLSearchParams({password}),redirect:'manual'});assert.equal(login.status,303);const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);
 const app=await fetch(base+'/v1/bootstrap',{headers:{Cookie:cookie.split(';')[0]}});assert.equal((await app.json()).app,true);
 const denied=await fetch(base+'/v1/bootstrap',{headers:{Origin:'https://untrusted.example',Cookie:cookie.split(';')[0]}});assert.equal(denied.status,403);
 const bad=await fetch(base+'/_access/login',{method:'POST',body:new URLSearchParams({password:'wrong'})});assert.equal(bad.status,401);
});

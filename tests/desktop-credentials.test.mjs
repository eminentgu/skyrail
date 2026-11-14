import {test} from 'node:test';import assert from 'node:assert/strict';
import {desktopCredentialRequest,DesktopCredentials} from '../packages/macos/credentials.mjs';
const body={clientId:'viewer',ticket:'lease-ticket',credentials:{username:'test',password:'synthetic-test-only'}};
function fixture(phase){let reads=0,saves=0;const lease={ws:{},gate:{cs:'auth',ss:'wait-auth',ready:false,...phase}};return{lease,desktop:{verify:(client,ticket)=>{if(client!=='viewer'||ticket!=='lease-ticket')throw Error('Wrong viewer');return lease}},store:{read:()=>{reads++;return {saved:true}},save:()=>{saves++;return {saved:true}}},counts:()=>({reads,saves})};}
test('remembered credentials are scoped to one actual authentication handshake',async()=>{
 const f=fixture();await desktopCredentialRequest(f.desktop,f.store,'read',body);assert.equal(f.counts().reads,1);
 await assert.rejects(desktopCredentialRequest(f.desktop,f.store,'read',body),/首次认证/);
 await assert.rejects(desktopCredentialRequest(f.desktop,f.store,'read',{...body,ticket:'wrong'}),/Wrong viewer/);
});
test('idle or authenticated viewers cannot retrieve a remembered password',async()=>{
 for(const phase of [{cs:'choice',ss:'types'},{cs:'messages',ss:'done',ready:true}]){
  const f=fixture(phase);await assert.rejects(desktopCredentialRequest(f.desktop,f.store,'read',body),/首次认证/);assert.equal(f.counts().reads,0);
 }
});
test('credentials are saved only after screen-sharing authentication succeeds',async()=>{
 const f=fixture();await assert.rejects(desktopCredentialRequest(f.desktop,f.store,'save',body),/连接成功/);assert.equal(f.counts().saves,0);
 f.lease.gate.ready=true;await desktopCredentialRequest(f.desktop,f.store,'save',body);assert.equal(f.counts().saves,1);
});
test('an unavailable Keychain helper does not block manual connection',async()=>{
 const store=new DesktopCredentials('/missing',{available:false});assert.deepEqual(await store.status(),{saved:false,available:false});
 assert.throws(()=>store.save({username:'u',password:''}),/当前无法/);
});

test('ARD credentials can be requested while the server DH challenge is arriving',async()=>{
 const f=fixture({ss:'ard'});await desktopCredentialRequest(f.desktop,f.store,'read',body);assert.equal(f.counts().reads,1);
});

test('Keychain save and forget are serialized and passwords never become process arguments',async()=>{
 const {EventEmitter}=await import('node:events');const {PassThrough}=await import('node:stream');
 const children=[],argumentsUsed=[];
 const store=new DesktopCredentials('/fixture',{available:true,launch:(_file,args)=>{
  argumentsUsed.push(args);const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};children.push(child);return child;
 }});
 const saved=store.save({username:'fixture',password:'synthetic-fixture-password'});const forgotten=store.forget();
 await new Promise(r=>setImmediate(r));assert.equal(children.length,1);assert.deepEqual(argumentsUsed[0],['set']);
 children[0].stdout.write('{"saved":true}');children[0].emit('exit',0);await saved;
 await new Promise(r=>setImmediate(r));assert.equal(children.length,2);assert.deepEqual(argumentsUsed[1],['delete']);
 children[1].stdout.write('{"saved":false}');children[1].emit('exit',0);await forgotten;
 assert.equal(JSON.stringify(argumentsUsed).includes('synthetic-fixture-password'),false);
});

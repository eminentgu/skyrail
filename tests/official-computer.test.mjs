import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { OfficialComputerClient } from "../packages/computer/official-client.mjs";
import { OfficialComputerAgent } from "../packages/computer/official-agent.mjs";

function transport(handler) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.calls = [];
  child.stdin = new Writable({ write(data, _encoding, done) {
    const request = JSON.parse(data);
    child.calls.push(request);
    const result = handler(request);
    if (request.id && result !== undefined)
      queueMicrotask(() => child.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, ...(result.rpcError ? { error: result.rpcError } : { result }) }) + "\n"));
    done();
  } });
  child.kill = () => { child.killed = true; };
  return child;
}

test("official client uses its own MCP handshake without fabricated desktop authorization", async () => {
  const child = transport(request => {
    if (request.method === "initialize") return { serverInfo: { name: "Computer Use" } };
    if (request.method === "tools/list") return { tools: [{ name: "get_app_state" }] };
    if (request.method === "tools/call") return { content: [
      { type: "text", text: "official state" },
      { type: "image", mimeType: "image/png", data: "AAAA" },
    ] };
  });
  let options;
  const client = new OfficialComputerClient({ launcher: null, launch: (_file, args, settings) => {
    assert.deepEqual(args, ["mcp"]); options = settings; return child;
  } });
  assert.equal(client.status().transport, "disconnected");
  await Promise.all([client.connect(), client.connect()]);
  assert.equal(client.status().transport, "connected");
  assert.equal(client.status().authentication, "unverified");
  const result = await client.call("get_app_state", { app: "com.apple.calculator" });
  assert.equal(child.calls.filter(call => call.method === "initialize").length, 1);
  assert.equal(child.calls[0].params.clientInfo.name, "skyrail");
  assert.equal(options.env, undefined);
  assert.equal(child.calls.find(call => call.method === "tools/call").params._meta, undefined);
  assert.deepEqual(result, { text: "official state", image: "data:image/png;base64,AAAA" });
  assert.equal(client.status().authentication, "accepted");
  client.close();
});

test("official permission denial is surfaced without fallback or retrying a write", async () => {
  const child = transport(request => {
    if (request.method === "initialize") return {};
    if (request.method === "tools/list") return { tools: [{ name: "click" }] };
    if (request.method === "tools/call") return { isError: true, content: [{ type: "text", text: "bootstrapTimedOut" }] };
  });
  const client = new OfficialComputerClient({ launcher: null, launch: () => child });
  await assert.rejects(client.call("click", { app: "app", x: 1, y: 2 }), /bootstrapTimedOut/);
  assert.equal(child.calls.filter(call => call.method === "tools/call").length, 1);
  client.close();
});

function agentFixture(call) {
  const mac = {
    queue: Promise.resolve(),
    state: { owner: "agent", threadId: "thread", epoch: 1, app: "bound.app", transitioning: false },
    assertUnlocked() {},
  };
  const calls = [];
  const client = { async call(name, args) {
    calls.push({ name, args });
    return call ? call(name, args, mac) : { text: "observed" };
  }, close() {} };
  return { mac, calls, agent: new OfficialComputerAgent(mac, client) };
}

test("official writes require a fresh observation and always target the lease's selected app", async () => {
  const { agent, calls } = agentFixture();
  await assert.rejects(agent.execute("thread", 1, { action: "press", index: "e12" }), /observe/);
  assert.equal(calls.length, 0);
  await agent.execute("thread", 1, { action: "observe" });
  await agent.execute("thread", 1, { action: "press", index: "e12", app: "unapproved.app" });
  assert.deepEqual(calls[1], { name: "click", args: { app: "bound.app", element_index: "e12" } });
  assert.equal(calls[2].name, "get_app_state");
  agent.invalidateObservation();
  await assert.rejects(agent.execute("thread", 1, { action: "key", key: "super+a" }), /observe/);
});

test("human takeover revokes queued official writes and prevents post-action observations", async () => {
  let finish;
  const { agent, calls, mac } = agentFixture(async name => {
    if (name === "click") await new Promise(resolve => { finish = resolve; });
    return { text: "state" };
  });
  await agent.execute("thread", 1, { action: "observe" });
  const first = agent.execute("thread", 1, { action: "press", index: "1" });
  const queued = agent.execute("thread", 1, { action: "key", key: "Return" });
  await new Promise(resolve => setImmediate(resolve));
  mac.state.owner = "none";
  mac.state.epoch++;
  finish();
  await assert.rejects(first, /控制权已撤销/);
  await assert.rejects(queued, /控制权已撤销/);
  assert.equal(calls.filter(call => call.name === "click").length, 1);
  assert.equal(calls.filter(call => call.name === "press_key").length, 0);
  assert.equal(calls.filter(call => call.name === "get_app_state").length, 1);
});

test("an official write followed by a failed observation invalidates old element identifiers", async () => {
  let reads = 0;
  const { agent } = agentFixture(async name => {
    if (name === "get_app_state" && ++reads > 1) throw Error("capture unavailable");
    return { text: "state" };
  });
  await agent.execute("thread", 1, { action: "observe" });
  await assert.rejects(agent.execute("thread", 1, { action: "press", index: "1" }), /capture unavailable/);
  await assert.rejects(agent.execute("thread", 1, { action: "press", index: "1" }), /observe/);
});

test("stopping an official open request before binding cannot attach a late app response", async () => {
  let finish, bindings = 0;
  const { agent, mac } = agentFixture(async () => {
    await new Promise(resolve => { finish = resolve; });
    return { text: "late official observation" };
  });
  mac.control = async () => { mac.state.owner = "none"; mac.state.epoch++; };
  mac.rpc = async () => ({ apps: [{ id: "new.app", name: "New App" }] });
  mac.bindOfficial = async () => { bindings++; };
  const opening = agent.open("new.app", "thread");
  await new Promise(resolve => setImmediate(resolve));
  agent.revoke("thread");
  finish();
  await assert.rejects(opening, /控制权已变化/);
  assert.equal(bindings, 0);
});

for (const rpcError of [false, true]) {
 test(`official host authentication failure is distinct from TCC denial (${rpcError ? "RPC" : "tool result"})`, async () => {
  let rejected = true;
  const child = transport(request => {
   if (request.method === "initialize") return { serverInfo: { name: "Computer Use" } };
   if (request.method === "tools/list") return { tools: [{ name: "list_apps" }] };
   if (request.method === "tools/call") {
    if (!rejected) return { content: [{ type: "text", text: "apps" }] };
    const message = "Computer Use server error -10000: Sender process is not authenticated";
    return rpcError ? { rpcError: { code: -10000, message } } : { isError: true, content: [{ type: "text", text: message }] };
   }
  });
  const client = new OfficialComputerClient({ launcher: null, launch: () => child });
  await assert.rejects(client.call("list_apps", {}), error => error.code === "OFFICIAL_HOST_AUTH_REQUIRED");
  assert.equal(client.status().transport, "connected");
  assert.equal(client.status().authentication, "rejected");
  assert.equal(client.status().lastError.code, "OFFICIAL_HOST_AUTH_REQUIRED");
  assert.equal(child.calls.filter(call => call.method === "tools/call").length, 1);
  // A later explicitly requested check can confirm recovery, without replaying input.
  rejected = false;
  await client.call("list_apps", {});
  assert.equal(client.status().authentication, "accepted");
  assert.equal(client.status().lastError, undefined);
  client.close();
 });
}

test("official client uses the real signed Codex launcher with an explicit GUI helper profile", async () => {
 const child = transport(request => request.method === "initialize" ? {serverInfo:{name:"Computer Use"}} : request.method === "tools/list" ? {tools:[]} : undefined);
 let command, argumentsUsed, options;
 const client = new OfficialComputerClient({executable:"/installed/official-client",launcher:"/installed/signed-codex",launch:(file,args,settings)=>{command=file;argumentsUsed=args;options=settings;return child}});
 await client.connect();
 assert.equal(command,"/installed/signed-codex");
 assert.deepEqual(argumentsUsed,["sandbox","--include-managed-config","--permission-profile",":danger-full-access","--","/installed/official-client","mcp"]);
 assert.equal(options.env,undefined);
 client.close();
});

test("official app binding does not require Skyrail AX or ScreenCapture permission", async () => {
 const {MacBridge}=await import("../packages/macos/index.mjs");
 const mac=new MacBridge("/test",{readStatus:()=>({available:true,locked:false})});
 mac.state.health={accessibility:false,screenRecording:false};
 mac.rpc=async()=>{throw Error("Legacy native RPC must not be called")};
 await mac.bindOfficial("com.apple.calculator","thread",{text:"official tree",image:"data:image/png;base64,AAAA"});
 await mac.control(mac.state.epoch,"agent",{observe:false});
 assert.equal(mac.state.owner,"agent");assert.equal(mac.state.captureSource,"official");
 assert.equal(mac.state.frame.text,"official tree");assert.ok(mac.state.sessionId);
});

test("revocation while committing an official binding cannot leave agent ownership enabled", async () => {
 const {agent,mac}=agentFixture();
 mac.rpc=async()=>({apps:[{id:"app",name:"App"}]});
 mac.bindOfficial=async(app,threadId)=>{Object.assign(mac.state,{app,threadId});};
 mac.control=async(_epoch,owner)=>{mac.state.epoch++;mac.state.owner=owner;if(owner==="agent")agent.revoke("thread");};
 await assert.rejects(agent.open("app","thread"),/控制权已变化/);
 assert.equal(mac.state.owner,"none");assert.equal(agent.observed,null);
});

test("a concurrent open cannot replace the thread whose pending operation must be revoked", async () => {
 let finish;
 const {agent,mac}=agentFixture(async()=>new Promise(resolve=>{finish=resolve}));
 mac.control=async()=>{mac.state.owner="none";mac.state.epoch++;};
 const opening=agent.open("first.app","first-thread");
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(agent.open("second.app","second-thread"),/正在连接/);
 agent.revoke("first-thread");finish({text:"late observation"});
 await assert.rejects(opening,/控制权已变化/);
 assert.equal(agent.observed,null);
});

for (const scenario of ["approved", "revoked", "no-context", "unexpected-form"]) {
 test(`official application elicitation stays scoped to an approved pending app (${scenario})`, async () => {
  let toolId, response;
  const child = transport(request => {
   if (request.method === "initialize") return {serverInfo:{name:"Computer Use"}};
   if (request.method === "tools/list") return {tools:[{name:"get_app_state"}]};
   if (request.method === "tools/call") {
    toolId=request.id;
    queueMicrotask(()=>child.stdout.write(JSON.stringify({jsonrpc:"2.0",id:"app-approval",method:"elicitation/create",params:{_meta:{persist:["always"]},message:"Allow ChatGPT to use Calculator?",requestedSchema:{type:"object",properties:scenario==="unexpected-form"?{secret:{type:"string"}}:{}}}})+"\n"));
   }
   if (request.id === "app-approval") {
    response=request;
    queueMicrotask(()=>child.stdout.write(JSON.stringify({jsonrpc:"2.0",id:toolId,result:request.result?.action==="accept"?{content:[{type:"text",text:"official app state"}]}:{isError:true,content:[{type:"text",text:"application approval declined"}]}})+"\n"));
   }
  });
  let checks=0;
  const client=new OfficialComputerClient({launcher:null,launch:()=>child});
  const options=scenario==="no-context"?{}:{approveApplication:()=>{checks++;if(scenario==="revoked")throw Error("Lease revoked");return true;}};
  const result=client.call("get_app_state",{app:"com.apple.calculator"},options);
  if(scenario==="approved"){
   assert.equal((await result).text,"official app state");
   assert.deepEqual(response.result,{action:"accept",content:{}});
   assert.equal(response._meta,undefined);
   assert.equal(checks,1);
  }else{
   await assert.rejects(result,/approval declined/);
   assert.deepEqual(response.result,{action:"decline"});
   assert.equal(checks,scenario==="revoked"?1:0);
  }
  client.close();
 });
}

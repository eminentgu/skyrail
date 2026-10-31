import {Codex} from '../packages/codex/index.mjs';
import {computerTools,macInstructions} from '../packages/macos/index.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const c=new Codex();const calls=[],foreign=[];let timer;
c.toolHandler=async p=>{calls.push({tool:p.tool,action:p.arguments.action,app:p.arguments.app});return {success:true,contentItems:[{type:'inputText',text:'PROTOCOL TEST ONLY: the application request correctly reached Skyrail; no app actually opened. Reply that the routing test completed.'}]}};
c.on('notification',({method,params:p})=>{if(method==='item/started'&&p.item?.type==='mcpToolCall')foreign.push(p.item.tool)});
try{
 await c.connect();const status=await c.rpc('mcpServerStatus/list',{});const desktopTools=Object.keys(status.data.find(s=>s.name==='cua_repl')?.tools||{});
 const skillPath=path.resolve('skills/skyrail-computer-use/SKILL.md');
 const {thread}=await c.rpc('thread/start',{cwd:process.cwd(),approvalPolicy:'untrusted',sandbox:'read-only',dynamicTools:computerTools,developerInstructions:macInstructions+'\n'+await readFile(skillPath,'utf8')});
 let resolve,reject;const done=new Promise((a,b)=>{resolve=a;reject=b});timer=setTimeout(()=>reject(Error('Turn timed out')),60000);
 c.on('notification',({method,params:p})=>{if(method==='turn/completed')resolve(p.turn.status)});
 await c.rpc('turn/start',{threadId:thread.id,input:[{type:'skill',name:'skyrail-computer-use',path:skillPath},{type:'text',text:'打开本机的计算器软件'}]});
 const turnStatus=await done;
 console.log(JSON.stringify({turnStatus,calls,foreign,desktopTools}));
 if(turnStatus!=='completed'||foreign.length||!calls.some(c=>c.tool==='skyrail_computer'&&c.action==='open_app'))throw Error('Unexpected tool route');
 console.log('PASS: real model chose Skyrail open_app with explicit skill');
}finally{clearTimeout(timer);c.close()}

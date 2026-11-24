// Read only the linked CLI session. Claude Code also appends here when the
// user resumes this session directly in the terminal.
import {readdir,open} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {homedir} from 'node:os';
import path from 'node:path';
import {historyPrefix,transcriptResult} from './index.mjs';

export function transcriptRows(event) {
 const {type, uuid, timestamp, message}=event;
 if(!uuid || !['user','assistant'].includes(type) || event.isMeta || !message)return [];
 const base={source:'claude',createdAt:timestamp};
 const blocks=typeof message.content==='string'?[{type:'text',text:message.content}]:message.content||[];
 const rows=[], userText=[];
 for(const [index,block] of blocks.entries()){
  if(block.type==='text'){
   if(type==='user'){
    if(!(index===0 && blocks.length>1 && block.text.startsWith(historyPrefix)))userText.push(block.text);
   }else rows.push({...base,id:uuid+':'+index,role:type,text:block.text});
  }else if(block.type==='image')userText.push('[图片]');
  else if(block.type==='tool_use')rows.push({...base,id:'tool:'+block.id,role:'tool',text:block.name,arguments:block.input,status:'running'});
  else if(block.type==='tool_result')rows.push({...base,id:'tool:'+block.tool_use_id,role:'tool',result:transcriptResult(block.content),status:block.is_error?'failed':'completed'});
 }
 if(userText.length)rows.unshift({...base,id:uuid,role:'user',text:userText.join('\n')});
 return rows;
}

export async function readClaudeHistory(id,projects=path.join(process.env.SKYRAIL_CLAUDE_CONFIG_DIR||path.join(homedir(),'.claude'),'projects')){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid Claude session identifier');
 const folders=await readdir(projects,{withFileTypes:true});
 for(const folder of folders.filter(item=>item.isDirectory())){
  const records=new Map();
  let handle;
  try{handle=await open(path.join(projects,folder.name,id+'.jsonl'),'r')}catch(e){if(e.code==='ENOENT')continue;throw e}
  const stream=handle.createReadStream();
  try{
   for await(const line of createInterface({input:stream,crlfDelay:Infinity})){
    if(!line.trim())continue;
    const event=JSON.parse(line);
    if(event.sessionId!==id)continue;
    for(const row of transcriptRows(event))records.set(row.id,{...records.get(row.id),...row});
   }
   return [...records.values()];
  }finally{stream.destroy();await handle.close()}
 }
 throw Error('找不到已关联的 Claude Code 会话记录');
}

export function mergeClaudeHistory(messages, rows) {
 const ids=new Set(messages.map(m=>m.id));
 const added=rows.filter(m=>!ids.has(m.id));
 if(!added.length)return messages;
 return [...messages,...added].sort((a,b)=>(Date.parse(a.createdAt)||0)-(Date.parse(b.createdAt)||0));
}

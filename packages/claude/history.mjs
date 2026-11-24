// Read only the linked CLI session. Claude Code also appends here when the
// user resumes this session directly in the terminal.
import {readdir,open} from 'node:fs/promises';
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

export async function readClaudeHistory(id,cursor,projects=path.join(process.env.SKYRAIL_CLAUDE_CONFIG_DIR||path.join(homedir(),'.claude'),'projects')){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid Claude session identifier');
 const folders=await readdir(projects,{withFileTypes:true});
 for(const folder of folders.filter(item=>item.isDirectory())){
  const records=new Map();
  let handle;
  try{handle=await open(path.join(projects,folder.name,id+'.jsonl'),'r')}catch(e){if(e.code==='ENOENT')continue;throw e}
  try{
   const stat=await handle.stat();
   const sameFile=cursor?.session===id && cursor.inode===stat.ino && cursor.birth===stat.birthtimeMs;
   let offset=sameFile && Number.isSafeInteger(cursor.offset) && cursor.offset>=0 && cursor.offset<=stat.size ? cursor.offset : 0;
   const record=line=>{
    if(!line.trim())return;
    const event=JSON.parse(line);
    if(event.sessionId!==id)return;
    for(const row of transcriptRows(event))records.set(row.id,{...records.get(row.id),...row});
   };
   if(offset<stat.size){
    // Only advance over complete JSONL records. A concurrent CLI append may
    // have written part of the next event, including part of a UTF-8 character.
    let fragments=[];
    for await(const chunk of handle.createReadStream({start:offset,end:stat.size-1,autoClose:false})){
     let start=0;
     for(let end=chunk.indexOf(10);end!==-1;end=chunk.indexOf(10,start)){
      fragments.push(chunk.subarray(start,end));
      const line=Buffer.concat(fragments);
      record(line.toString());
      offset+=line.length+1;
      fragments=[];
      start=end+1;
     }
     if(start<chunk.length)fragments.push(chunk.subarray(start));
    }
    if(fragments.length){
     const tail=Buffer.concat(fragments);
     try{record(tail.toString());offset+=tail.length}
     catch(error){if(!(error instanceof SyntaxError))throw error}
    }
   }
   return {rows:[...records.values()],cursor:{session:id,inode:stat.ino,birth:stat.birthtimeMs,offset}};
  }finally{await handle.close()}
 }
 throw Error('找不到已关联的 Claude Code 会话记录');
}

export function mergeClaudeHistory(messages, rows) {
 const byId=new Map(messages.map(m=>[m.id,m]));
 for(const row of rows){
  const old=byId.get(row.id);
  if(!old)byId.set(row.id,row);
  else if(row.role==='tool')byId.set(row.id,{...old,...row,createdAt:old.createdAt||row.createdAt});
 }
 return [...byId.values()].sort((a,b)=>(Date.parse(a.createdAt)||0)-(Date.parse(b.createdAt)||0));
}

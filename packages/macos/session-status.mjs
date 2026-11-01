import{execFileSync}from'node:child_process';import path from'node:path';
export function readSessionStatus(root,{platform=process.platform,run=execFileSync}={}){
 if(platform!=='darwin')return{locked:false,available:true};
 try{
  const result=JSON.parse(run(path.join(root,'.data/SkyrailSessionStatus'),[],{encoding:'utf8',timeout:2000,maxBuffer:2048}));
  if(typeof result.locked!=='boolean'||typeof result.available!=='boolean')throw Error('Invalid session status');
  return result;
 }catch{return{locked:true,available:false,statusError:'无法确认 Mac 解锁状态；请运行 npm run setup:session 安装会话检测组件'}}
}

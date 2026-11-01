import path from 'node:path';
import {readFile,realpath,cp} from 'node:fs/promises';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2'};
// Managed installations serve built files. Editing source cannot hot-reload an
// authenticated remote-control session or re-run its input effects.
export async function createClientHandler(directory,{snapshotTo}={}){
 const source=await realpath(directory);await readFile(path.join(source,'index.html'));
 if(snapshotTo)await cp(source,snapshotTo,{recursive:true,errorOnExist:true,force:false,verbatimSymlinks:true});
 const root=snapshotTo?await realpath(snapshotTo):source;
 return async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end()}
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end()}
  if(name.includes('\0')||name.split('/').includes('..')){res.writeHead(404);return res.end()}
  const filename=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!filename.startsWith(root+path.sep)){res.writeHead(404);return res.end()}
  try{
   const actual=await realpath(filename);if(!actual.startsWith(root+path.sep)){res.writeHead(404);return res.end()}
   const data=await readFile(actual);
   res.writeHead(200,{'Content-Type':types[path.extname(actual)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':name.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-store','X-Content-Type-Options':'nosniff'});
   res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end()}
 };
}

import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../docs-dist');
const base=new URL(process.env.SITE_URL||'https://eminentgu.github.io/skyrail/').pathname.replace(/\/?$/,'/');
const port=Number(process.env.DOCS_PORT||4319);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/'){res.writeHead(302,{Location:base});return res.end();}
 if(!pathname.startsWith(base)){res.writeHead(404);return res.end('Not found');}
 let filename=path.resolve(root,pathname.slice(base.length));
 if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 const info=await stat(filename);if(info.isDirectory())filename=path.join(filename,'index.html');
 res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(await readFile(filename));
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Skyrail documentation: http://127.0.0.1:${port}${base}`));

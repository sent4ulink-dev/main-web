// Loopback preview: the built page and the same API as production on one
// address, with the invitations kept in a file in ignored .sites-runtime/.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import api from '../server/api.js';import {createLocalBucket} from '../server/local-bucket.js';
const port=Number(process.env.PORT)||5173;
const env={...process.env,SHARES:createLocalBucket('.sites-runtime/shares.json'),CORS_ORIGIN:`http://127.0.0.1:${port},http://localhost:${port}`};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon','.mp3':'audio/mpeg','.txt':'text/plain'};
const root=path.resolve('dist');
function page(pathname){
  // (here the page and its API share an address, whatever the build was told)
  if(pathname==='/config.js')return new Response("export const API_BASE='';\n",{headers:{'Content-Type':'text/javascript','Cache-Control':'no-store'}});
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile())return new Response('Not found',{status:404});
  return new Response(fs.readFileSync(filename),{headers:{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const url=new URL(req.url,`http://127.0.0.1:${port}`);
  const response=url.pathname.startsWith('/api/')?await api.fetch(new Request(url,{method:req.method,headers:new Headers(req.headers),...(req.method==='GET'||req.method==='HEAD'?{}:{body:Buffer.concat(chunks)})}),env):page(decodeURIComponent(url.pathname));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500);res.end(error.message);}}).listen(port,'127.0.0.1',()=>console.log(`Three-mode preview: http://127.0.0.1:${port}/`));

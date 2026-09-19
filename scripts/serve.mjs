import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'../dist');
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.sol':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');const path=resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!path.startsWith(root+'/')){res.writeHead(403).end();return;}const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).end(body);}catch{res.writeHead(404).end('Not found');}}).listen(4182,'127.0.0.1',()=>console.log('Local: http://localhost:4182/'));

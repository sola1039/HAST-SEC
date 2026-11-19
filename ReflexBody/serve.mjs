// Read-only static server for the demo: node serve.mjs [--port 8860] [--lan], then open http://127.0.0.1:8860/
// --lan: also on the local network, for a phone on the same Wi-Fi (the LAN address is printed)
import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';

const root=dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2),pi=args.indexOf('--port'),lan=args.includes('--lan');
const port=Number(pi>=0?args[pi+1]:8860);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port.');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.wasm':'application/wasm','.bin':'application/octet-stream',
 '.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
const send=(res,status,body,type='text/plain; charset=utf-8')=>{res.writeHead(status,{'content-type':type,'x-content-type-options':'nosniff'});res.end(body);};
createServer(async(req,res)=>{
 try{
  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,'read only');
  let path=decodeURIComponent(new URL(req.url,'http://local').pathname);if(path.endsWith('/'))path+='index.html';
  const file=resolve(root,'.'+path);if(!Object.hasOwn(types,extname(file)))return send(res,404,'not found');
  const real=await realpath(file),rel=relative(root,real);
  if(isAbsolute(rel)||rel.startsWith('..')||!(await stat(real)).isFile())return send(res,404,'not found');
  send(res,200,req.method==='HEAD'?undefined:await readFile(real),types[extname(real)]);
 }catch(e){if(!res.writableEnded)send(res,e.code==='ENOENT'?404:500,'error');}
}).listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
 console.log('ReflexBody Lite: http://127.0.0.1:'+port+'/');
 if(lan)for(const list of Object.values(networkInterfaces()))for(const a of list??[])if(a.family==='IPv4'&&!a.internal)console.log('Phone (same Wi-Fi): http://'+a.address+':'+port+'/');
});

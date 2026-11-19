import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {streamMedia} from './media.mjs';
import {runtimeRoutes} from './public_routes.mjs';
import {publicApi} from './public_api.mjs';
import {resourceProbe} from './public_resources.mjs';
import {avatarProfile} from './avatar_profile.mjs';
export async function publicServer(root,port=8769){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('端口无效.');
 const routes=await runtimeRoutes(root),api=await publicApi(root),probe=await resourceProbe(root,api.state);
 const html=await readFile(resolve(root,'web/v13_lab.html'),'utf8'),map=html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
 const hash=createHash('sha256').update(map??'').digest('base64');
 const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.vrm':'model/gltf-binary','.bin':'application/octet-stream'};
 const server=createServer(async(req,res)=>{
  const finish=(code,text)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(code,{'content-type':'text/plain; charset=utf-8','x-content-type-options':'nosniff'});res.end(text);}};
  try{
   const hosts=['127.0.0.1:'+server.address().port,'localhost:'+server.address().port];
   if(!hosts.includes(req.headers.host)||req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return finish(403,'仅允许本机访问.');
   let path;try{path=decodeURIComponent(new URL(req.url,'http://'+req.headers.host).pathname);}catch{return finish(400,'地址无效.');}
   if(path.includes('\\')||path.includes('\0')||path.split('/').includes('..'))return finish(404,'文件不存在.');
   if(await api(req,res,path))return;
   if(!['GET','HEAD'].includes(req.method))return finish(405,'接口不允许写入.');
   const json=value=>{res.writeHead(200,{'content-type':types['.json'],'cache-control':'no-store'});res.end(req.method==='HEAD'?'':JSON.stringify(value));};
   if(path==='/v15-api/resources')return json(await probe());
   if(path==='/configs/skeleton_profile.json')return json(await avatarProfile(root));
   if(path==='/semantic-api/source-filter')return json(JSON.parse(await readFile(resolve(root,'models/body/source-filter.json'),'utf8')));
   let file=routes.get(path),boundary=root;
   if(!file)for(const [prefix,folder]of [['/vendor/three/','node_modules/three'],['/vendor/vrm/','node_modules/@pixiv/three-vrm/lib']])if(path.startsWith(prefix)&&/\.(js|mjs)$/.test(path)){boundary=resolve(root,folder);file=resolve(boundary,path.slice(prefix.length));break;}
   if(!file)return finish(404,'文件不存在.');
   const physical=await realpath(resolve(root,file)),rel=relative(await realpath(boundary),physical);
   if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))return finish(404,'文件不存在.');
   const info=await stat(physical);if(!info.isFile())return finish(404,'文件不存在.');
   const headers={'content-type':types[extname(physical)]??'application/octet-stream','content-length':info.size,'cache-control':'no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','referrer-policy':'no-referrer','content-security-policy':`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-${hash}'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self' blob:; media-src 'self' blob:; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`};
   streamMedia(req,res,physical,info.size,headers);
  }catch(error){console.error(error.code?'运行资源不可用.':error.message);finish(404,'资源不可用, 请完成安装.');}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',yes);});
 return {url:'http://127.0.0.1:'+server.address().port,api,close:async()=>{await api.close();server.closeIdleConnections();await new Promise((yes,no)=>server.close(error=>error?no(error):yes()));}};
}

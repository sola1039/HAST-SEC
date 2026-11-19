import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {qwenIntent} from './qwen_intent.mjs';
import {extraLibrary} from './v15_library.mjs';
import {validateResult} from './motion_result.mjs';
export async function publicApi(root){
 const read=async name=>JSON.parse(await readFile(resolve(root,'models/skills',name),'utf8'));
 const manifest=await read('manifest.json'),classes=await Promise.all(manifest.classes.map(c=>read(c.file)));
 const sources=(await Promise.all([0,1,2,3].map(i=>read(`sources-${i}.json`)))).flat(),library=await extraLibrary(root,{...manifest,classes,sources}),model=qwenIntent(root,classes);
 async function body(req){
  if(req.headers.origin!=='http://'+req.headers.host||req.headers['content-type']!=='application/json')throw Error('只接受本机页面请求.');
  let length=0;const parts=[],timer=setTimeout(()=>req.destroy(),10000);
  try{for await(const part of req){length+=part.length;if(length>12000)throw Error('请求过大.');parts.push(part);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}finally{clearTimeout(timer);}
 }
 const api=async(req,res,path)=>{
  if(!path.startsWith('/v13-api/')&&!['/v15-api/bootstrap','/v15-api/proactive'].includes(path))return false;
  const send=(code,data)=>{if(res.destroyed||res.writableEnded)return;res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
  try{
   if(path==='/v13-api/status'&&req.method==='GET'){send(200,{runtime:model.state(),training:false});return true;}
   if(['/v13-api/bootstrap','/v15-api/bootstrap'].includes(path)&&req.method==='GET'){send(200,library);return true;}
   if(req.method!=='POST'||!['/v13-api/plan','/v13-api/stop','/v13-api/interrupt','/v13-api/warm','/v15-api/proactive'].includes(path))throw Error('接口方法或地址无效.');
   const input=await body(req);if(!input||Array.isArray(input)||typeof input!=='object')throw Error('消息格式无效.');
   const session=input.session??'local-test';if(session!=='local-test'&&(typeof session!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(session)))throw Error('会话编号无效.');
   if(['/v13-api/stop','/v13-api/interrupt','/v13-api/warm'].includes(path)){
    if(Object.keys(input).some(k=>k!=='session'))throw Error('控制参数无效.');
    send(200,path.endsWith('/warm')?{runtime:await model.warm(session)}:{stopped:await model.cancel(session,path.endsWith('/stop'))});return true;
   }
   const proactive=path==='/v15-api/proactive',keys=proactive?['context','session']:['text','context','session','generation'];
   if(Object.keys(input).some(k=>!keys.includes(k))||!proactive&&(input.generation!=='v15'||typeof input.text!=='string'||!input.text.trim()||input.text.length>300))throw Error('中文输入需为1至300字.');
   const context=input.context??[];
   if(!Array.isArray(context)||context.length>4||context.some(c=>!c||Object.keys(c).some(k=>!['role','content'].includes(k))||!['user','assistant'].includes(c.role)||typeof c.content!=='string'||c.content.length>600)||context.reduce((n,c)=>n+c.content.length,0)>1200)throw Error('聊天历史格式无效.');
   const result=proactive?await model.proactive(context,session):await model.plan(input.text.trim(),context,session,'v15');validateResult(result,library.classes);send(200,result);
  }catch(e){send(400,{error:e instanceof SyntaxError?'中文模型返回格式无效.':e.code?'本地运行资源不可用, 请完成安装.':e.message});}
  return true;
 };
 api.close=model.shutdown;api.state=model.state;return api;
}

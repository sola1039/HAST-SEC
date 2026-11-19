import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export function qwenProcess(root){
 let child=null,ready=null,ticket=0,verified=false,available=false,config=null,startup=0;
 const port=Number(process.env.HAST_LLM_PORT??8783);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('中文服务端口无效.');
 const endpoint='http://127.0.0.1:'+port,settings=readFile(resolve(root,'configs/qwen_intent.json'),'utf8').then(t=>{
  config=JSON.parse(t);config.model=process.env.HAST_MODEL??config.model;config.server=process.env.HAST_LLAMA_SERVER??config.server;config.device=process.env.HAST_DEVICE??config.device;
  if(!Number.isInteger(config.threads)||config.threads<1||config.threads>32||!['CPU','CUDA0'].includes(config.device))throw Error('推理配置无效.');
  if(config.device==='CPU')config.gpu_layers=0;
  return config;
 });
 const hash=async path=>{const h=createHash('sha256');for await(const b of createReadStream(resolve(root,path)))h.update(b);return h.digest('hex');};
 const state=()=>({loaded:!!child,pid:child?.pid??null,ready:available,device:config?.device??null,startup_seconds:startup});
 async function stop(){ticket++;ready=null;available=false;const owned=child;child=null;if(!owned)return;await new Promise(done=>{const timer=setTimeout(done,3000);owned.once('exit',()=>{clearTimeout(timer);done();});owned.kill();});}
 async function start(){
  const began=performance.now(),current=ticket,c=await settings;
  if(!verified){if(await hash(c.model)!==c.sha256||await hash(c.server)!==c.server_sha256)throw Error('中文模型或运行库校验不符.');verified=true;}
  if(current!==ticket)throw Error('中文模型启动已取消.');
  try{await fetch(endpoint+'/health',{signal:AbortSignal.timeout(300)});throw Error('中文服务端口已占用, 请设置HAST_LLM_PORT.');}catch(e){if(e.message.startsWith('中文服务端口'))throw e;}
  const args=['-m',resolve(root,c.model),'--host','127.0.0.1','--port',String(port),'-c','8192','-b','512','-ub','512','-t',String(c.threads),'-tb',String(c.threads),'-ngl',String(c.gpu_layers??0),'--parallel','2','--jinja','--no-webui'];
  if(c.device!=='CPU')args.push('--device',c.device,'--flash-attn','on');
  const owned=spawn(resolve(root,c.server),args,{windowsHide:true,stdio:['ignore','ignore','pipe']});
  child=owned;let error='';owned.stderr.on('data',b=>{error=(error+b).slice(-1200);});
  const ended=()=>{if(child===owned){child=null;ready=null;available=false;}};owned.once('error',ended);owned.once('exit',ended);
  for(let i=0;i<300;i++){if(current!==ticket||child!==owned)throw Error('中文模型已退出: '+error);try{if((await fetch(endpoint+'/health',{signal:AbortSignal.timeout(250)})).ok){available=true;startup=(performance.now()-began)/1000;return;}}catch{}await wait(100);}
  await stop();throw Error('中文模型启动超时.');
 }
 return {endpoint,state,stop,settings,async ensure(){ready??=start();await ready;}};
}

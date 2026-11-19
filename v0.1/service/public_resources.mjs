import {readdir,stat,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
export async function resourceProbe(root,state){
 let storage=0;async function scan(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=resolve(path,entry.name);if(entry.isDirectory())await scan(file);else storage+=(await stat(file)).size;}}
 await scan(resolve(root,'models'));
 const config=JSON.parse(await readFile(resolve(root,'configs/qwen_intent.json'),'utf8'));
 for(const path of [process.env.HAST_MODEL??config.model,'assets/avatar.vrm'])try{storage+=(await stat(resolve(root,path))).size;}catch{}
 let cached=null,time=0,inflight=null;
 const measure=async()=>{
  const runtime=state();let rss=runtime.pid?null:0;
  if(runtime.pid)try{
   if(process.platform==='win32'){const result=await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',`(Get-Process -Id ${Number(runtime.pid)} -ErrorAction Stop).WorkingSet64`],{windowsHide:true,timeout:2500,maxBuffer:1024});rss=Number(result.stdout.trim());}
   else if(process.platform==='linux'){const text=await readFile(`/proc/${runtime.pid}/status`,'utf8');rss=Number(text.match(/^VmRSS:\s+(\d+)/m)?.[1])*1024;}
   if(!Number.isFinite(rss)||rss<0)rss=null;
  }catch{}
  cached={timestamp:new Date().toISOString(),service_rss_bytes:process.memoryUsage().rss,language_rss_bytes:rss,storage_bytes:storage};time=Date.now();return cached;
 };
 return ()=>{if(cached&&Date.now()-time<2500)return Promise.resolve(cached);inflight??=measure().finally(()=>inflight=null);return inflight;};
}

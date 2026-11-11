import {watch} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {root,records,digest} from './hash_records.mjs';
// 开发模式: 监听 models/ 下的变化, 只重算被改文件相关的哈希, 不做全量扫描.
// 若被更新的 JSON 本身也是被校验的目标, 会递归向上更新它的记录.
// 用法: node tools/dev.mjs [--no-serve] [--no-initial]
const args=process.argv.slice(2),serve=!args.includes('--no-serve'),initial=!args.includes('--no-initial');
const stamp=()=>new Date().toLocaleTimeString('zh-CN',{hour12:false}),log=message=>console.log('['+stamp()+'] '+message);
let index=new Map();
async function refresh(){
 const next=new Map();
 for(const record of await records()){
  if(!next.has(record.target))next.set(record.target,[]);
  next.get(record.target).push(record);
 }
 index=next;
}
async function apply(targets){
 const queue=[...targets],seen=new Set();
 while(queue.length){
  const target=queue.shift();
  if(seen.has(target))continue;
  seen.add(target);
  const list=index.get(target);
  if(!list||!list.length)continue;
  let hash;
  try{hash=await digest(target,true);}catch(error){log('读取失败, 跳过 '+target+': '+error.message);continue;}
  const edits=new Map();
  for(const record of list){
   if(record.old===hash)continue;
   if(!edits.has(record.json))edits.set(record.json,await readFile(resolve(root,record.json),'utf8'));
   const text=edits.get(record.json);
   if(!text.includes(record.old)){record.old=hash;continue;}
   edits.set(record.json,text.split(record.old).join(hash));
   record.old=hash;
   log(target+' → '+record.json+' ('+record.label+')');
  }
  for(const [json,text]of edits){
   await writeFile(resolve(root,json),text);
   if(index.has(json))queue.push(json);
  }
 }
}
await refresh();
if(initial){log('初次校验 '+[...index.keys()].length+' 处哈希...');await apply([...index.keys()]);}
let child=null;
const port=Number(process.env.PORT??8769);
const open=()=>new Promise(resolve=>{
 const socket=net.createConnection({host:'127.0.0.1',port});
 socket.once('connect',()=>{socket.destroy();resolve(true);});
 socket.once('error',()=>resolve(false));
 socket.setTimeout(600,()=>{socket.destroy();resolve(false);});
});
if(serve&&await open()){log('端口 '+port+' 已在使用, 跳过服务启动, 仅更新哈希.');serve=false;}
if(serve){
 child=spawn(process.execPath,[resolve(root,'service/start.mjs')],{stdio:'inherit'});
 child.on('exit',code=>{child=null;log(code?'服务已退出 (code '+code+'), 哈希监听继续; 端口被占用时可用 --no-serve.':'服务已停止.');});
}else log('未启动服务, 只监听哈希.');
let timer=null;
const pending=new Set(),watcher=watch(resolve(root,'models'),{recursive:true,encoding:'utf8'},(event,file)=>{
 if(!file)return;
 pending.add('models/'+file.split(sep).join('/'));
 clearTimeout(timer);
 timer=setTimeout(flush,200);
});
async function flush(){
 const targets=[...pending];
 pending.clear();
 timer=null;
 if(!targets.length)return;
 try{await refresh();await apply(targets);}catch(error){log('更新失败: '+error.message);}
}
process.on('SIGINT',()=>{try{watcher.close();}catch{}child?.kill();process.exit(0);});
process.on('SIGTERM',()=>{try{watcher.close();}catch{}child?.kill();process.exit(0);});
log('监听 models/ 变化'+(serve?'':', 仅哈希监听'));

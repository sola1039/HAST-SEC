import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,records,digest,readJson} from './hash_records.mjs';
// 全量重算并写回所有被校验的哈希. 只替换哈希字符串, 不改 JSON 排版.
// 用法: node tools/rehash.mjs [--dry-run]
const dry=process.argv.includes('--dry-run'),files=new Map();
for(const record of await records()){
 if(!/^[a-f0-9]{64}$/.test(record.old??''))throw Error('哈希格式无效: '+record.json+' / '+record.label);
 if(!files.has(record.json))files.set(record.json,[]);
 files.get(record.json).push(record);
}
let total=0,stale=0,written=0;
for(const [json,items]of files){
 const text=await readFile(resolve(root,json),'utf8'),byOld=new Map();
 for(const record of items){
  record.next=await digest(record.target);
  if(!byOld.has(record.old))byOld.set(record.old,new Set());
  byOld.get(record.old).add(record.next);
 }
 for(const [old,next]of byOld)if(next.size>1)throw Error('同一旧哈希对应多个不同文件, 无法安全替换: '+old);
 let out=text;
 for(const [old,next]of byOld){const value=[...next][0];if(old!==value)out=out.split(old).join(value);}
 total+=items.length;
 stale+=items.filter(record=>record.old!==record.next).length;
 console.log(json);
 for(const record of items)if(!record.label.startsWith('sources.'))console.log('  '+(record.old===record.next?'ok     ':'update ')+record.label+(record.old===record.next?'':'  '+record.old.slice(0,10)+'… → '+record.next.slice(0,10)+'…'));
 const sources=items.filter(record=>record.label.startsWith('sources.'));
 if(sources.length){
  for(const record of sources.filter(item=>item.old!==item.next))console.log('  update '+record.label+'  '+record.old.slice(0,10)+'… → '+record.next.slice(0,10)+'…');
  console.log('  sources  '+sources.length+' 项 '+(sources.some(item=>item.old!==item.next)?'待更新':'ok'));
 }
 if(out!==text&&!dry){await writeFile(resolve(root,json),out);written++;}
}
if(!dry&&stale){
 let bad=0;
 for(const record of await records())if(record.old!==await digest(record.target)){bad++;console.error('校验失败: '+record.json+' / '+record.label);}
 if(bad)throw Error('写回后仍有 '+bad+' 处不一致.');
}
console.log('---');
console.log('检查 '+total+' 处哈希, 需要更新 '+stale+' 处, 本次写入 '+written+' 个文件.'+(dry?' (--dry-run, 未写入)':''));
const body=await readJson('models/body/model.json'),review=await readJson('models/body/review.json');
if(review.codes_sha256!==body.codes_sha256)console.warn('提示: models/body/review.json 的 codes_sha256 与当前码库不一致.');
const registry=await Promise.all(['models/skills/manifest.json','models/control/skills.json','models/policy/model.json'].map(async path=>(await readJson(path)).registry_sha256));
if(new Set(registry).size>1)console.warn('提示: registry_sha256 不一致, 该字段由素材审批流程生成, 本工具不重算.');
if(stale)console.log(dry?'预览结束, 去掉 --dry-run 即写入.':'哈希已更新, 刷新页面生效; 建议执行 npm run check 复核.');
else console.log('所有哈希已是最新.');

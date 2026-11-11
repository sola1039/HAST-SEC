import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
// 被校验的文件哈希登记表: 覆盖 tools/check.mjs 校验的全部哈希, 另含互为副本的多层记录.
// 每条记录 = {json: 记录哈希的 JSON, label: 字段说明, target: 被校验文件, old: 当前记录值}.
export const root=fileURLToPath(new URL('../',import.meta.url));
const cache=new Map();
export async function digest(path,refresh=false){
 if(refresh)cache.delete(path);
 if(!cache.has(path))cache.set(path,createHash('sha256').update(await readFile(resolve(root,path))).digest('hex'));
 return cache.get(path);
}
export const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
export async function records(){
 const list=[],add=(json,label,target,old)=>list.push({json,label,target,old});
 const body=await readJson('models/body/model.json');
 add('models/body/model.json','weights_sha256','models/body/weights.bin',body.weights_sha256);
 add('models/body/model.json','codes_sha256','models/body/codes.bin',body.codes_sha256);
 for(const [name,hash]of Object.entries(body.direction_hashes??{}))add('models/body/model.json','direction_hashes.'+name,'models/body/'+name,hash);
 const policy=await readJson('models/policy/model.json');
 add('models/policy/model.json','weights_sha256','models/policy/weights.bin',policy.weights_sha256);
 add('models/policy/model.json','texts_sha256','models/policy/texts.bin',policy.texts_sha256);
 for(const name of ['base','idle','expert','wave']){const meta=await readJson('models/control/'+name+'.json');add('models/control/'+name+'.json','sha256','models/control/'+name+'.bin',meta.sha256);}
 const timing=await readJson('models/timing/timing.json');
 add('models/timing/timing.json','sha256','models/timing/timing.bin',timing.sha256);
 for(const i of [0,1,2,3])for(const entry of await readJson(`models/skills/sources-${i}.json`))add(`models/skills/sources-${i}.json`,'sources.'+entry.file,'models/trajectories/'+entry.file,entry.sha256);
 const review=await readJson('models/body/review.json');
 add('models/body/review.json','codes_sha256(副本)','models/body/codes.bin',review.codes_sha256);
 return list;
}

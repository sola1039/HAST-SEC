import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
let modules=0,checked=0;
async function scan(folder){for(const entry of await readdir(resolve(root,folder),{withFileTypes:true})){
 const file=folder+'/'+entry.name;if(entry.isDirectory())await scan(file);else if(file.endsWith('.mjs')){
  execFileSync(process.execPath,['--check',resolve(root,file)],{stdio:'pipe',windowsHide:true});modules++;
  const text=await readFile(resolve(root,file),'utf8');for(const m of text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g))if(m[1].startsWith('.'))await access(resolve(root,dirname(file),m[1]));
 }
}}
for(const folder of ['service','web','motion','hands','face','retarget','training','tools'])await scan(folder);
async function hash(path,expected){const bytes=await readFile(resolve(root,path));if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('资源校验失败: '+path);checked++;return bytes;}
const body=await json('models/body/model.json');await hash('models/body/weights.bin',body.weights_sha256);await hash('models/body/codes.bin',body.codes_sha256);
for(const [name,expected]of Object.entries(body.direction_hashes))await hash('models/body/'+name,expected);
const policy=await json('models/policy/model.json');await hash('models/policy/weights.bin',policy.weights_sha256);await hash('models/policy/texts.bin',policy.texts_sha256);
for(const file of ['base','idle','expert','wave']){const meta=await json('models/control/'+file+'.json');await hash('models/control/'+file+'.bin',meta.sha256);}
const timing=await json('models/timing/timing.json');await hash('models/timing/timing.bin',timing.sha256);
const skills=await json('models/skills/manifest.json'),extra=await json('models/control/skills.json');
if(policy.registry_sha256!==skills.registry_sha256||extra.registry_sha256!==skills.registry_sha256)throw Error('运行资源版本不一致.');
const sources=(await Promise.all([0,1,2,3].map(i=>json(`models/skills/sources-${i}.json`)))).flat();
for(const source of sources){const bytes=await hash('models/trajectories/'+source.file,source.sha256);if(bytes.length!==source.frames*53*16)throw Error('轨迹数据形状无效.');}
for(const entry of skills.classes)await json('models/skills/'+entry.file);
for(const entry of extra.classes)await json('models/control/'+entry.file);
console.log('语法与本地依赖通过: '+modules+'个模块.');
console.log('运行资源校验通过: '+checked+'个文件.');

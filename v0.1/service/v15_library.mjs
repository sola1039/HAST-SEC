import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function extraLibrary(root,base){
 const folder=resolve(root,'models/control'),manifest=JSON.parse(await readFile(resolve(folder,'skills.json'),'utf8'));
 if(manifest.registry_sha256!==base.registry_sha256||JSON.stringify(manifest.bones)!==JSON.stringify(base.bones))throw Error('新增技能的素材审批或骨架不一致.');
 const classes=await Promise.all(manifest.classes.map(c=>readFile(resolve(folder,c.file),'utf8').then(JSON.parse)));
 return {...base,version:15,classes:[...base.classes,...classes]};
}

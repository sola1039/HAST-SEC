import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function runtimeRoutes(root){
 const routes=new Map([['/','web/v13_lab.html'],['/language-lab','web/v13_lab.html'],['/assets/avatar.vrm','assets/avatar.vrm']]);
 for(const folder of ['web','motion','face','hands','retarget','training','configs']){
  async function scan(path){for(const entry of await readdir(resolve(root,path),{withFileTypes:true})){const name=path+'/'+entry.name;if(entry.isDirectory())await scan(name);else if(/\.(mjs|css|json)$/.test(name))routes.set('/'+name,name);}}
  await scan(folder);
 }
 for(const [prefix,folder]of [['baseline-v9-filtered-data','body'],['feasible-history','history'],['v15-data','control'],['v14-data','timing'],['v14-policy','policy']])for(const name of await readdir(resolve(root,'models',folder)))routes.set('/'+prefix+'/'+name,'models/'+folder+'/'+name);
 const sources=(await Promise.all([0,1,2,3].map(i=>readFile(resolve(root,`models/skills/sources-${i}.json`),'utf8').then(JSON.parse)))).flat();
 for(const s of sources){if(!/^[\w-]+\.bin$/.test(s.file)||!/^\w+$/.test(s.id))throw Error('运行素材名称无效.');routes.set('/v13-sources/'+s.id+'.bin','models/trajectories/'+s.file);}
 return routes;
}

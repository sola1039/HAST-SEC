import {weights} from './v14_weights.mjs';
import {poseFeatures,selectorForward} from '../training/v13/selector.mjs';
export function selectSkill(net,codes,entry,history){
 const key=net.keys.indexOf(entry.key),pose=history.at(-1),f=selectorForward(net,[...net.keys.map((_,i)=>Number(i===key)),...poseFeatures(pose,history[0],net.joints)]),ids=codes.flatMap((c,i)=>c.key===entry.key?[i]:[]),max=Math.max(...ids.map(i=>f.values[i])),p=ids.map(i=>Math.exp(f.values[i]-max)),sum=p.reduce((s,v)=>s+v,0),id=ids[p.indexOf(Math.max(...p))],code=codes[id];
 if(!code||!entry.skills.some(s=>s.source===code.skill.source&&s.start===code.skill.start&&s.end===code.skill.end))throw Error('部位技能与批准来源不一致.');
 return {entry:{...entry,skills:[code.skill]},options:{cycles:code.cycles},report:{key:entry.key,code:id,probability:Math.max(...p)/sum,cycles:code.cycles,model_parameters:net.parameters,part:entry.part}};
}
export async function wavePolicy(library){
 const read=async name=>{const r=await fetch('/v15-data/'+name+'.json');if(!r.ok)throw Error('挥手策略读取失败.');return r.json();},[net,codes,metrics]=await Promise.all([weights('wave','/v15-data/'),read('wave-codes'),read('wave-metrics')]);
 if(net.registry_sha256!==library.registry_sha256||codes.length!==net.output||net.input!==net.keys.length+net.joints.length*6)throw Error('挥手策略形状或审批无效.');
 return {metrics,handles:key=>net.keys.includes(key),select:(entry,history)=>selectSkill(net,codes,entry,history)};
}

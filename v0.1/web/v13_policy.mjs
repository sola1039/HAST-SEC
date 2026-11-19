import {skillPolicy} from '../motion/skill_policy.mjs';
export async function learnedPolicy(library,prefix='/v13-policy/'){
 const read=async name=>{const r=await fetch(prefix+name);if(!r.ok)throw Error('局部策略读取失败.');return r;},model=await (await read('model.json')).json();
 const checked=async(name,expected)=>{const bytes=await(await read(name)).arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw Error('局部策略校验失败.');return new Float32Array(bytes);};
 const [weights,texts,entries]=await Promise.all([checked('weights.bin',model.weights_sha256),checked('texts.bin',model.texts_sha256),Promise.all(model.files.map(async name=>(await read(name)).json())).then(v=>v.flat())]);
 if(model.registry_sha256!==library.registry_sha256||JSON.stringify(model.bones)!==JSON.stringify(library.bones)||weights.length!==model.parameters||texts.length!==model.texts.length*32||entries.length!==model.output)throw Error('局部策略与审核骨架不一致.');
 const p=skillPolicy(model,weights,entries),textsByKey=new Map(model.texts.map((t,i)=>[t.key,texts.subarray(i*32,(i+1)*32)])),metrics=await(await read('metrics.json')).json();
 return {metrics,codeCount:model.output,select(entry,history){const r=p.select(entry,textsByKey.get(entry.key),history.at(-1),history[0]);return {entry:{...entry,skills:[r.skill]},report:{code:r.id,probability:r.probability,key:entry.key,model_parameters:model.parameters}};}};
}

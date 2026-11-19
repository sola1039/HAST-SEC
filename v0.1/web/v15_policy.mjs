import {reinforcedPolicy} from './v14_policy.mjs';
import {weights} from './v14_weights.mjs';
import {wavePolicy,selectSkill} from './v15_wave.mjs';
export async function extendedPolicy(library){
 const [original,net,codes,metrics]=await Promise.all([reinforcedPolicy(library),weights('expert','/v15-data/'),fetch('/v15-data/codes.json').then(r=>r.json()),fetch('/v15-data/metrics.json').then(r=>r.json())]);
 if(net.registry_sha256!==library.registry_sha256||codes.length!==net.output||net.input!==net.keys.length+net.joints.length*6)throw Error('身体部位策略结构或审批无效.');
 const wave=await wavePolicy(library);
 return {...original,nextMetrics:{...metrics,wave:wave.metrics},select(entry,history){
  if(wave.handles(entry.key))return wave.select(entry,history);
  const key=net.keys.indexOf(entry.key);if(key<0)return original.select(entry,history);
  return selectSkill(net,codes,entry,history);
 }};
}

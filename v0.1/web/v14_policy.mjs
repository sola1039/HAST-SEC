import {learnedPolicy} from './v13_policy.mjs';
import {weights} from './v14_weights.mjs';
import {poseFeatures,selectorForward} from '../training/v13/selector.mjs';
export async function reinforcedPolicy(library){
 const [policy,net,model,buffer,metrics]=await Promise.all([learnedPolicy(library,'/v14-policy/'),weights('timing'),fetch('/v14-policy/model.json').then(r=>r.json()),fetch('/v14-policy/texts.bin').then(r=>r.arrayBuffer()),fetch('/v14-data/metrics.json').then(r=>r.json())]),texts=new Float32Array(buffer);
 return {...policy,reinforcement:metrics,select(entry,history){
  const result=policy.select(entry,history),id=model.texts.findIndex(t=>t.key===entry.key);if(id<0)throw Error('持续时间策略中文条件缺失.');
  const x=[...texts.subarray(id*32,id*32+32),...poseFeatures(history.at(-1),history[0],model.joints)],p=selectorForward(net,x).p,cycles=net.cycles[p.indexOf(Math.max(...p))];
  return {...result,options:{cycles},report:{...result.report,cycles,timing_probability:Math.max(...p)}};
 }};
}

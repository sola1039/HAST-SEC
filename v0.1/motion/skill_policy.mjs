import {poseFeatures,selectorForward} from '../training/v13/selector.mjs';
export function skillPolicy(model,weights,entries){
 if(model.input!==32+model.joints.length*6||weights.length!==model.hidden*(model.input+1)+model.output*(model.hidden+1)||entries.length!==model.output||weights.some(v=>!Number.isFinite(v))||model.joints.some(i=>!Number.isInteger(i)||i<0||i>=53))throw Error('局部策略结构或权重无效.');
 const net={...model,weights};
 return {select(entry,vector,pose,previous){
  if(!vector||vector.length!==32||pose?.length!==53||previous?.length!==53)throw Error('局部策略中文或姿态输入维度无效.');
  const x=[...vector,...poseFeatures(pose,previous,model.joints)],p=selectorForward(net,x).p;
  const candidates=entry.skills.map(skill=>{const id=entries.findIndex(e=>e.key===entry.key&&e.source===skill.source&&e.start===skill.start);if(id<0)throw Error('局部动作码与策略码库不一致.');return {skill,probability:p[id],id};});
  const total=candidates.reduce((s,r)=>s+r.probability,0);if(!(total>0))throw Error('局部策略没有可执行概率.');
  // 执行范围由规划模型给出; 范围内的具体动作码由训练出的概率选择, 不用手写距离排序.
  const selected=candidates.reduce((best,row)=>row.probability>best.probability?row:best);
  return {...selected,probability:selected.probability/total,global_probability:selected.probability};
 }};
}

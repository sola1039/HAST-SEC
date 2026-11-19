import {jointPolicy,violation} from '../joint_feasibility.mjs';
export function validateInput(input,dt,count){
  if(!Number.isFinite(dt)||dt<0||dt>.051||!Array.isArray(input.rotations)||input.rotations.length!==count)throw Error('第九版状态数量或固定时间步无效.');
  const c=input.confidence;if(c!==null&&c!==undefined&&(c.length!==count||typeof c.some!=='function'||c.some(v=>!Number.isFinite(v)||v<0||v>1)))throw Error('第九版关节观测质量无效.');
  for(const name of ['rootConfidence','faceConfidence']){const c=input[name]??1;if(!Number.isFinite(c)||c<0||c>1)throw Error('第九版位移或面部观测质量无效.');}
}
// 检测得分不是已标定概率. 保留输入得分, 只降低明显越界观测的融合权重.
export function observationQuality(names,raw,scores){
  if(!scores)return {effective:names.map(()=>1),masked:0,provided:false};
  const effective=names.map((name,i)=>{
    const excess=violation(name,raw[i]),scale=Math.max(.1,jointPolicy(name).speed*.05),factor=Math.exp(-((excess/scale)**2));
    return scores[i]<.15?0:scores[i]*factor;
  });
  return {effective,masked:effective.filter(x=>x===0).length,provided:true};
}

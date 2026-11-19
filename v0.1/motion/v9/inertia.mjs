import {rotationStep,rotationExp} from '../feasible_math.mjs';
function terms(name,observed,old,dt,quality,settings){
  const base=/hips|spine|chest|Leg|Foot/.test(name)?settings.inertia_body??7:/Arm|Hand/.test(name)?settings.inertia_arms??4:settings.inertia_details??2,rawStep=rotationStep(old.raw,observed),ratio=(rawStep.length()/(settings.inertia_motion_step_rad??.07))**2;
  const weight=base*(1+2*(1-quality))/(1+ratio),tracking=(/Leg|Foot/.test(name)?.4:1.2)*Math.sqrt(quality),damping=Math.sqrt(2*tracking*weight),drive=rawStep.multiplyScalar(quality*ratio/(1+ratio)),forecast=old.v.clone().multiplyScalar(dt*(quality===0?Math.exp(-(old.missing??dt)/.4):1));
  return {weight,tracking,damping,drive,forecast};
}
export function inertialTarget(name,target,observed,old,dt,quality=1,settings={}){
  if(!old||dt<=0)return target.clone();
  const {weight,tracking,damping,drive,forecast}=terms(name,observed,old,dt,quality,settings),sum=tracking**2+weight**2+damping**2;if(sum<1e-12)return target.clone();
  const delta=rotationStep(old.q,target).multiplyScalar(tracking**2).addScaledVector(forecast,weight**2).addScaledVector(drive,damping**2).divideScalar(sum);
  return old.q.clone().multiply(rotationExp(delta));
}
// 二阶时间先验作用于求解输出本身. 观测的大幅快速变化降低权重, 低质量提高权重.
export function inertialResidual(rig,qs,observed,history,dt,quality,settings={}){
  const residual=[];
  qs.forEach((q,i)=>{
    const old=history?.[i];if(!old||dt<=0){residual.push(0,0,0,0,0,0);return;}
    const {weight,damping,drive,forecast}=terms(rig.names[i],observed[i],old,dt,quality?.[i]??1,settings),step=rotationStep(old.q,q);
    residual.push(...step.clone().sub(forecast).multiplyScalar(weight).toArray());
    // 相对数据保真项作逐通道临界阻尼配比. 高活动提供速度前馈, 小幅噪声不前馈.
    residual.push(...step.sub(drive).multiplyScalar(damping).toArray());
  });return residual;
}

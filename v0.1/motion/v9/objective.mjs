import {rotationStep} from '../feasible_math.mjs';
import {inertialResidual} from './inertia.mjs';
export function objective(rig,build,target,start,physical,history,dt,quality=null,observed=target,settings={},handGoal=null){
  return point=>{
    const state=rig.fk(point.q,point.p),tasks=build(state),residual=[...tasks.residual];
    point.q.forEach((q,i)=>residual.push(...rotationStep(target[i],q).multiplyScalar((/Leg|Foot/.test(rig.names[i])?.4:1.2)*(handGoal&&/^(hips|spine|chest|neck|head)$/.test(rig.names[i])?4:1)*Math.sqrt(quality?.[i]??1)).toArray()));
    residual.push(...point.p.clone().sub(start).multiplyScalar(.5).toArray());
    residual.push(...inertialResidual(rig,point.q,observed,history,dt,quality,settings));
    const dynamics=physical?.evaluate(state,point.q,history,dt),components=dynamics?.components??{};
    const sum=Object.values(components).reduce((s,x)=>s+x,0),scale=sum>0?(dynamics.cost/sum):0;
    for(const name of ['friction','pull','torque','acceleration','jerk'])residual.push(Math.sqrt(Math.max(0,(components[name]??0)*scale)));
    if(!residual.every(Number.isFinite))throw Error('第九版目标出现非有限残差.');
    return {state,residual,cost:residual.reduce((s,x)=>s+x*x,0),physical:components,hard:tasks.hard,...tasks.metrics};
  };
}

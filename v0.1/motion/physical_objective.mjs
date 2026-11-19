import {jointPolicy} from './joint_feasibility.mjs';
import {rotationStep} from './feasible_math.mjs';
// 软可行性代价, 不把未标定的质量、惯量、肌肉力当成精确人体测量.
export function physicalObjective(rig,physics,config={}){
  const friction=config.friction??.65,limit=n=>/Leg|hips|spine|chest/.test(n)?250:/Arm|Shoulder/.test(n)?90:/Hand|Foot/.test(n)?35:/Thumb|Index|Middle|Ring|Little/.test(n)?3:25;
  const excess=(x,scale)=>Math.max(0,x/scale-1)**4;
  const cache=new WeakMap();
  function evaluate(state,qs,history,dt){
    if(cache.has(state))return cache.get(state);
    const report=physics.evaluate(state,dt,false),force=report.support_force_N;
    const frictionExcess=Math.max(0,Math.hypot(force[0],force[2])-friction*Math.max(0,force[1])),pull=Math.max(0,-force[1]);
    let torque=0,acceleration=0,jerk=0;
    for(let i=0;i<rig.names.length;i++){
      torque+=excess(Math.hypot(...report.joint_torques_Nm[i]),limit(rig.names[i]));
      const old=history?.[i];if(!old||dt<=0)continue;
      const p=jointPolicy(rig.names[i]),v=rotationStep(old.q,qs[i]).divideScalar(dt),a=v.clone().sub(old.v).divideScalar(dt),j=a.clone().sub(old.a).divideScalar(dt);
      acceleration+=excess(a.length(),p.accel);jerk+=excess(j.length(),p.jerk);
    }
    const components={friction:excess(frictionExcess,60),pull:excess(pull,30),torque:torque/rig.names.length,acceleration:acceleration/rig.names.length,jerk:jerk/rig.names.length};
    const penalty=Math.min(1e8,Object.values(components).reduce((s,v)=>s+v,0));
    const result={cost:(config.physics_strength??.00002)*penalty,components,friction_excess_N:frictionExcess,pull_force_N:pull,report};cache.set(state,result);return result;
  }
  return {evaluate,torque_limits_Nm:rig.names.map(limit)};
}

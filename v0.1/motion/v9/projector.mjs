import {projectJoint} from '../joint_feasibility.mjs';
import {rotationExp,rotationStep,axis} from '../feasible_math.mjs';
import {targetsV9} from './targets.mjs';
import {objective} from './objective.mjs';
import {residualSolve} from './optimizer.mjs';
import {inertialTarget} from './inertia.mjs';
export function projectorV9(rig,dynamics,contact,settings){
  const variables=[{root:0,scale:.02},{root:1,scale:.02},{root:2,scale:.02}];
  for(const name of ['hips','spine','chest','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg'])for(const a of (/LowerLeg/.test(name)?[0]:/hips|UpperLeg/.test(name)?[0,1,2]:[0,2]))variables.push({joint:rig.index(name),axis:a,scale:.08});
  for(const side of ['left','right'])for(const part of ['UpperArm','LowerArm','Foot'])for(const a of [0,1,2])variables.push({joint:rig.index(side+part),axis:a,scale:.08});
  const controlled=new Set(variables.map(v=>v.joint));
  return {prepare(target,observed,history,dt,quality){
    return target.map((q,i)=>controlled.has(i)?q:history.limit(i,projectJoint(rig.names[i],inertialTarget(rig.names[i],q,observed[i],history.previous()[i],dt,quality?.[i]??1,settings),0),dt));
  },solve(target,root,proposal,dt,history,physical,previous,quality=null,observed=target,handGoal=null){
    const vars=handGoal?[...variables,...[0,1,2].map(a=>({joint:rig.index(handGoal.bone.replace('Hand','Shoulder')),axis:a,scale:.08}))]:variables;
    const start=root.clone(),build=targetsV9(rig,dynamics,contact,proposal,rig.fk(target,root),settings,handGoal);
    const map=point=>{if(previous&&dt>0){const d=point.p.clone().sub(previous.p),max=settings.maximum_root_step_mps*dt;if(d.length()>max)point.p.copy(previous.p).add(d.setLength(max));}
      point.q=point.q.map((q,i)=>history.limit(i,projectJoint(rig.names[i],q,0),dt));return point;};
    function shifted(point,step,factor){const next={q:point.q.map(q=>q.clone()),p:point.p.clone()};vars.forEach((v,i)=>{const d=step[i]*factor*v.scale;if(v.root!==undefined)next.p.setComponent(v.root,next.p.getComponent(v.root)+d);else next.q[v.joint].multiply(rotationExp(axis(v.axis).multiplyScalar(d)));});return map(next);}
    const evaluate=objective(rig,build,target,start,physical,history.previous(),dt,quality,observed,settings,handGoal),cache=new WeakMap();
    function move(point,i,amount){
      const legacy=()=>shifted(point,vars.map((_,j)=>j===i?amount:0),1);if(!settings.cached_derivative)return legacy();
      // 有限差分每次只扰动一个变量. 同一点其余关节的完整投影完全相同, 缓存它们而非省略约束.
      if(!cache.has(point))cache.set(point,shifted(point,vars.map(()=>0),1));const fixed=cache.get(point),next={q:fixed.q.slice(),p:fixed.p.clone()},v=vars[i],delta=amount*v.scale;
      if(v.root!==undefined){next.p=point.p.clone();next.p.setComponent(v.root,next.p.getComponent(v.root)+delta);
        if(previous&&dt>0){const d=next.p.clone().sub(previous.p),max=settings.maximum_root_step_mps*dt;if(d.length()>max)next.p.copy(previous.p).add(d.setLength(max));}
      }else{const q=point.q[v.joint].clone().multiply(rotationExp(axis(v.axis).multiplyScalar(delta)));next.q[v.joint]=history.limit(v.joint,projectJoint(rig.names[v.joint],q,0),dt);}
      if(settings.audit_cached_derivative){const old=legacy(),audit=settings.derivative_audit??={calls:0,max_error:0};audit.calls++;audit.max_error=Math.max(audit.max_error,next.p.distanceTo(old.p),...next.q.flatMap((q,j)=>q.toArray().map((x,k)=>Math.abs(x-old.q[j].toArray()[k]))));}
      return next;
    }
    const initial={q:target.map(q=>q.clone()),p:previous?previous.p.clone():root.clone()};
    // 优化关节从上一已验收状态开始, 其余骨骼使用同一惯性目标的闭式更新.
    vars.forEach(v=>{if(v.joint!==undefined)initial.q[v.joint]=(previous?previous.q[v.joint]:/Arm/.test(rig.names[v.joint])?target[v.joint]:rig.neutral[v.joint]).clone();});
    const difference=settings.reuse_jacobian?(a,b)=>vars.map(v=>(v.root!==undefined?b.p.getComponent(v.root)-a.p.getComponent(v.root):rotationStep(a.q[v.joint],b.q[v.joint]).getComponent(v.axis))/v.scale):null;
    const result=residualSolve(map(initial),{variables:vars,move,advance:shifted,evaluate,iterations:settings.solve_iterations,constrained:true,difference});
    if(!result.feasible){
      const restore=point=>{const r=evaluate(point),residual=r.hard.map(x=>x*10);return {...r,residual,cost:residual.reduce((s,x)=>s+x*x,0)};};
      const restored=residualSolve(result.point,{variables:vars,move,advance:shifted,evaluate:restore,iterations:settings.restore_iterations});
      if(restored.feasible){const final=evaluate(restored.point);return {...final,point:restored.point,iterations:result.iterations+restored.iterations,accepted:result.accepted+restored.accepted,initial_cost:result.initial_cost,final_cost:final.cost,status:'可行性恢复',backtracks:result.backtracks+restored.backtracks};}
    }
    return result;
  }};
}

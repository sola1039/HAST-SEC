import {Vector3} from 'three';
import {projectJoint} from './joint_feasibility.mjs';
import {rotationExp,rotationStep,axis,solveLinear} from './feasible_math.mjs';
import {feasibleTargets} from './feasible_targets.mjs';
export function wholeBodyProjector(rig,dynamics,contacts){
  const variables=[{root:0},{root:1},{root:2}];
  for(const name of ['hips','spine','chest','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg'])for(const a of (/LowerLeg/.test(name)?[0]:[0,2]))variables.push({joint:rig.index(name),axis:a});
  for(const side of ['left','right'])for(const part of ['UpperArm','LowerArm'])for(const a of [0,1,2])variables.push({joint:rig.index(side+part),axis:a});
  const descendant=(j,i)=>{for(let n=i;n>=0;n=rig.parents[n])if(n===j)return true;return false;};
  function derivative(variable,point,index,state){
    if(variable.root!==undefined)return axis(variable.root).applyQuaternion(rig.baseQ);
    if(!descendant(variable.joint,index))return new Vector3();
    return axis(variable.axis).applyQuaternion(state.q[variable.joint]).cross(point.clone().sub(state.p[variable.joint]));
  }
  return {solve(qs,root,rows,dt,timeLimit=null,rootLimit=null,handForward=0,physical=null,history=null,maxIterations=8,weights={},observation=null,velocity=new Vector3()){
    const target=qs.map(q=>q.clone()),start=root.clone(),initial=observation??rig.fk(qs,root),build=feasibleTargets(rig,dynamics,contacts,initial,rows,handForward,weights,velocity),total=dynamics.mass.reduce((a,b)=>a+b,0);
    const map=(q,p)=>{rootLimit?.(p);return q.map((v,i)=>timeLimit?timeLimit(i,projectJoint(rig.names[i],v,0),dt):projectJoint(rig.names[i],v,0));};
    qs.splice(0,qs.length,...map(qs,root));let state=rig.fk(qs,root),iterations=0,accepted=0;
    const cost=(q,p,s)=>build(s).reduce((v,t)=>v+t.error.lengthSq()*t.weight**2,0)+q.reduce((v,r,i)=>v+.02*r.angleTo(target[i])**2,0)+.02*p.distanceToSquared(start)+(physical?.evaluate(s,q,history,dt).cost??0);
    let value=cost(qs,root,state),initialCost=value;
    for(let k=0;k<maxIterations;k++){
      const tasks=build(state),J=[],e=[];if(!tasks.length)break;
      for(const t of tasks){
        const ds=variables.map(v=>t.index>=0?derivative(v,t.point,t.index,state):rig.names.reduce((r,_,i)=>r.addScaledVector(derivative(v,state.p[i].clone().lerp(state.p[rig.end[i]],.5),i,state),dynamics.mass[i]/total),new Vector3()));
        for(const a of [0,1,2]){J.push(ds.map(v=>v.getComponent(a)*t.weight));e.push(t.error.getComponent(a)*t.weight);}
      }
      variables.forEach((v,i)=>{J.push(variables.map((_,j)=>i===j?Math.sqrt(.02):0));e.push(Math.sqrt(.02)*(v.root!==undefined?start.getComponent(v.root)-root.getComponent(v.root):rotationStep(qs[v.joint],target[v.joint]).getComponent(v.axis)));});
      const A=variables.map((_,i)=>variables.map((_,j)=>J.reduce((s,r)=>s+r[i]*r[j],0))),b=variables.map((_,i)=>J.reduce((s,r,j)=>s+r[i]*e[j],0)),delta=solveLinear(A,b,.002);if(!delta)break;
      let improved=false;iterations++;
      for(const factor of [1,.5,.25,.125]){
        let trial=qs.map(q=>q.clone());const p=root.clone();variables.forEach((v,i)=>{const d=Math.max(-.08,Math.min(.08,delta[i]))*factor;if(v.root!==undefined)p.setComponent(v.root,p.getComponent(v.root)+d);else trial[v.joint].multiply(rotationExp(axis(v.axis).multiplyScalar(d)));});
        trial=map(trial,p);const s=rig.fk(trial,p),next=cost(trial,p,s);
        if(next<value-1e-9){qs.splice(0,qs.length,...trial);root.copy(p);state=s;value=next;accepted++;improved=true;break;}
      }
      if(!improved)break;
    }
    const hull=contacts.support(rows,state),center=dynamics.center(state),outside=hull?center.distanceTo(contacts.project(center,hull)):0;
    return {state,iterations,accepted,initial_cost:initialCost,final_cost:value,support_error_m:outside,root_shift_m:root.distanceTo(start),contacts:rows.map(f=>({bone:rig.names[f.index],active:f.active,prior:f.prior,score:f.score,slip_m:f.anchor?state.p[f.index].distanceTo(f.anchor):0}))};
  }};
}

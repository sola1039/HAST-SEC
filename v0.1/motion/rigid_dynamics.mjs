import {Vector3} from 'three';
import {rotationStep} from './feasible_math.mjs';
export function rigidDynamics(rig,totalMass=60){
  if(!Number.isFinite(totalMass)||totalMass<=0)throw Error('人体代理质量必须为正.');
  // De Leva分段比例的工程近似. 躯干按三节分配, 不是角色真实质量标定.
  const weight=name=>({hips:.14,spine:.14,chest:.1546,head:.0694}[name]??(/UpperArm$/.test(name)?.0271:/LowerArm$/.test(name)?.0162:/Hand$/.test(name)?.0045:/UpperLeg$/.test(name)?.1416:/LowerLeg$/.test(name)?.0433:/Foot$/.test(name)?.0137:/(Thumb|Index|Middle|Ring|Little)/.test(name)?.0016/15:0));
  const weights=rig.names.map(weight),sum=weights.reduce((a,b)=>a+b,0),mass=weights.map(w=>w/sum*totalMass),gravity=new Vector3(0,-9.81,0);let previous=null;
  const centers=s=>rig.names.map((_,i)=>s.p[i].clone().lerp(s.p[rig.end[i]],.5));
  const center=s=>centers(s).reduce((c,p,i)=>c.addScaledVector(p,mass[i]/totalMass),new Vector3());
  function evaluate(state,dt=0,commit=false){
    const c=centers(state),vel=c.map((p,i)=>previous&&dt>0?p.clone().sub(previous.centers[i]).divideScalar(dt):new Vector3()),acc=vel.map((v,i)=>previous&&dt>0?v.clone().sub(previous.vel[i]).divideScalar(dt):new Vector3());
    const omega=state.q.map((q,i)=>previous&&dt>0?rotationStep(previous.q[i],q).applyQuaternion(previous.q[i]).divideScalar(dt):new Vector3());
    const alpha=omega.map((w,i)=>previous&&dt>0?w.clone().sub(previous.omega[i]).divideScalar(dt):new Vector3());
    const force=acc.map((a,i)=>a.clone().sub(gravity).multiplyScalar(mass[i])),moment=[];
    for(let i=0;i<mass.length;i++){
      const d=state.p[rig.end[i]].clone().sub(state.p[i]),len=d.length(),axis=len>1e-8?d.divideScalar(len):new Vector3(0,1,0),inertia=mass[i]*Math.max(.015,len)**2/12;
      const apply=w=>w.clone().addScaledVector(axis,-.98*w.dot(axis)).multiplyScalar(inertia);
      moment[i]=apply(alpha[i]).add(omega[i].clone().cross(apply(omega[i]))).add(c[i].clone().sub(state.p[i]).cross(force[i]));
    }
    const external=force.reduce((f,v)=>f.add(v),new Vector3());
    for(let i=mass.length-1;i>0;i--){const p=rig.parents[i];moment[p].add(moment[i]).add(state.p[i].clone().sub(state.p[p]).cross(force[i]));force[p].add(force[i]);}
    const com=center(state),comVelocity=previous&&dt>0?com.clone().sub(previous.com).divideScalar(dt):new Vector3();
    const report={mass_kg:totalMass,kind:'刚体杆段逆动力学估计, 质量惯量未标定',center:com.toArray(),center_velocity:comVelocity.toArray(),support_force_N:external.toArray(),max_joint_torque_Nm:Math.max(...moment.slice(1).map(v=>v.length())),kinetic_energy_J:mass.reduce((s,m,i)=>s+.5*m*vel[i].lengthSq(),0),joint_torques_Nm:moment.map(v=>v.toArray()),joint_power_W:moment.map((v,i)=>v.dot(omega[i]))};
    if(commit&&(dt>0||!previous))previous={centers:c,vel,omega,q:state.q.map(q=>q.clone()),com};
    return report;
  }
  return {mass,center,evaluate,reset(){previous=null;},velocity:()=>previous?.vel.reduce((v,p,i)=>v.addScaledVector(p,mass[i]/totalMass),new Vector3())??new Vector3()};
}

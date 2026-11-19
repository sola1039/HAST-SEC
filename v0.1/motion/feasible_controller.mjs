import {Quaternion,Vector3} from 'three';
import {feasibleRig} from './feasible_rig.mjs';
import {projectJoint,jointPolicy,violation} from './joint_feasibility.mjs';
import {historyFilter} from './history_filter.mjs';
import {rigidDynamics} from './rigid_dynamics.mjs';
import {contactState} from './contact_state.mjs';
import {wholeBodyProjector} from './whole_body_projector.mjs';
import {feasibleFace} from '../face/feasible_face.mjs';
import {finiteQuaternion} from './feasible_math.mjs';
import {physicalObjective} from './physical_objective.mjs';
import {statisticalRegion} from './statistical_region.mjs';
import {auxiliaryHistory} from './auxiliary_history.mjs';
import {initialStats,updateStats} from './feasible_stats.mjs';
import {checkFeasibleConfig} from './feasible_config.mjs';
import {balanceObserver} from './balance_observer.mjs';
export function feasibleController(controller,{model=null,config={},faceNames=[],faceMetric=null,regions=null}={}){
  const rig=feasibleRig(controller),history=historyFilter(rig.names,model,controller.direction),physics=rigidDynamics(rig,config.mass_kg??60),contacts=contactState(rig),projector=wholeBodyProjector(rig,physics,contacts),face=feasibleFace(faceNames,faceMetric);rig.names.forEach(jointPolicy);
  const physical=physicalObjective(rig,physics,config),aux=auxiliaryHistory(rig,model,controller.direction),balance=balanceObserver(physics);
  let previousRoot=null,stats,last;function reset(){checkFeasibleConfig(config);history.reset();physics.reset();contacts.reset();face.reset();aux.reset();balance.reset();previousRoot=null;stats=initialStats();last=null;}reset();
  function step({rotations,root=rig.offsets[0].toArray(),expressions={},confidence=null,faceConfidence=1,rootObserved=false,rootConfidence=1},dt=0,{commit=true,lockedFeet=false,temporal=true}={}){
    if(!commit||!Number.isFinite(dt)||dt<0||dt>.12||rotations.length!==rig.names.length||confidence&&(confidence.length!==rig.names.length||confidence.some(v=>!Number.isFinite(v)||v<0||v>1)))throw Error('统一状态的时间步、提交方式、观测质量或骨骼数量无效.');
    const begin=performance.now(),raw=rotations.map(finiteQuaternion);let position=new Vector3().fromArray(root);if(!position.toArray().every(Number.isFinite))throw Error('根位置必须为有限数.');if(temporal)position=aux.root(position,rootObserved?rootConfidence:0,dt);
    let regionActive=0;
    const qs=raw.map((q,i)=>{const candidate=projectJoint(rig.names[i],temporal?history.propose(i,q,confidence?.[i]??1,dt):q,config.strength??2),region=statisticalRegion(rig.names[i],candidate,regions,config.region_strength??.25);if(region.active)regionActive++;return projectJoint(rig.names[i],region.q,0);});
    if(previousRoot&&dt>0){const shift=position.clone().sub(previousRoot),max=(config.maximum_root_step_mps??.8)*dt;if(shift.length()>max)position.copy(previousRoot).add(shift.setLength(max));}
    const rootLimit=p=>{if(previousRoot&&dt>0){const d=p.clone().sub(previousRoot),max=(config.maximum_root_step_mps??.8)*dt;if(d.length()>max)p.copy(previousRoot).add(d.setLength(max));}};
    let state=rig.fk(qs,position);const observation=rig.fk(raw.map((q,i)=>projectJoint(rig.names[i],q,0)),new Vector3().fromArray(root)),velocity=balance.update(observation,dt,confidence?.[0]??1),rows=contacts.update(state,dt,lockedFeet,rootObserved),solution=projector.solve(qs,position,rows,dt,history.limit,rootLimit,config.hand_forward_m??0,physical,history.previous(),config.iterations??8,config.tasks,observation,velocity);state=solution.state;
    const mapped=face.project(temporal?aux.face(expressions,faceConfidence,dt):expressions,dt,1),dynamics=physics.evaluate(state,dt,commit),force=dynamics.support_force_N,friction=Math.hypot(force[0],force[2])-Math.max(0,force[1])*(config.friction??.65),range=Math.max(...qs.map((q,i)=>violation(rig.names[i],q)))*180/Math.PI,bone=rig.audit(state),correction=raw.map((q,i)=>q.angleTo(qs[i])*180/Math.PI),elapsed=performance.now()-begin;
    if(!qs.flatMap(q=>q.toArray()).every(Number.isFinite)||bone>1e-6)throw Error('统一求解破坏骨架不变量.');
    if(commit){history.commit(qs,raw,dt);aux.commit(position,mapped,dt);previousRoot=position.clone();updateStats(stats,{elapsed,correction,bone,range,solution});}
    last={...solution,state:undefined,dynamics,physical:physical.evaluate(state,qs,history.previous(),dt).components,region_active:regionActive,friction_excess_N:Math.max(0,friction),range_error_deg:range,bone_error_m:bone,quality_source:confidence?'输入关节质量':'未提供置信度, 使用可信原生旋转假设',face:face.report(),elapsed_ms:elapsed};
    return {rotations:qs.map(q=>q.toArray()),root:position.toArray(),expressions:mapped,state,last};
  }
  return {reset,step,rig,write(result){rig.write(result.rotations.map(q=>new Quaternion().fromArray(q)),new Vector3().fromArray(result.root),result.expressions);},report:()=>({...stats,last,history:history.report(),kind:'全身历史观测融合与约束投影, 动力学为估计'})};
}

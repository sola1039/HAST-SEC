import {Vector3} from 'three';
import {feasibleRig} from '../feasible_rig.mjs';
import {violation} from '../joint_feasibility.mjs';
import {finiteQuaternion} from '../feasible_math.mjs';
import {historyFilter} from '../history_filter.mjs';
import {auxiliaryHistory} from '../auxiliary_history.mjs';
import {rigidDynamics} from '../rigid_dynamics.mjs';
import {physicalObjective} from '../physical_objective.mjs';
import {faceControllerV9} from '../../face/v9_controller.mjs';
import {initialStats,updateStats} from '../feasible_stats.mjs';
import {contactV9} from './contact.mjs';
import {projectorV9} from './projector.mjs';
import {retainedState} from './retained.mjs';
import {checkV9} from './config.mjs';
import {presentationValidator} from './validate.mjs';
import {postSolve} from './post_solve.mjs';
import {inputTarget} from './input_target.mjs';
export function controllerV9(controller,{model=null,config,faceNames=[],faceMetric=null,faceOrder,faceGroups=[],regions=null}){
  const rig=feasibleRig(controller),history=historyFilter(rig.names,model,controller.direction),aux=auxiliaryHistory(rig,model,controller.direction),physics=rigidDynamics(rig,config.mass_kg),contact=contactV9(rig),physical=physicalObjective(rig,physics,config),projector=projectorV9(rig,physics,contact,config),face=faceControllerV9(faceNames,faceMetric,faceOrder,faceGroups);
  const final=postSolve(rig,physics,contact,config,history);let previous=null,last=null,stats,hold=0;
  function reset(){checkV9(config);history.reset();aux.reset();physics.reset();contact.reset();face.reset();final.reset();previous=null;last=null;hold=0;stats={...initialStats(),held_frames:0,rejected_frames:0};}reset();
  function step(input,dt=0,{lockedFeet=false,temporal=true,regionsEnabled=true,manualFace={},forwardLeanDegrees=0,faceBehavior=null}={}){
    const begin=performance.now(),{raw,root,quality,filtered}=inputTarget(input,dt,rig,controller.direction,history,aux,regionsEnabled?regions:null,config,forwardLeanDegrees);
    const target=projector.prepare(filtered,raw,history,dt,quality.effective);
    const observation=rig.fk(raw,root),realized=previous?rig.fk(previous.q,previous.p):rig.rest,proposal=contact.propose(observation,dt,lockedFeet,realized,physics.center(realized),input.swingFoot);const handGoal=input.handGoal?{...input.handGoal,previousHand:realized.p[rig.index(input.handGoal.bone)].toArray(),maxStep:Math.max(.001,.5*dt)}:null;let solution=projector.solve(target,root,proposal,dt,history,physical,previous,quality.effective,raw,handGoal),chosen=proposal;
    if(!solution.feasible){
      stats.rejected_frames++;({chosen,solution}=retainedState(rig,physics,contact,config,{attempt:solution,previous,proposal,target,root,physical,history:history.previous(),dt,quality:quality.effective,observed:raw,handGoal}));hold+=dt;stats.held_frames++;
    }else hold=0;
    solution=final.run(solution,target,root,chosen,dt,physical,quality.effective,raw,temporal,handGoal);
    if(chosen===proposal)contact.commit(proposal);
    if(chosen!==proposal)contact.observe(proposal);
    const qs=solution.point.q,p=solution.point.p,bone=rig.audit(solution.state),range=Math.max(...qs.map((q,i)=>violation(rig.names[i],q)))*180/Math.PI;
    if(bone>1e-6||range>1e-4||!solution.feasible)throw Error('第九版输出未通过骨架与整体可行性验收.');
    const automaticFace=(input.faceConfidence??1)<.15?aux.face(input.expressions??{},0,dt):input.expressions??{},expressions=face.project(automaticFace,dt,1,faceBehavior,manualFace),physicalReport=physical.evaluate(solution.state,qs,history.previous(),dt),dynamics=physics.evaluate(solution.state,dt,true),elapsed=performance.now()-begin;
    const correction=raw.map((q,i)=>q.angleTo(qs[i])*180/Math.PI);history.commit(qs,raw,dt);aux.commit(p,expressions,dt);previous={q:qs.map(q=>q.clone()),p:p.clone()};
    const budgetBefore=stats.solver_limit_frames;updateStats(stats,{elapsed,correction,bone,range,solution});stats.solver_limit_frames=budgetBefore+Number(solution.status==='迭代上限');last={...solution,point:undefined,residual:undefined,state:undefined,dynamics,physical:physicalReport.components,friction_excess_N:physicalReport.friction_excess_N,range_error_deg:range,bone_error_m:bone,quality_source:quality.provided?'输入关节质量, 掩码部位'+quality.masked:'未提供置信度, 使用可信原生旋转假设',face:face.report(),elapsed_ms:elapsed,hold_seconds:hold,requires_pause:hold>=config.maximum_hold_seconds-1e-8};
    return {rotations:qs.map(q=>q.toArray()),root:p.toArray(),expressions,state:solution.state,last,handGoal:handGoal};
  }
  const validate=presentationValidator(rig,physics,contact,config);
  return {reset,step,rig,validate,write(result){rig.write(result.rotations.map(finiteQuaternion),new Vector3().fromArray(result.root),result.expressions);},report:()=>({...stats,last,history:{...history.report(),joints:final.report()?.joints??[]},kind:'第九版, 求解后平滑与整体可行性验收'})};
}

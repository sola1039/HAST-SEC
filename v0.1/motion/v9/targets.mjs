import {Vector3} from 'three';
import {rotationStep,RAD} from '../feasible_math.mjs';
import {bodyWorldPoint} from '../body_frame.mjs';
import {armTask} from './arm_task.mjs';
const up=new Vector3(0,1,0),tilt=q=>up.clone().applyQuaternion(q).angleTo(up);
const penalty=(v,soft,scale,weight)=>{const n=v.length();return n>soft?v.clone().multiplyScalar(weight*((n-soft)/scale)**2/n):new Vector3();};
export function targetsV9(rig,dynamics,contact,proposal,target,settings,handGoal=null){
  if(handGoal&&(!['leftHand','rightHand'].includes(handGoal.bone)||![undefined,'head'].includes(handGoal.reference)||!Array.isArray(handGoal.point)||handGoal.point.length!==3||handGoal.point.some(v=>!Number.isFinite(v)||Math.abs(v)>150)))throw Error('手部任务目标格式无效.');
  const hands=['leftHand','rightHand'].map(n=>rig.index(n)),forward=new Vector3(0,0,1).applyQuaternion(target.q[0]).setY(0).normalize(),handTargets=hands.map(i=>target.p[i].clone().addScaledVector(forward,settings.hand_forward_m));
  return state=>{
    const residual=[],hard=[],metrics={contacts:[]};
    hands.forEach((i,j)=>{const task=handGoal?.bone===rig.names[i],error=state.p[i].clone().sub(task?bodyWorldPoint(rig,state,handGoal.point,handGoal.reference):handTargets[j]);residual.push(...error.multiplyScalar(task?30:.6/.06).toArray());if(task)metrics.task_hand_error_cm=error.length()/30*100;});
    if(handGoal){const arm=armTask(rig,state,handGoal);residual.push(...arm.residual);hard.push(...arm.hard);Object.assign(metrics,arm.metrics);}
    for(const f of proposal.rows){
      if(!f.active&&proposal.swingFoot===rig.names[f.index]&&proposal.footTarget)residual.push(...state.p[f.index].clone().sub(proposal.footTarget).multiplyScalar(18).toArray());
      const penetration=new Vector3(0,Math.min(0,state.p[f.index].y-f.floor),0),error=f.active?state.p[f.index].clone().sub(f.anchor):f.landing?state.p[f.index].clone().sub(f.landingTarget):penetration,angle=f.active||f.landing?rotationStep(f.orientation,state.q[f.index]):new Vector3();
      residual.push(...penalty(error,.004,.02,2).toArray(),...penalty(angle,3*RAD,10*RAD,.8).toArray());
      const footTilt=f.active?tilt(state.q[f.index]):0;
      hard.push(Math.max(0,(f.active?error:penetration).length()/settings.contact_tolerance_m-1),Math.max(0,footTilt/(settings.foot_tilt_degrees*RAD)-1));
      metrics.contacts.push({bone:rig.names[f.index],active:f.active,landing:f.landing,unloading:f.unloading,prior:f.prior,score:f.score,slip_m:error.length(),tilt_degrees:footTilt/RAD});
    }
    const center=dynamics.center(state),outside=contact.project(center,proposal.hull).sub(center);outside.y=0;
    residual.push(...penalty(outside,.002,.02,3).toArray());hard.push(Math.max(0,outside.length()/settings.support_tolerance_m-1));
    const transfer=proposal.futureHull?contact.project(center,proposal.futureHull).sub(center).setY(0):new Vector3();residual.push(...penalty(transfer,.005,.05,proposal.swingFoot?12:.5).toArray());metrics.weight_transfer_m=transfer.length();
    for(const [name,limit]of [['hips',settings.hips_tilt_degrees],['chest',settings.chest_tilt_degrees]]){const a=tilt(state.q[rig.index(name)])/RAD;metrics[name+'_tilt_degrees']=a;residual.push(Math.max(0,(a-limit*.8)/(limit*.2))**2);hard.push(Math.max(0,a/limit-1));}
    if(settings.arm_collision_enabled){
      for(const side of ['left','right']){
        if(handGoal?.bone===side+'Hand')continue;
        const arm=armTask(rig,state,{bone:side+'Hand'});
        residual.push(...arm.residual);hard.push(...arm.hard);
        metrics[side+'_body_clearance_m']=arm.metrics.task_min_body_clearance_m;
      }
    }
    return {residual,hard,metrics:{...metrics,support_error_m:outside.length(),hard_violation:Math.hypot(...hard),feasible:hard.every(x=>x<1e-5)}};
  };
}

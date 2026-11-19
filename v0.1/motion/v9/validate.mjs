import {Vector3} from 'three';
import {finiteQuaternion} from '../feasible_math.mjs';
import {violation} from '../joint_feasibility.mjs';
import {targetsV9} from './targets.mjs';
export function presentationValidator(rig,physics,contact,config){
  return result=>{const proposal=contact.current();if(!proposal)return false;const qs=result.rotations.map(finiteQuaternion),state=rig.fk(qs,new Vector3().fromArray(result.root));return qs.every((q,i)=>violation(rig.names[i],q)<1e-6)&&targetsV9(rig,physics,contact,proposal,state,config,result.handGoal??null)(state).metrics.feasible;};
}

import {Vector3} from 'three';
import {finiteQuaternion} from '../feasible_math.mjs';
import {projectJoint} from '../joint_feasibility.mjs';
import {statisticalRegion} from '../statistical_region.mjs';
import {postureBias} from './posture_bias.mjs';
import {observationQuality,validateInput} from './observations.mjs';
export function inputTarget(input,dt,rig,direction,history,aux,regions,config,lean){
 validateInput(input,dt,rig.names.length);
 const raw=postureBias(input.rotations.map(finiteQuaternion),rig,direction,lean),root=new Vector3().fromArray(input.root??rig.offsets[0].toArray());
 if(!root.toArray().every(Number.isFinite))throw Error('第九版根位移无效.');
 if(input.rootObserved&&(input.rootConfidence??1)<.15)root.copy(aux.root(root,0,dt));
 const quality=observationQuality(rig.names,raw,input.confidence),filtered=raw.map((q,i)=>{
  q=quality.effective[i]===0?history.propose(i,q,0,dt):q;
  q=projectJoint(rig.names[i],q,config.strength);
  return projectJoint(rig.names[i],statisticalRegion(rig.names[i],q,regions,config.region_strength).q,0);
 });
 return {raw,root,quality,filtered};
}

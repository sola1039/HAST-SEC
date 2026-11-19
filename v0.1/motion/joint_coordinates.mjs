import {Quaternion,Vector3} from 'three';
import {finiteQuaternion,rotationLog,rotationExp,axis} from './feasible_math.mjs';
// 摆动乘轴向扭转. 肘用前臂X轴, 膝用胫骨Y轴, 指骨用纵向X轴.
const twistAxes=new Map();
export function twistAxis(name){if(!twistAxes.has(name))twistAxes.set(name,/LowerLeg$/.test(name)?1:/LowerArm$|Thumb|Index|Middle|Ring|Little/.test(name)?0:-1);return twistAxes.get(name);}
export function jointCoordinates(name,value){
  const q=finiteQuaternion(value),a=twistAxis(name);if(a<0)return rotationLog(q);
  const t=new Quaternion(0,0,0,q.w);t[['x','y','z'][a]]=q[['x','y','z'][a]];
  if(t.lengthSq()<1e-12)t.identity();else t.normalize();
  const swing=rotationLog(q.clone().multiply(t.clone().invert())),twist=rotationLog(t).getComponent(a);
  swing.setComponent(a,twist);return swing;
}
export function jointRotation(name,value){
  const a=twistAxis(name);if(a<0)return rotationExp(value);
  const swing=value.clone().setComponent(a,0),twist=axis(a).multiplyScalar(value.getComponent(a));
  return rotationExp(swing).multiply(rotationExp(twist)).normalize();
}

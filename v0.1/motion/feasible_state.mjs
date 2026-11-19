import {Vector3,Quaternion} from 'three';
import {rotationExp,rotationLog} from './feasible_math.mjs';
export function poseState(frame,controller,rootReference,faceNames){
  const delta=frame.root??[0,0,0];if(delta.length!==3||delta.some(v=>!Number.isFinite(v)))throw Error('根位移格式无效.');
  return {rotations:frame.rotations.map(q=>controller.adapt(q)),root:rootReference.clone().add(new Vector3(...controller.adapt(delta))).toArray(),expressions:frame.expressions??Object.fromEntries(faceNames.map((n,i)=>[n,frame.face?.[i]??(n==='aa'?frame.jaw??0:0)])),confidence:frame.confidence??null,faceConfidence:frame.faceConfidence??1,rootObserved:frame.rootObserved??false,rootConfidence:frame.rootConfidence??1,handGoal:frame.handGoal??null,swingFoot:frame.swingFoot??null};
}
export function featureState(row,controller,meta,{root=null,rootObserved=false,confidence=null,rootReference}={}){
  const dim=meta.bones.length*3+meta.face.length;
  if(![dim,dim+3].includes(row.length)||Array.from(row).some(v=>!Number.isFinite(v)))throw Error('统一特征长度或有限性检查失败.');
  const rootDelta=root??(row.length===dim+3?Array.from(row.slice(dim)): [0,0,0]);
  if(!rootReference)throw Error('统一特征需要固定根参考.');
  return poseState({rotations:meta.bones.map((_,i)=>rotationExp(new Vector3(...row.slice(i*3,i*3+3))).toArray()),root:rootDelta,face:row.slice(meta.bones.length*3,dim),confidence,rootObserved},controller,rootReference,meta.face);
}
export function stateFeatures(result,controller,meta,rootReference){
  const row=new Float32Array(meta.bones.length*3+meta.face.length+3);
  result.rotations.forEach((q,i)=>row.set(rotationLog(new Quaternion().fromArray(controller.adapt(q))).toArray(),i*3));
  meta.face.forEach((n,i)=>row[meta.bones.length*3+i]=result.expressions[n]??0);
  row.set(controller.adapt(new Vector3(...result.root).sub(rootReference).toArray()),row.length-3);
  return row;
}

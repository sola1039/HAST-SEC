import {Quaternion,Vector3} from 'three';
import {rotationLog,rotationExp} from '../retarget/rotation_math.mjs';
export {rotationLog,rotationExp};
export const RAD=Math.PI/180;
export function finiteQuaternion(value){
  const q=value?.isQuaternion?value.clone():new Quaternion().fromArray(value);
  if(!q.toArray().every(Number.isFinite)||q.lengthSq()<1e-12)throw Error('骨骼旋转必须有限且非零.');
  return q.normalize();
}
export function powerBoundary(value,soft,hard,strength=4){
  if(![value,soft,hard,strength].every(Number.isFinite)||soft<0||hard<soft||strength<0)throw Error('可行范围参数无效.');
  const size=Math.abs(value);if(size<=soft)return value;
  const scale=Math.max(hard-soft,1e-6),r=(size-soft)/scale;let lo=0,hi=r;
  for(let i=0;i<20;i++){const y=(lo+hi)/2;if(y+strength*y**3>r)hi=y;else lo=y;}
  return Math.sign(value)*Math.min(hard,soft+scale*(lo+hi)/2);
}
export function interval(value,soft,hard,strength=4){
  if(value>=soft[0]&&value<=soft[1])return value;
  const edge=value<soft[0]?soft[0]:soft[1],room=value<edge?edge-hard[0]:hard[1]-edge;
  return Math.max(hard[0],Math.min(hard[1],edge+powerBoundary(value-edge,0,Math.max(0,room),strength)));
}
export function solveLinear(matrix,rhs,ridge=0){
  const n=rhs.length,a=matrix.map((r,i)=>[...r.map((v,j)=>v+(i===j?ridge:0)),rhs[i]]);
  for(let k=0;k<n;k++){
    let p=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[p][k]))p=i;
    [a[p],a[k]]=[a[k],a[p]];if(Math.abs(a[k][k])<1e-12)return null;
    const v=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=v;
    for(let i=0;i<n;i++)if(i!==k){const d=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=d*a[k][j];}
  }
  return a.map(r=>r[n]);
}
export function rotationStep(a,b){return rotationLog(a.clone().invert().multiply(b));}
export function boundedVector(v,length){return v.length()>length?v.clone().setLength(length):v.clone();}
export function percentile(values,p){const a=[...values].sort((x,y)=>x-y);return a.length?a[Math.floor((a.length-1)*p)]:0;}
export const axis=i=>new Vector3().setComponent(i,1);

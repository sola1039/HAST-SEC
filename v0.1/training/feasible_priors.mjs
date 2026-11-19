import {Vector3} from 'three';
import {jointCoordinates} from '../motion/joint_coordinates.mjs';
import {solveLinear,RAD} from '../motion/feasible_math.mjs';
export function priorAccumulator(names,capacity=4096){
  let count=0;const rows=names.map(()=>new Float64Array(capacity*3));
  return {add(rotations){if(rotations.length!==names.length)throw Error('统计区域骨骼数量无效.');if(count===capacity){capacity*=2;rows.forEach((row,i)=>{const next=new Float64Array(capacity*3);next.set(row);rows[i]=next;});}rotations.forEach((q,i)=>rows[i].set(jointCoordinates(names[i],q).toArray(),count*3));count++;},fit(){
    if(count<20)throw Error('统计区域样本不足.');
    return Object.fromEntries(names.filter(n=>n!=='hips').map(name=>{
      const values=rows[names.indexOf(name)],mean=[0,0,0],cov=Array.from({length:3},()=>[0,0,0]);
      for(let n=0;n<count;n++)for(let a=0;a<3;a++)mean[a]+=values[n*3+a]/count;
      for(let n=0;n<count;n++)for(let a=0;a<3;a++)for(let b=0;b<3;b++)cov[a][b]+=(values[n*3+a]-mean[a])*(values[n*3+b]-mean[b])/count;
      cov.forEach((r,i)=>r[i]+=(5*RAD)**2);const inverse=Array.from({length:3},(_,i)=>solveLinear(cov,[0,1,2].map(j=>i===j?1:0))),radii=new Float64Array(count);
      for(let n=0;n<count;n++){let r=0;for(let a=0;a<3;a++)for(let b=0;b<3;b++)r+=(values[n*3+a]-mean[a])*inverse[a][b]*(values[n*3+b]-mean[b]);radii[n]=Math.sqrt(Math.max(0,r));}radii.sort();
      return [name,{mean,inverse,radius:Math.max(3.5,radii[Math.floor((count-1)*.995)]),samples:count,kind:'保守协方差椭球, 数据覆盖率而非检测置信度'}];
    }));
  }};
}
export function hydrateRegions(records){return Object.fromEntries(Object.entries(records).map(([n,p])=>[n,{...p,mean:new Vector3(...p.mean)}]));}

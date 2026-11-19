import {jointCoordinates,jointRotation} from './joint_coordinates.mjs';
import {powerBoundary} from './feasible_math.mjs';
export function statisticalRegion(name,q,regions,strength=.25){
  const p=regions?.[name];if(!p||name==='hips'||strength===0)return {q:q.clone(),radius:0,active:false};
  const v=jointCoordinates(name,q),d=v.clone().sub(p.mean),a=d.toArray(),radius=Math.sqrt(Math.max(0,a.reduce((s,x,i)=>s+x*p.inverse[i].reduce((t,y,j)=>t+y*a[j],0),0))),soft=p.radius;
  if(radius<=soft)return {q:q.clone(),radius,active:false};
  const next=powerBoundary(radius,soft,soft*3,strength),value=p.mean.clone().addScaledVector(d,next/radius);
  return {q:jointRotation(name,value),radius,active:true};
}

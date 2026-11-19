import {Quaternion,Vector3} from "three";
export function rotationLog(q){
  q=q.clone().normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);
  const s=Math.hypot(q.x,q.y,q.z);
  return s<1e-10?new Vector3():new Vector3(q.x,q.y,q.z).multiplyScalar(2*Math.atan2(s,q.w)/s);
}
export function rotationExp(v){const n=v.length();return n<1e-10?new Quaternion():new Quaternion().setFromAxisAngle(v.clone().divideScalar(n),n);}
export const deltaRotation=(a,b)=>rotationLog(a.clone().invert().multiply(b));
export function median(values){if(!values.length)return 0;const v=[...values].sort((a,b)=>a-b),i=Math.floor(v.length/2);return v.length%2?v[i]:(v[i-1]+v[i])/2;}
export function noiseScale(qs){
  const values=[];for(let i=2;i<qs.length;i++)values.push(deltaRotation(qs[i-1],qs[i]).sub(deltaRotation(qs[i-2],qs[i-1])));
  const scales=[0,1,2].map(a=>{const v=values.map(p=>p.getComponent(a)),center=median(v);return 1.4826*median(v.map(x=>Math.abs(x-center)))/Math.sqrt(6);});
  return Math.max(.001,Math.hypot(...scales));
}
export function spectralEnergy(qs,dt,threshold=4){
  if(qs.length<4)return 0;const n=qs.length,ref=qs[0],values=qs.map(q=>deltaRotation(ref,q)),center=(n-1)/2,mean=new Vector3(),slope=new Vector3();let variance=0,energy=0;
  values.forEach((v,i)=>{mean.add(v);slope.addScaledVector(v,i-center);variance+=(i-center)**2;});mean.divideScalar(n);slope.divideScalar(variance||1);
  // 去除非周期性的线性趋势, 不把整体倾身误算成高频噪声.
  values.forEach((v,i)=>v.sub(mean).addScaledVector(slope,center-i));
  for(let k=1;k<n;k++)if(k/(2*n*dt)>=threshold){const v=new Vector3();for(let i=0;i<n;i++)v.addScaledVector(values[i],Math.sqrt(2/n)*Math.cos(Math.PI*(i+.5)*k/n));energy+=v.lengthSq();}
  return energy/n;
}

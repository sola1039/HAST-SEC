import {Vector3} from 'three';
import {beatRuntime,blendBeat} from './beat_runtime.mjs';
import {rotationExp,rotationLog} from '../retarget/rotation_math.mjs';
// 在新轨迹上叠加有限时长的位姿和速度残差, 不再把旧末帧停住后混入新动作.
export function beatRuntimeV9(meta,weights,codes,{adaptiveTransition=true,policy}={}){
  const base=beatRuntime(meta,weights,codes,{policy}),dim=meta.dim,n=meta.frames,rate=meta.rate,bones=meta.bones.length,seam=['head','chest','leftUpperArm','leftLowerArm','rightUpperArm','rightLowerArm'].map(name=>meta.bones.indexOf(name));
  if(seam.some(i=>i<0))throw Error('第九版接续参考骨骼不完整.');
  const frame=(k,i)=>Array.from(codes.subarray((k*n+i)*dim,(k*n+i+1)*dim)),q=(row,i)=>rotationExp(new Vector3(...row.slice(i*3,i*3+3)));
  let previous=null,offset=null,velocity=null,duration=.4;
  function transition(oldToken,token){
    const a=frame(oldToken,n-1),before=frame(oldToken,n-2),b=frame(token,0),after=frame(token,1);offset=a.map((x,j)=>x-b[j]);velocity=offset.map((_,j)=>((a[j]-before[j])-(after[j]-b[j]))*rate);
    for(let i=0;i<bones;i++){
      const outgoing=q(a,i),incoming=q(b,i),x=rotationLog(incoming.clone().invert().multiply(outgoing));
      const extrapolated=outgoing.clone().multiply(q(before,i).invert().multiply(outgoing)),next=rotationLog(q(after,i).invert().multiply(extrapolated));
      offset.splice(i*3,3,...x.toArray());velocity.splice(i*3,3,...next.sub(x).multiplyScalar(rate).toArray());
    }
    // 三次位姿残差的峰值速度为1.5*姿态差/时长. 仅大接缝延长, 不改变原型抽选和片段内部时间.
    const gap=Math.max(...seam.map(i=>new Vector3(...offset.slice(i*3,i*3+3)).length()));
    duration=adaptiveTransition?Math.max(.4,Math.min(1,1.5*gap/(120*Math.PI/180))):.4;
  }
  return {sample(dt){
    const row=base.sample(dt);if(previous&&row.steps!==previous.steps)transition(previous.token,row.token);
    const pos=Math.min(n-1,row.time*rate),a=Math.floor(pos),b=Math.min(n-1,a+1);let values=blendBeat(frame(row.token,a),frame(row.token,b),pos-a,bones);
    if(offset&&row.time<duration){const t=row.time/duration,h0=2*t**3-3*t**2+1,h1=t**3-2*t**2+t;
      values=values.map((x,j)=>j>=bones*3?x+h0*offset[j]+h1*duration*velocity[j]:x);
      for(let i=0;i<bones;i++){const residual=new Vector3(...offset.slice(i*3,i*3+3)).multiplyScalar(h0).addScaledVector(new Vector3(...velocity.slice(i*3,i*3+3)),h1*duration);values.splice(i*3,3,...rotationLog(q(values,i).multiply(rotationExp(residual))).toArray());}
    }
    previous=row;return {...row,values,transition_kind:'位姿和速度残差衰减',transition_duration:duration};
  }};
}

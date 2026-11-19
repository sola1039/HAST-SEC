import {Vector3} from "three";
import {rotationExp,rotationLog} from "../retarget/rotation_math.mjs";
import {forward,seeded} from "./pilot_network.mjs";
const q=(row,bone)=>rotationExp(new Vector3(...row.slice(bone*3,bone*3+3)));
export function blendBeat(a,b,t,bones){
  const result=a.map((v,j)=>v+(b[j]-v)*t);
  for(let bone=0;bone<bones;bone++){const v=rotationLog(q(a,bone).slerp(q(b,bone),t));result.splice(bone*3,3,...v.toArray());}
  return result;
}
export function beatRuntime(meta,weights,codes,{policy=()=>1}={}){
  if(meta.dim!==178||meta.bones.length!==53||meta.input!==meta.codes*2+1||weights.length!==meta.parameters||codes.length!==meta.codes*meta.frames*meta.dim||weights.some(v=>!Number.isFinite(v))||codes.some(v=>!Number.isFinite(v)))throw Error("第七版骨骼或权重格式无效.");
  const net={...meta,weights},rng=seeded(109),d=meta.dim,n=meta.frames,period=(n-1)/meta.rate,seam=["head","leftUpperArm","leftLowerArm","rightUpperArm","rightLowerArm"].map(name=>meta.bones.indexOf(name));
  if(seam.some(i=>i<0)||meta.prototypes.length!==meta.codes)throw Error("接续骨骼或原型不完整.");
  const excluded=new Set(meta.excluded_prototypes??[]);if(excluded.size>=meta.codes||[...excluded].some(i=>!Number.isInteger(i)||i<0||i>=meta.codes))throw Error("排除原型范围无效.");
  let history=[0,0],token=0,time=0,seconds=0,previous=null,steps=0;
  const frame=(k,i)=>Array.from(codes.subarray((k*n+i)*d,(k*n+i+1)*d));
  function choose(){
    const probabilities=forward(net,history,0).p,scores=probabilities.map((p,i)=>{
      if(excluded.has(i))return 0;
      const first=frame(i,0),cost=previous?seam.reduce((s,b)=>s+q(first,b).angleTo(q(previous,b))**2,0)/15:0;
      const preference=policy(i);if(!Number.isFinite(preference)||preference<0)throw Error('底座概率偏好无效.');
      return (p+.01)*Math.exp(-cost*3)*(i===history[1]?.25:1)*preference;
    });
    const sum=scores.reduce((s,v)=>s+v,0);if(!Number.isFinite(sum)||sum<=0)throw Error("动作概率总量无效.");
    let draw=rng()*sum,selected=scores.findLastIndex(v=>v>0);for(const [i,score] of scores.entries()){draw-=score;if(score>0&&draw<=0){selected=i;break;}}
    history=[history[1],selected];steps++;return selected;
  }
  token=choose();previous=frame(token,0);
  return {sample(dt){
    if(!Number.isFinite(dt)||dt<0||dt>.2)throw Error("动作时间步无效.");time+=dt;seconds+=dt;
    if(time>=period){previous=frame(token,n-1);time-=period;token=choose();}
    const pos=time*meta.rate,a=Math.min(n-1,Math.floor(pos)),b=Math.min(n-1,a+1),t=pos-a;
    let values=blendBeat(frame(token,a),frame(token,b),t,meta.bones.length);
    const blend=Math.min(1,time/.4),ease=blend*blend*(3-2*blend);values=blendBeat(previous,values,ease,meta.bones.length);
    return {values,token,time,seconds,steps,condition:0};
  }};
}

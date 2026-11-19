import {Quaternion,Vector3} from 'three';
import {selectorForward} from '../training/v13/selector.mjs';
import {rotationLog,rotationExp} from '../retarget/rotation_math.mjs';
import {seeded} from '../training/pilot_network.mjs';
import {weights} from './v14_weights.mjs';
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
export async function conditionalBase(prefix='/v14-data/'){
 const [net,idle]=await Promise.all([weights('base',prefix),weights('idle',prefix)]);
 const review=prefix==='/v15-data/'?await fetch('/configs/v15_review.json').then(r=>{if(!r.ok)throw Error('待机审核过滤读取失败.');return r.json();}):{excluded_idle:[]},excluded=new Set(idle.entries.flatMap((e,i)=>review.excluded_idle.some(x=>x.source===e.source&&x.start===e.start&&x.end===e.end)?[i+1]:[]));
 if(net.registry_sha256!==idle.registry_sha256||net.output!==idle.entries.length+1+Number(!!net.activity_code))throw Error('待机策略与素材审批不一致.');
 if(idle.bones.length!==53||net.input!==(net.pose_input===false?0:net.joints.length*3)+net.output+3||idle.entries.some(e=>e.frames<2||!Number.isInteger(e.frames)||!Number.isInteger(e.offset)||e.offset<0||e.offset+e.frames*53*4>idle.weights.length))throw Error('待机策略骨架或轨迹形状无效.');
 return {create(data,context){
  const original=data.create(),random=seeded(149),bones=data.meta.bones.length,decode=row=>Array.from({length:bones},(_,j)=>rotationExp(new Vector3(...row.slice(j*3,j*3+3)))),encode=(qs,row)=>{const v=row.slice();qs.forEach((q,j)=>v.splice(j*3,3,...rotationLog(q).toArray()));return v;};
  let selected=0,time=Infinity,last=null,origin=null,fade=0,signature=null,probability=0,loopFade=0;
  function choose(pose,s){
   const x=[...(net.pose_input===false?[]:net.joints.flatMap(j=>rotationLog(pose[j]).toArray().map(v=>v/Math.PI))),...Array.from({length:net.output},(_,i)=>Number(i===selected)),Number(s.intent.rest&&!s.speaking),Number(s.speaking),s.intent.motion];
   const p=selectorForward(net,x).p;if(prefix==='/v15-data/'&&s.listening){p[0]*=.4;p[net.activity_code]*=.4;}if(excluded.size||s.listening){for(const id of excluded)p[id]=0;const total=p.reduce((s,v)=>s+v,0);if(total<=0)throw Error('待机过滤后没有有效候选.');for(let i=0;i<p.length;i++)p[i]/=total;}signature=JSON.stringify([s.intent.rest,s.speaking,s.intent.motion,!!s.listening]);
   if(net.activity_code){let draw=random();selected=p.length-1;for(let i=0;i<p.length;i++){draw-=p[i];if(draw<=0){selected=i;break;}}}
   else if(p[0]>=.5)selected=0;else{let draw=random()*(1-p[0]);selected=p.length-1;for(let i=1;i<p.length;i++){draw-=p[i];if(draw<=0){selected=i;break;}}}
   probability=p[selected];time=0;origin=pose.map(q=>q.clone());fade=last?1:0;loopFade=0;
   if(net.activity_code&&selected>0&&selected!==net.activity_code){const e=idle.entries[selected-1],gap=Math.max(...Array.from({length:bones},(_,j)=>new Quaternion().fromArray(idle.weights,e.offset+j*4).angleTo(new Quaternion().fromArray(idle.weights,e.offset+((e.frames-1)*bones+j)*4))));loopFade=Math.min((e.frames-1)/20*.4,Math.max(.1,1.875*gap/2.5));}
  }
  return {sample(dt){
   const row=original.sample(dt),s=context(),qs=decode(row.values),current=last??qs,nextSignature=JSON.stringify([s.intent.rest,s.speaking,s.intent.motion,!!s.listening]);
   const duration=selected>0&&selected!==net.activity_code?(idle.entries[selected-1].frames-1)/20:3.95;
   if(!s.locked&&(time>=duration||nextSignature!==signature))choose(current,s);time+=dt;
   const isIdle=selected>0&&selected!==net.activity_code;let target=qs;
   if(isIdle){const entry=idle.entries[selected-1],duration=(entry.frames-1)/20,pos=(time%duration)*20,a=Math.floor(pos),b=Math.min(entry.frames-1,a+1),wrap=loopFade?ease((pos/20-duration+loopFade)/loopFade):0;target=Array.from({length:bones},(_,j)=>new Quaternion().fromArray(idle.weights,entry.offset+(a*bones+j)*4).slerp(new Quaternion().fromArray(idle.weights,entry.offset+(b*bones+j)*4),pos-a).slerp(new Quaternion().fromArray(idle.weights,entry.offset+j*4),wrap).normalize());}
   if(origin&&time<fade)target=target.map((q,j)=>origin[j].clone().slerp(q,ease(time/fade)));last=target;
   const values=encode(target,row.values);if(isIdle)values.fill(0,bones*3);
   return {...row,values,base_code:selected,base_probability:probability};
  },selection:()=>({code:selected,source:selected>0&&selected!==net.activity_code?idle.entries[selected-1].source:'第九版连续底座',kind:selected===0?'chat':selected===net.activity_code?'activity':'idle',probability,time})};
 }};
}

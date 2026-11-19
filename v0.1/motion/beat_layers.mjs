import {Quaternion} from 'three';
import {clipRotation} from './skill_rotation.mjs';
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
const clone=qs=>qs.map(q=>q.slice());
// 每个轨道读取固定来源的绝对局部旋转, 不以执行后的姿态累加下一次修正.
export function beatLayers(bones,sources){
 let time=0,tracks=[],serial=0,last=null;const q=(data,f,j,skill)=>clipRotation(data,f,j,bones.length,skill);
 function sampleTrack(track,at){
  const age=Math.max(0,at-track.start),clip=track.skill,run=age*track.speed,phase=run>=clip.duration*track.cycles?clip.duration:run%clip.duration,position=Math.min(clip.end-1,clip.start+phase*20),a=Math.floor(position),b=Math.min(clip.end-1,a+1);
  const wrap=track.cycles>1&&run<clip.duration*(track.cycles-1)&&phase>clip.duration-track.cycleFade?ease((phase-clip.duration+track.cycleFade)/track.cycleFade):0;
  const result=[];for(const j of track.mask)result[j]=q(track.source,a,j,clip).slerp(q(track.source,b,j,clip),position-a).slerp(q(track.source,clip.start,j,clip),wrap);return result;
 }
 function weight(track,at){
  if(track.cancelAt!==null&&at>=track.cancelAt)return track.cancelWeight*(1-ease((at-track.cancelAt)/track.fade));
  const age=at-track.start,total=track.skill.duration*track.cycles/track.speed+track.hold;
  return track.strength*ease(age/track.fade)*(1-ease((age-total)/track.fade));
 }
 function add(entry,{speed=1,strength=1,hold=2,delay=0,cycles=1}={},base){
  if(entry.skills.length!==1)throw Error('轨道必须接收学习策略选出的单个动作码.');
  if(base?.length!==bones.length)throw Error('轨道缺少当前骨架参照.');
  if(![speed,strength,hold,delay].every(Number.isFinite)||speed<.4||speed>2||strength<0||strength>1||hold<0||hold>20||delay<0||delay>30)throw Error('动作轨道参数无效.');
  if(!Number.isInteger(cycles)||cycles<1||cycles>4)throw Error('动作周期数无效.');
  const skill=entry.skills[0],source=sources.get(skill.source);if(!source)throw Error('动作来源未加载.');
  if(!(source instanceof Float32Array)||source.length%(bones.length*4)||!Number.isInteger(skill.start)||!Number.isInteger(skill.end)||skill.start<0||skill.end<=skill.start||skill.end*bones.length*4>source.length||!Number.isFinite(skill.duration)||skill.duration<=0)throw Error('动作来源形状或帧区间无效.');
  if(skill.bias&&(!entry.mask.includes(skill.bias.joint)||skill.bias.angles?.length!==3||skill.bias.angles.some(v=>!Number.isFinite(v)||Math.abs(v)>Math.PI)))throw Error('学习动作码的姿态偏置无效.');
  if(tracks.length>=16)throw Error('动作轨道已满, 请等待当前动作结束.');
  const gap=Math.max(0,...entry.mask.flatMap(j=>{const current=new Quaternion(...base[j]).normalize();return [current.angleTo(q(source,skill.start,j,skill)),current.angleTo(q(source,skill.end-1,j,skill))];}));
  // 五次包络的最大导数为1.875. 按实际角距分配淡入淡出时间, 而不是所有大动作都在0.7秒内返回.
  const fade=Math.max(.7,1.875*gap/2.5);
  const start=time+delay;
  for(const old of tracks)if(old.cancelAt===null&&old.mask.some(j=>entry.mask.includes(j))){old.cancelWeight=weight(old,start);old.cancelAt=start;}
  const loopGap=Math.max(...entry.mask.map(j=>q(source,skill.start,j,skill).angleTo(q(source,skill.end-1,j,skill))));
  const cycleFade=Math.min(skill.duration*.4,Math.max(.1,1.875*loopGap/2.5));
  const track={id:++serial,key:entry.key,part:entry.part??'arm',side:entry.side,mask:entry.mask,start,speed,strength,hold,fade,cycles,cycleFade,cancelAt:null,skill,source};
  tracks.push(track);return track.id;
 }
 function sample(base,dt){
  if(!Number.isFinite(dt)||dt<0||dt>.2||base.length!==bones.length)throw Error('轨道时钟或骨架无效.');time+=dt;
  tracks=tracks.filter(t=>time<=((t.cancelAt??(t.start+t.skill.duration*t.cycles/t.speed+t.hold))+t.fade));
  const output=clone(base),sums=Array(bones.length).fill(0),groups=bones.map(()=>[]);
  for(const track of tracks){const w=weight(track,time);if(w<=0)continue;const qs=sampleTrack(track,time);
   for(const j of track.mask){groups[j].push({q:qs[j],w});sums[j]+=w;}
  }
  for(let j=0;j<bones.length;j++){if(!groups[j].length)continue;let total=Math.max(0,1-sums[j]),value=new Quaternion(...base[j]);
   for(const r of groups[j]){value.slerp(r.q,r.w/(total+r.w));total+=r.w;}output[j]=value.normalize().toArray();sums[j]=Math.min(1,sums[j]);
  }
  last={time,weights:sums,tracks:tracks.map(t=>({id:t.id,key:t.key,part:t.part,side:t.side,source:t.skill.source,source_frame:t.skill.start,age:time-t.start,weight:weight(t,time),fade_seconds:t.fade,cycles:t.cycles,mask:t.mask}))};
  return output;
 }
 return {sample,add,active:()=>tracks.length>0,state:()=>last??{time,tracks:[],weights:Array(bones.length).fill(0)},clear(){for(const t of tracks){t.cancelWeight=weight(t,time);t.cancelAt=time;}},reset(){time=0;tracks=[];last=null;serial=0;}};
}

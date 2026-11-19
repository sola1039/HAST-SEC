import {Vector3} from 'three';
import {rotationStep,rotationExp,percentile} from '../feasible_math.mjs';
const alpha=(hz,dt)=>1/(1+1/(2*Math.PI*hz*dt));
const ease=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
// 临界阻尼解析解. 频率按线性系统的-3dB点标定, 四元数扩展在局部切空间计算.
export function dampedStep(error,velocity,hz,dt){
 const w=2*Math.PI*hz/Math.sqrt(Math.sqrt(2)-1),a=w*dt,e=Math.exp(-a);
 return {move:error.clone().multiplyScalar(1-(1+a)*e).addScaledVector(velocity,dt*e),velocity:velocity.clone().multiplyScalar((1-a)*e).addScaledVector(error,w*w*dt*e)};
}
function span(history){
 if(history.length<3)return 0;
 const values=history.map(q=>rotationStep(history[0],q));
 return Math.hypot(...[0,1,2].map(a=>percentile(values.map(v=>v.getComponent(a)),.9)-percentile(values.map(v=>v.getComponent(a)),.1)));
}
export function dampedOutput(names,settings){
 let velocities,speeds,windows,rootVelocity,rootSpeed,rootWindow,pending;
 function reset(){velocities=names.map(()=>new Vector3());speeds=names.map(()=>new Vector3());windows=names.map(()=>[]);rootVelocity=new Vector3();rootSpeed=new Vector3();rootWindow=[];pending=null;}
 reset();
 return {reset,synchronize(){velocities.forEach(v=>v.set(0,0,0));speeds.forEach(v=>v.set(0,0,0));windows.forEach(w=>w.length=0);rootVelocity.set(0,0,0);rootSpeed.set(0,0,0);rootWindow=[];pending=null;},propose(previous,raw,point,dt,quality){
  const o=settings.output_smoothing??{},count=Math.max(3,Math.min(40,Math.round((o.window_seconds??.5)/dt))),joints=[],nextVelocity=[],q=point.q.map((target,i)=>{
   const name=names[i],body=/hips|spine|chest|Shoulder|Leg|Foot|Toes/.test(name),arm=/Arm/.test(name),hand=/Hand/.test(name),base=body?o.body_hz??.85:arm?o.arms_hz??.9:hand?o.hands_hz??.8:o.details_hz??1.2,maximum=body?o.body_max_hz??1.6:arm?o.arms_max_hz??4.5:hand?o.hands_max_hz??4:o.details_max_hz??4,beta=arm?o.arms_beta??2:o.beta??.8,c=quality?.[i]??1;
   windows[i].push(target.clone());if(windows[i].length>count)windows[i].shift();
   const excursion=span(windows[i])*180/Math.PI,threshold=arm?o.arm_motion_degrees??12:body?o.body_motion_degrees??6:o.detail_motion_degrees??8,activity=ease((excursion-(o.minimum_motion_degrees??2))/(threshold-(o.minimum_motion_degrees??2)));
   speeds[i].lerp(rotationStep(raw.q[i],target).divideScalar(dt),alpha(o.derivative_hz??1,dt));
   const cutoff=Math.min(maximum,(base+activity*beta*speeds[i].length())*(.3+.7*c)),response=dampedStep(rotationStep(previous.q[i],target),velocities[i],cutoff,dt);
   joints[i]={bone:name,confidence:c,cutoff_hz:cutoff,filter_gain:1-(1+2*Math.PI*cutoff*dt/.643594)*Math.exp(-2*Math.PI*cutoff*dt/.643594),measurement_gain:1,noise_gate:0,amplitude_gate:1-activity,excursion_degrees:excursion,motion_activity:activity};
   nextVelocity[i]=response.velocity;return previous.q[i].clone().multiply(rotationExp(response.move));
  });
  rootWindow.push(point.p.clone());if(rootWindow.length>count)rootWindow.shift();const excursion=rootWindow.length>1?Math.max(...rootWindow.map(p=>p.distanceTo(rootWindow[0]))):0;
  rootSpeed.lerp(point.p.clone().sub(raw.p).divideScalar(dt),alpha(o.derivative_hz??1,dt));const rootHz=Math.min(o.root_max_hz??2,(o.root_hz??1)+15*rootSpeed.length()*ease(excursion/.06)),response=dampedStep(point.p.clone().sub(previous.p),rootVelocity,rootHz,dt);
  const candidate={q,p:previous.p.clone().add(response.move)};pending={previous,candidate,nextVelocity,rootNextVelocity:response.velocity};return {candidate,joints,root_hz:rootHz};
 },commit(point){
  if(!pending)return;const {previous,candidate,nextVelocity,rootNextVelocity}=pending;
  // 若几何回收改写了候选, 清除该通道的潜在动量. 其余速度随最终局部坐标运输.
  velocities=point.q.map((q,i)=>q.angleTo(candidate.q[i])>1e-5?new Vector3():nextVelocity[i].applyQuaternion(previous.q[i].clone().invert().multiply(q).invert()));
  rootVelocity.copy(point.p.distanceTo(candidate.p)>1e-5?new Vector3():rootNextVelocity);pending=null;
 }};
}

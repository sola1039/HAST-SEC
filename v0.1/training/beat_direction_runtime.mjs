import {Quaternion,Vector3} from "three";
import {beatRuntime} from "./beat_runtime.mjs";
import {rotationExp,rotationLog} from "../retarget/rotation_math.mjs";
import {circle,headingOf,directionFeatures} from "./direction_math.mjs";
const dot=(x,w)=>x.reduce((s,v,j)=>s+v*w[j],0),up=new Vector3(0,1,0);
export function beatDirectionRuntime(meta,weights,codes,model,noise,{bodyFactory=beatRuntime}={}){
  if(meta.codes!==48)throw Error("方向模型和动作原型数量不匹配.");
  if(model.goal_weights?.length!==2||model.goal_weights.some(w=>w.length!==100)||model.velocity_weights?.length!==5||noise.sigma?.length!==48||!Number.isFinite(noise.rho)||Math.abs(noise.rho)>=1||noise.sigma.some(v=>!Number.isFinite(v)||v<0))throw Error("方向模型格式无效.");
  if(![...model.goal_weights.flat(),...model.velocity_weights,model.maximum_speed_degrees].every(Number.isFinite)||model.maximum_speed_degrees<=0||model.goal_step_seconds!==.25)throw Error("方向权重或时间步无效.");
  const body=bodyFactory(meta,weights,codes);
  let seconds=0,segment=0,previous=0,current=null,lastSteps=0,yaw=0,startYaw=0,endYaw=0,goal=0,uncertainty=0;const history=[0];
  const lag=n=>history[Math.max(0,history.length-1-n)],speed=model.maximum_speed_degrees*Math.PI/180;
  function target(){
    const short=circle(yaw-lag(5)),long=circle(yaw-lag(20)),x=directionFeatures(previous,current,yaw,short),s=dot(x,model.goal_weights[0]),c=dot(x,model.goal_weights[1]);
    uncertainty=noise.sigma[current];goal=Math.hypot(s,c)>1e-6?Math.atan2(s,c):yaw;
    const v=dot([1,short/.1,long/.25,Math.sin(goal-yaw)/.25,(Math.cos(goal-yaw)-1)/.1],model.velocity_weights)*.1;
    startYaw=yaw;endYaw=circle(yaw+Math.max(-speed*.25,Math.min(speed*.25,v)));segment=0;
  }
  function sync(row){if(current===null){current=row.token;lastSteps=row.steps;target();}else if(row.steps!==lastSteps){previous=current;current=row.token;lastSteps=row.steps;}}
  function rotate(row){const source=headingOf(row.values.slice(0,3)),q=rotationExp(new Vector3(...row.values.slice(0,3))),tilt=new Quaternion().setFromAxisAngle(up,-source).multiply(q),result=new Quaternion().setFromAxisAngle(up,yaw).multiply(tilt);const values=[...row.values];values.splice(0,3,...rotationLog(result).toArray());return {...row,values,heading:yaw,goal,goal_residual_std:uncertainty,automatic_goal:true};}
  return {sample(dt){
    if(!Number.isFinite(dt)||dt<0||dt>.2)throw Error("方向时间步无效.");
    let row=body.sample(0);sync(row);const end=seconds+dt;
    for(let i=0;seconds<end-1e-12&&i<6;i++){
      const next=(Math.floor((segment+1e-9)/.05)+1)*.05,step=Math.min(end-seconds,next-segment,.25-segment);row=body.sample(step);sync(row);seconds+=step;segment+=step;yaw=circle(startYaw+circle(endYaw-startYaw)*segment/.25);
      if(Math.abs(segment/.05-Math.round(segment/.05))<1e-7){history.push(yaw);if(history.length>21)history.shift();}
      if(segment>=.25-1e-9)target();
    }
    if(Math.abs(seconds-end)>1e-8)throw Error("方向积分未到达目标时间.");return rotate(row);
  }};
}

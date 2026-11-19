import {Quaternion} from 'three';
import {jointCoordinates,jointRotation} from '../joint_coordinates.mjs';
import {projectJoint} from '../joint_feasibility.mjs';
export function fixedClock(step,validate,rate=20,names=[]){
  const period=1/rate;let remaining=0,previous=null,current=null,steps=0;
  function reset(){remaining=0;previous=null;current=null;steps=0;}
  function advance(dt){
    if(!Number.isFinite(dt)||dt<0||dt>.2)throw Error('第九版显示时间步无效.');
    if(!current||dt===0){current=step(0);previous=current;return current;}
    remaining+=dt;
    for(let i=0;i<5&&remaining>=period-1e-9;i++){previous=current;current=step(period);remaining=Math.max(0,remaining-period);steps++;}
    if(remaining>=period+1e-9)throw Error('第九版求解时钟积压, 请暂停检查.');
    return current;
  }
  function display(){
    if(!current)return null;const t=Math.max(0,Math.min(1,remaining/period)),expressions={};
    for(const n of Object.keys(current.expressions))expressions[n]=(previous.expressions[n]??0)*(1-t)+current.expressions[n]*t;
    const result={...current,rotations:current.rotations.map((q,i)=>{const a=new Quaternion().fromArray(previous.rotations[i]),b=new Quaternion().fromArray(q),name=names[i];return (name?projectJoint(name,name==='hips'?a.slerp(b,t):jointRotation(name,jointCoordinates(name,a).lerp(jointCoordinates(name,b),t)),0):a.slerp(b,t)).toArray();}),root:current.root.map((v,i)=>previous.root[i]*(1-t)+v*t),expressions};
    return validate(result)?result:current;
  }
  return {reset,advance,display,state:()=>({steps,remaining,rate})};
}

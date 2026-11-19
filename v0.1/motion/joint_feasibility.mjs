import {Vector3} from 'three';
import {finiteQuaternion,interval,RAD} from './feasible_math.mjs';
import {jointCoordinates,jointRotation} from './joint_coordinates.mjs';
const box=(hard,soft=hard)=>({hard,soft});
function buildPolicy(name){
  let range,speed,accel;
  if(name==='hips'){range=box([[-22,22],[-180,180],[-18,18]],[[-12,12],[-180,180],[-10,10]]);speed=180;accel=1600;}
  else if(name==='spine'||name==='chest'){range=box([[-35,45],[-45,45],[-30,30]],[[-22,30],[-35,35],[-18,18]]);speed=180;accel=2000;}
  else if(name==='neck'||name==='head'){range=box([[-55,65],[-85,85],[-40,40]]);speed=300;accel=3500;}
  else if(/Eye$/.test(name)){range=box([[-35,35],[-45,45],[-12,12]]);speed=500;accel=6000;}
  else if(/Shoulder$/.test(name)){range=box([[-60,60],[-60,60],[-55,55]]);speed=360;accel=5000;}
  else if(/UpperArm$/.test(name)){range=box([[-150,150],[-155,155],[-155,155]]);speed=900;accel=18000;}
  else if(/LowerArm$/.test(name)){range=box([[-105,105],name.startsWith('left')?[-160,8]:[-8,160],[-28,28]]);speed=1000;accel=22000;}
  else if(/Hand$/.test(name)){range=box([[-75,75],[-80,80],[-70,70]]);speed=700;accel=12000;}
  else if(/UpperLeg$/.test(name)){range=box([[-125,45],[-50,50],[-40,40]],[[-100,35],[-40,40],[-28,28]]);speed=420;accel=5000;}
  else if(/LowerLeg$/.test(name)){range=box([[-155,5],[-18,18],[-5,5]],[[-150,3],[-12,12],[-3,3]]);speed=520;accel=7000;}
  else if(/Foot$/.test(name)){range=box([[-55,35],[-35,35],[-25,25]]);speed=400;accel=5000;}
  else if(/Toes$/.test(name)){range=box([[-50,60],[-15,15],[-15,15]]);speed=350;accel=4000;}
  else if(/Thumb/.test(name)){range=box([[-75,75],[-75,75],[-95,95]]);speed=650;accel=10000;}
  else if(/(Index|Middle|Ring|Little)/.test(name)){const side=/Proximal$/.test(name)?25:10,flex=/Distal$/.test(name)?85:/Intermediate$/.test(name)?115:100;range=box([[-side,side],[-side,side],name.startsWith('left')?[-12,flex]:[-flex,12]]);speed=650;accel=10000;}
  else throw Error('骨骼缺少人体范围定义: '+name+'.');
  return {...range,speed:speed*RAD,accel:accel*RAD,jerk:accel*16*RAD};
}
const policies=new Map();
export function jointPolicy(name){
  if(!policies.has(name))policies.set(name,buildPolicy(name));const p=policies.get(name);
  // 膝关节范围随屈曲角改变, 为其保留独立副本, 防止本次查询修改下次的范围.
  return /LowerLeg$/.test(name)?{...p,hard:p.hard.map(r=>r.slice()),soft:p.soft.map(r=>r.slice())}:p;
}
export function projectJoint(name,value,strength=2){
  const q=finiteQuaternion(value),p=jointPolicy(name),v=jointCoordinates(name,q);
  // 对根的偏航独立处理, 防止大偏航混入侧倾的旋转对数.
  if(name==='hips'){
    const up=new Vector3(0,1,0).applyQuaternion(q),tilt=Math.acos(Math.max(-1,Math.min(1,up.y))),max=18*RAD;
    if(tilt>max)q.premultiply(q.clone().identity().slerp(q.clone().identity().setFromUnitVectors(up,new Vector3(0,1,0)),1-max/tilt));
    return q.normalize();
  }
  if(/LowerLeg$/.test(name)){
    const x=interval(v.x,p.soft[0].map(x=>x*RAD),p.hard[0].map(x=>x*RAD),strength),twist=Math.min(18,5+Math.abs(x/RAD)*.08);p.hard[1]=[-twist,twist];p.soft[1]=[-twist*.7,twist*.7];
  }
  const hardAxes=p.hard,softAxes=p.soft;
  for(let i=0;i<3;i++)v.setComponent(i,interval(v.getComponent(i),softAxes[i].map(x=>x*RAD),hardAxes[i].map(x=>x*RAD),strength));
  if(!/LowerLeg$|LowerArm$|Thumb|Index|Middle|Ring|Little/.test(name)&&v.length()>178*RAD)v.setLength(178*RAD);
  return jointRotation(name,v);
}
export function violation(name,value){const p=jointPolicy(name),q=finiteQuaternion(value);if(name==='hips')return Math.max(0,new Vector3(0,1,0).applyQuaternion(q).angleTo(new Vector3(0,1,0))-18*RAD);const v=jointCoordinates(name,q);if(/LowerLeg$/.test(name)){const t=Math.min(18,5+Math.abs(v.x/RAD)*.08);p.hard[1]=[-t,t];}return Math.max(0,...p.hard.flatMap((r,i)=>[r[0]*RAD-v.getComponent(i),v.getComponent(i)-r[1]*RAD]));}

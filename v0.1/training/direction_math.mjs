import {Vector3} from "three";
import {rotationExp} from "../retarget/rotation_math.mjs";
export const circle=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function headingOf(v){const f=new Vector3(0,0,1).applyQuaternion(rotationExp(new Vector3(...v)));return Math.atan2(f.x,f.z);}
export function directionFeatures(previous,current,yaw,omega){
  if(![previous,current].every(v=>Number.isInteger(v)&&v>=0&&v<48)||![yaw,omega].every(Number.isFinite))throw Error("方向历史无效.");
  const x=Array(100).fill(0);x[previous]=1;x[48+current]=1;x[96]=Math.sin(yaw);x[97]=Math.cos(yaw);x[98]=omega/.1;x[99]=1;return x;
}

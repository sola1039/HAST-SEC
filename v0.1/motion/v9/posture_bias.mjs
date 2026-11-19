import {Quaternion,Vector3} from 'three';
import {RAD} from '../feasible_math.mjs';
// 播放参考偏置在历史融合和全身求解前应用一次. 不直接旋转最终模型或改动训练观测.
export function postureBias(rotations,rig,direction,degrees=0){
  if(!Number.isFinite(degrees)||degrees<0||degrees>12)throw Error('播放前倾角度必须位于0到12度.');
  if(direction!==1&&direction!==-1)throw Error('播放前倾的角色正面方向无效.');
  const result=rotations.map(q=>q.clone());if(degrees===0)return result;
  const delta=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),direction*degrees*RAD);
  result[rig.index('spine')].premultiply(delta).normalize();return result;
}

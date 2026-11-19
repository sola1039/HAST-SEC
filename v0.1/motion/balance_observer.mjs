import {Vector3} from 'three';
// 速度从观测目标估计, 不把上一帧求解修正再次作为人体运动反馈.
export function balanceObserver(dynamics){
  let previous=null,velocity=new Vector3();
  return {reset(){previous=null;velocity.set(0,0,0);},update(state,dt,quality=1){
    const center=dynamics.center(state);
    if(previous&&dt>0){const measured=center.clone().sub(previous).divideScalar(dt).clampLength(0,.5),gain=1-Math.exp(-dt/(.12+.3*(1-quality)));velocity.lerp(measured,gain);}
    if(dt>0||!previous)previous=center;return velocity.clone();
  }};
}

import {dampedOutput} from './damped_output.mjs';
const clone=p=>({q:p.q.map(q=>q.clone()),p:p.p.clone()});
// 速度自适应低通放在求解之后. 回写最终可行姿态, 不把未显示的滤波候选当成历史.
export function outputSmoothing(names,settings){
 const response=dampedOutput(names,settings);let previous=null,raw=null,last=null;
 function reset(){previous=null;raw=null;response.reset();last=null;}
 reset();
 return {reset,report:()=>last,step(point,dt,quality,map,test,enabled=true){
  if(!Number.isFinite(dt)||dt<0||dt>.2||quality?.some(c=>!Number.isFinite(c)||c<0||c>1))throw Error('最终平滑时间步或质量无效.');
  let candidate=clone(point),recovery=0,joints=[],rootHz=null;
  if(previous&&dt>0&&enabled){
   const proposal=response.propose(previous,raw,point,dt,quality);candidate=proposal.candidate;joints=proposal.joints;rootHz=proposal.root_hz;
   candidate=map(candidate);
   if(!test(candidate)){
    const smooth=clone(candidate);let lo=0,hi=1;
    for(const t of [.25,.5,.75,1]){const p=map({q:smooth.q.map((q,i)=>q.clone().slerp(point.q[i],t)),p:smooth.p.clone().lerp(point.p,t)});if(test(p)){hi=t;candidate=p;break;}lo=t;}
    for(let k=0;k<8;k++){const t=(lo+hi)/2,p=map({q:smooth.q.map((q,i)=>q.clone().slerp(point.q[i],t)),p:smooth.p.clone().lerp(point.p,t)});if(test(p)){hi=t;candidate=p;}else lo=t;}
    recovery=hi;
   }
  }else response.synchronize();
  if(!test(candidate))throw Error('最终平滑未取得可行状态.');
  response.commit(candidate);previous=clone(candidate);raw=clone(point);last={enabled,recovery_fraction:recovery,joints,root_hz:rootHz,kind:'求解后二阶临界阻尼, 近期幅度门控, 有界响应与可行性回收'};
  return candidate;
 }};
}

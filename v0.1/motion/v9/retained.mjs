import {targetsV9} from './targets.mjs';
import {objective} from './objective.mjs';
// 候选失败与实际输出分开. 保留帧的代价必须用实际姿态和已接受接触参考重新计算.
export function retainedState(rig,physics,contact,config,{attempt,previous,proposal,target,root,physical,history,dt,quality,observed=target,handGoal=null}){
  const point=previous??{q:rig.neutral.map(q=>q.clone()),p:rig.offsets[0].clone()},chosen=contact.current()??proposal;
  const build=targetsV9(rig,physics,contact,chosen,rig.fk(target,root),config,handGoal),output=objective(rig,build,target,root,physical,history,dt,quality,observed,config,handGoal)(point);
  if(!output.feasible)throw Error('第九版没有可用的可行状态, 已停止输出.');
  return {chosen,solution:{...attempt,...output,point,accepted:0,initial_cost:output.cost,final_cost:output.cost,status:'保留上一可行状态',attempt:{status:attempt.status,initial_cost:attempt.initial_cost,final_cost:attempt.final_cost,hard_violation:attempt.hard_violation,accepted:attempt.accepted,feasible:attempt.feasible}}};
}

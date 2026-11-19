import {projectJoint} from '../joint_feasibility.mjs';
import {targetsV9} from './targets.mjs';
import {objective} from './objective.mjs';
import {outputSmoothing} from './output_smoothing.mjs';
export function postSolve(rig,physics,contact,config,history){
 const filter=outputSmoothing(rig.names,config);
 return {reset:filter.reset,report:filter.report,run(solution,target,root,proposal,dt,physical,quality,observed,enabled,handGoal=null){
  const build=targetsV9(rig,physics,contact,proposal,rig.fk(target,root),config,handGoal);
  const map=point=>({...point,q:point.q.map((q,i)=>history.limit(i,projectJoint(rig.names[i],q,0),dt))});
  const test=point=>build(rig.fk(point.q,point.p)).metrics.feasible;
  const point=filter.step(solution.point,dt,quality,map,test,enabled&&solution.status!=='保留上一可行状态');
  const score=objective(rig,build,target,root,physical,history.previous(),dt,quality,observed,config,handGoal)(point);
  return {...solution,...score,point,pre_smoothing_cost:solution.cost,final_cost:score.cost,output_smoothing:filter.report()};
 }};
}

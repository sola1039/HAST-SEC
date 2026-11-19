import {numericSystem,updateJacobian} from './numeric_system.mjs';
export function residualSolve(initial,{variables,move,advance,evaluate,iterations=4,constrained=false,difference=null}){
  let point=initial,current=evaluate(point),accepted=0,damping=.01,status='迭代上限',gradient=Infinity,used=0,backtracks=0;
  const initialCost=current.cost;let columns=null;
  for(let k=0;k<iterations;k++){
    used++;const system=numericSystem(point,current.residual,variables,move,evaluate,damping,k%3===0?null:columns);gradient=system.gradient;
    if(!system.step){status='线性系统退化';break;}
    if(gradient<1e-7){status='局部驻点';break;}
    const norm=Math.hypot(...system.step),step=system.step.map(x=>x*Math.min(1,2/Math.max(norm,1e-12)));let improved=false;
    for(let j=0;j<15;j++){
      backtracks++;const trial=advance(point,step,2**(-j)),next=evaluate(trial);
      if(Number.isFinite(next.cost)&&next.cost<current.cost-1e-10&&(!constrained||!current.feasible||next.feasible)){columns=difference?updateJacobian(system.columns,difference(point,trial),current.residual,next.residual):null;point=trial;current=next;accepted++;improved=true;damping=Math.max(1e-5,damping*.5);break;}
    }
    if(!improved){columns=null;damping=Math.min(1e5,damping*10);if(damping>=1e4){status='搜索停滞';break;}}
    else if(current.cost<1e-9){status='残差收敛';break;}
  }
  return {point,...current,initial_cost:initialCost,final_cost:current.cost,iterations:used,accepted,status,gradient,backtracks};
}

import {Vector3} from 'three';
export function feasibleTargets(rig,dynamics,contacts,initial,rows,handForward,weights={},velocity=new Vector3()){
  const hands=['leftHand','rightHand'].map(n=>rig.index(n)),forward=new Vector3(0,0,1).applyQuaternion(initial.q[0]);forward.y=0;forward.normalize();
  const handTargets=hands.map(i=>initial.p[i].clone().addScaledVector(forward,handForward)),hull=contacts.support(rows,initial);
  return state=>{
    const tasks=[];
    if(handForward&&(weights.hand??1)>0)hands.forEach((index,i)=>tasks.push({point:state.p[index],index,error:handTargets[i].clone().sub(state.p[index]),weight:.4*(weights.hand??1)}));
    for(const f of rows){
      const p=state.p[f.index],target=f.active?f.anchor:p.clone().setY(Math.max(f.floor,p.y)),e=target.clone().sub(p);
      if(e.length()>1e-5&&(weights.contact??1)>0)tasks.push({point:p,index:f.index,error:e,weight:(f.locked?2:f.prior?.3:.7)*(weights.contact??1)});
    }
    const com=dynamics.center(state);
    if(hull&&(weights.balance??1)>0){const height=Math.max(.15,com.y-Math.min(...rows.map(f=>f.floor))),xcom=com.clone().addScaledVector(velocity,Math.sqrt(height/9.81)),e=contacts.project(xcom,hull).sub(xcom);e.y=0;if(e.length()>.002)tasks.push({point:com,index:-1,error:e,weight:.5*(weights.balance??1)*(1+Math.min(3,(e.length()/.05)**2))});}
    return tasks;
  };
}

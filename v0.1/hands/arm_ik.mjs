import {Quaternion,Vector3} from "three";
export function armTargets(controller){
  const arms=Object.fromEntries(["left","right"].map(side=>{
    const upper=controller.node(side+"UpperArm"),lower=controller.node(side+"LowerArm"),hand=controller.node(side+"Hand");
    return [side,{upper,lower,hand,first:lower.position.clone(),second:hand.position.clone()}];
  }));
  return (side,target,strength=1,elbowHint=null)=>{
    const arm=arms[side];if(!arm||!(target?.isVector3)||!target.toArray().every(Number.isFinite)||!Number.isFinite(strength)||strength<0||strength>1)throw new Error("手臂目标无效.");
    const root=arm.upper.getWorldPosition(new Vector3()),line=target.clone().sub(root),l1=arm.first.length(),l2=arm.second.length();
    if(line.length()<1e-6||Math.min(l1,l2)<1e-5)return;
    const distance=Math.max(Math.abs(l1-l2)+1e-5,Math.min(l1+l2-1e-5,line.length())),direction=line.normalize(),project=(l1*l1-l2*l2+distance*distance)/(2*distance);
    // 优先保留当前肘所在平面, 不把不对称动作强制镜像.
    if(elbowHint!==null&&(!elbowHint?.isVector3||!elbowHint.toArray().every(Number.isFinite)))throw new Error("肘部目标无效.");
    const pole=(elbowHint?.clone()??arm.lower.getWorldPosition(new Vector3())).sub(root);pole.addScaledVector(direction,-pole.dot(direction));
    if(pole.length()<.001){pole.set(side==="left"?1:-1,-1,0);pole.addScaledVector(direction,-pole.dot(direction));}
    pole.normalize();const elbow=root.clone().addScaledVector(direction,project).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-project*project)));
    function aim(node,rest,point){const inverse=node.parent.getWorldQuaternion(new Quaternion()).invert(),desired=point.clone().sub(node.getWorldPosition(new Vector3())).normalize().applyQuaternion(inverse),current=rest.clone().normalize().applyQuaternion(node.quaternion),q=new Quaternion().setFromUnitVectors(current,desired).multiply(node.quaternion);node.quaternion.slerp(q,strength);controller.sync();}
    aim(arm.upper,arm.first,elbow);aim(arm.lower,arm.second,root.clone().addScaledVector(direction,distance));
  };
}

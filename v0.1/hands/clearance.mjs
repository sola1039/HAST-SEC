import {Vector3} from "three";
import {armTargets} from "./arm_ik.mjs";
export function createClearance(controller){
  const solve=armTargets(controller),pairs=["left","right"].map(side=>{
    const normal=controller.node(side+"Shoulder"),raw=controller.vrm.humanoid.getRawBoneNode(side+"Shoulder");
    return {side,normal,raw,normalRest:normal.position.clone(),rawRest:raw.position.clone()};
  });
  function axes(){
    const left=controller.node("leftUpperArm").getWorldPosition(new Vector3()),right=controller.node("rightUpperArm").getWorldPosition(new Vector3());
    const up=controller.node("chest").getWorldPosition(new Vector3()).sub(controller.node("hips").getWorldPosition(new Vector3())).normalize(),lateral=left.sub(right).normalize();
    return {lateral,forward:new Vector3().crossVectors(lateral,up).normalize()};
  }
  return {shoulders(meters){
    if(!Number.isFinite(meters)||meters<0||meters>.06)throw new Error("肩部补偿无效.");
    for(const pair of pairs){pair.normal.position.copy(pair.normalRest);pair.raw.position.copy(pair.rawRest);}controller.sync();
    const {lateral}=axes();
    for(const pair of pairs)for(const node of [pair.normal,pair.raw]){
      const target=node.getWorldPosition(new Vector3()).addScaledVector(lateral,(pair.side==="left"?1:-1)*meters);node.position.copy(node.parent.worldToLocal(target));
    }
    controller.sync();
  },offset(meters){
    if(!Number.isFinite(meters)||meters<0||meters>.12)throw new Error("手部前移无效.");return axes().forward.multiplyScalar(meters);
  },hands(offset){for(const side of ["left","right"])solve(side,controller.node(side+"Hand").getWorldPosition(new Vector3()).add(offset));}};
}

import {VRMExpression,VRMExpressionMorphTargetBind} from "@pixiv/three-vrm";
import {validateBlendshapes} from "./format.mjs";
export const FINE_TARGETS=Object.freeze({browUpLeft:"eyebrow_up_L",browUpRight:"eyebrow_up_R",browDownLeft:"eyebrow_down_L",browDownRight:"eyebrow_down_R",eyeWideLeft:"eye_surprised_L",eyeWideRight:"eye_surprised_R",cheekPuff:"mouth_cheek_inflate",mouthSmile:"mouth_smile_1"});
const clamp=value=>Math.max(0,Math.min(1,value));
export function fineFaceWeights(shapes){
  validateBlendshapes(shapes);const result={};
  for(const side of ["Left","Right"]){
    result["browUp"+side]=.5*Math.max(shapes.browInnerUp,shapes["browOuterUp"+side]);
    result["browDown"+side]=.35*clamp((shapes["browDown"+side]-.15)/.85);
    result["eyeWide"+side]=.35*clamp((shapes["eyeWide"+side]-.1)/.9);
  }
  result.cheekPuff=.3*shapes.cheekPuff;
  result.mouthSmile=.3*(shapes.mouthSmileLeft+shapes.mouthSmileRight)/2*(1-.7*shapes.jawOpen);
  return result;
}
export function registerFineFace(vrm){
  const plan=Object.entries(FINE_TARGETS).map(([name,target])=>{
    if(vrm.expressionManager.getExpression(name))return null;
    const expression=new VRMExpression(name);let count=0;
    vrm.scene.traverse(mesh=>{
      const index=mesh.morphTargetDictionary?.[target];
      if(Number.isInteger(index)&&mesh.morphTargetInfluences?.[index]!==undefined){expression.addBind(new VRMExpressionMorphTargetBind({primitives:[mesh],index,weight:1}));count++;}
    });
    return count?expression:null;
  }).filter(Boolean);
  for(const expression of plan) vrm.expressionManager.registerExpression(expression);
  return plan.map(expression=>expression.expressionName);
}

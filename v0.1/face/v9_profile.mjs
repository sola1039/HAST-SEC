import {VRMExpression,VRMExpressionMorphTargetBind} from '@pixiv/three-vrm';
import {FACE_ORDER} from './feasible_face.mjs';
export const EXTRA_FACE={eyeSmile:'eye_smile',eyeWorry:'eye_worry',eyeAngry:'eye_angry',browSmileLeft:'eyebrow_smile_L',browSmileRight:'eyebrow_smile_R',browWorryLeft:'eyebrow_worry_L',browWorryRight:'eyebrow_worry_R',browShyLeft:'eyebrow_shy_L',browShyRight:'eyebrow_shy_R',browAngryLeft:'eyebrow_angry_L',browAngryRight:'eyebrow_angry_R',mouthAngry:'mouth_angry_1',mouthPanic:'mouth_panic',blush:'sp_cheek',tears:'sp_tear_default',starEyes:'eye_star',heartEyes:'eye_heart'};
export const V9_FACE_ORDER=[...FACE_ORDER,...Object.keys(EXTRA_FACE)];
export const V9_FACE_LABELS=['张口','窄口','圆口','横口','大圆口','左眨眼','右眨眼','开心组合','生气组合','难过组合','放松组合','左抬眉','右抬眉','左压眉','右压眉','左睁大眼','右睁大眼','鼓腮','微笑','笑眼','担忧眼','生气眼','左笑眉','右笑眉','左担忧眉','右担忧眉','左害羞眉','右害羞眉','左生气眉','右生气眉','生气嘴','惊慌嘴','脸红','眼泪','星星眼','爱心眼'];
export const FACE_GROUPS=[['starEyes','heartEyes'],['mouthSmile','mouthAngry','mouthPanic'],...['Left','Right'].map(s=>['browUp','browDown','browSmile','browWorry','browShy','browAngry'].map(n=>n+s)),...['Left','Right'].map(s=>['eyeSmile','eyeWorry','eyeAngry','eyeWide'+s])];
export function registerV9Face(vrm){
 for(const [name,target]of Object.entries(EXTRA_FACE)){
  if(vrm.expressionManager.getExpression(name))continue;
  const expression=new VRMExpression(name);let count=0;
  vrm.scene.traverse(mesh=>{const index=mesh.morphTargetDictionary?.[target];if(Number.isInteger(index)){expression.addBind(new VRMExpressionMorphTargetBind({primitives:[mesh],index,weight:1}));count++;}});
  if(count)vrm.expressionManager.registerExpression(expression);
 }
 return V9_FACE_ORDER;
}

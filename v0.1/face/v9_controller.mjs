import {feasibleFace,FACE_ORDER} from './feasible_face.mjs';
import {faceMotion} from './v9_motion.mjs';
export function faceControllerV9(available,metric,order=FACE_ORDER,groups=[]){
 const motion=faceMotion(order),projection=feasibleFace(available,metric,order,groups);let last=null;
 return {reset(){motion.reset();projection.reset();last=null;},project(source,dt,quality,options,manual){
  const weights=motion.generate(source,manual,dt,options),result=projection.project(weights,dt,quality);
  last={...projection.report(),driver:motion.report(),playback_only:!!options};return result;
 },report:()=>last};
}

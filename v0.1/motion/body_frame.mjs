import {Vector3} from 'three';
export function bodyFrame(rig,state){
 const right=rig.rest.p[rig.index('rightUpperArm')].clone().sub(rig.rest.p[rig.index('leftUpperArm')]);right.y=0;right.normalize().applyQuaternion(state.q[0].clone().multiply(rig.rest.q[0].clone().invert()));right.y=0;right.normalize();return {right,forward:right.clone().cross(new Vector3(0,1,0)),origin:state.p[0]};
}
export function bodyPosition(rig,state,index){const {right,forward,origin}=bodyFrame(rig,state),p=state.p[index].clone().sub(origin);return new Vector3(p.dot(right)*100,p.y*100,p.dot(forward)*100);}
export function bodyWorldPoint(rig,state,point,reference=null){const {right,forward,origin}=bodyFrame(rig,state);return (reference?state.p[rig.index(reference)]:origin).clone().addScaledVector(right,point[0]/100).add(new Vector3(0,point[1]/100,0)).addScaledVector(forward,point[2]/100);}

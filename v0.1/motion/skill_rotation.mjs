import {Quaternion,Euler} from 'three';
export function clipRotation(data,frame,joint,count,skill){
 const q=new Quaternion().fromArray(data,(frame*count+joint)*4).normalize();
 if(skill.bias?.joint===joint)q.premultiply(new Quaternion().setFromEuler(new Euler(...skill.bias.angles)));
 return q.normalize();
}
